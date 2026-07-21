// Appends a single row to the shared Business Deep Dive Google Sheet.
// The sheet is created on first call and its ID is persisted in app_settings.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const SHEETS_GATEWAY = "https://connector-gateway.lovable.dev/google_sheets/v4";
const DRIVE_GATEWAY = "https://connector-gateway.lovable.dev/google_drive/drive/v3";
const SETTING_KEY = "business_deep_dive_sheet_id";
const SHEET_TAB = "Réponses";
const META_COLUMNS = [
  "submitted_at",
  "client_code",
  "business_type",
  "company_name",
  "brand_name",
  "client_name",
  "email",
];

interface AnswerRow {
  section?: string | null;
  id?: string;
  question_key?: string;
  question?: string;
  question_label?: string;
  answer?: unknown;
}

function stringify(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  return JSON.stringify(v);
}

async function sheetsFetch(path: string, init: RequestInit, keys: { lovable: string; sheets: string }) {
  return fetch(`${SHEETS_GATEWAY}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${keys.lovable}`,
      "X-Connection-Api-Key": keys.sheets,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SHEETS_KEY = Deno.env.get("GOOGLE_SHEETS_API_KEY");
    const DRIVE_KEY = Deno.env.get("GOOGLE_DRIVE_API_KEY");
    if (!LOVABLE_API_KEY || !SHEETS_KEY) throw new Error("Google Sheets connector not configured");
    const keys = { lovable: LOVABLE_API_KEY, sheets: SHEETS_KEY };

    const body = await req.json();
    const {
      client_code,
      client_name,
      company_name,
      brand_name,
      email,
      business_type,
      answers,
    } = body ?? {};
    if (!client_code) throw new Error("client_code required");
    const rows: AnswerRow[] = Array.isArray(answers) ? answers : [];

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1) Get or create master spreadsheet id
    let spreadsheetId: string | null = null;
    let spreadsheetUrl: string | null = null;

    const { data: existing } = await sb
      .from("app_settings")
      .select("value")
      .eq("key", SETTING_KEY)
      .maybeSingle();
    if (existing?.value) {
      spreadsheetId = existing.value;
      spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
    } else {
      const createRes = await sheetsFetch(
        "/spreadsheets",
        {
          method: "POST",
          body: JSON.stringify({
            properties: { title: "Business Deep Dive — Réponses clients" },
            sheets: [{ properties: { title: SHEET_TAB } }],
          }),
        },
        keys,
      );
      const createText = await createRes.text();
      if (!createRes.ok) throw new Error(`sheets create failed (${createRes.status}): ${createText.slice(0, 300)}`);
      const sheet = JSON.parse(createText);
      spreadsheetId = sheet.spreadsheetId;
      spreadsheetUrl = sheet.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

      await sb.from("app_settings").upsert({ key: SETTING_KEY, value: spreadsheetId });

      // Make link-shareable (best-effort)
      if (DRIVE_KEY) {
        try {
          await fetch(`${DRIVE_GATEWAY}/files/${spreadsheetId}/permissions`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "X-Connection-Api-Key": DRIVE_KEY,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ role: "reader", type: "anyone", allowFileDiscovery: false }),
          });
        } catch (e) {
          console.warn("[drive] permission failed:", (e as Error).message);
        }
      }
    }

    // 2) Read existing header row
    const headerRes = await sheetsFetch(
      `/spreadsheets/${spreadsheetId}/values/${SHEET_TAB}!1:1`,
      { method: "GET" },
      keys,
    );
    const headerJson = headerRes.ok ? await headerRes.json() : { values: [] };
    let header: string[] = (headerJson.values?.[0] as string[]) ?? [];

    // 3) Build desired header from meta + answers
    const answerKeys: string[] = [];
    const answerLabels: Record<string, string> = {};
    const answerValues: Record<string, string> = {};
    for (const a of rows) {
      const key = String(a.id ?? a.question_key ?? "").trim();
      if (!key) continue;
      if (!answerKeys.includes(key)) answerKeys.push(key);
      answerLabels[key] = String(a.question ?? a.question_label ?? key);
      answerValues[key] = stringify(a.answer);
    }

    if (header.length === 0) {
      header = [...META_COLUMNS, ...answerKeys.map((k) => answerLabels[k] || k)];
      await sheetsFetch(
        `/spreadsheets/${spreadsheetId}/values/${SHEET_TAB}!A1?valueInputOption=RAW`,
        {
          method: "PUT",
          body: JSON.stringify({ range: `${SHEET_TAB}!A1`, majorDimension: "ROWS", values: [header] }),
        },
        keys,
      );
    } else {
      // Extend header with any new question labels not present yet
      const missing = answerKeys.filter((k) => !header.includes(answerLabels[k] || k));
      if (missing.length > 0) {
        const newHeader = [...header, ...missing.map((k) => answerLabels[k] || k)];
        await sheetsFetch(
          `/spreadsheets/${spreadsheetId}/values/${SHEET_TAB}!A1?valueInputOption=RAW`,
          {
            method: "PUT",
            body: JSON.stringify({
              range: `${SHEET_TAB}!A1`,
              majorDimension: "ROWS",
              values: [newHeader],
            }),
          },
          keys,
        );
        header = newHeader;
      }
    }

    // 4) Build the row aligned to header
    const now = new Date().toISOString();
    const meta: Record<string, string> = {
      submitted_at: now,
      client_code: client_code ?? "",
      business_type: business_type ?? "",
      company_name: company_name ?? "",
      brand_name: brand_name ?? "",
      client_name: client_name ?? "",
      email: email ?? "",
    };
    // question label -> value
    const labelToValue: Record<string, string> = {};
    for (const key of answerKeys) {
      labelToValue[answerLabels[key] || key] = answerValues[key] ?? "";
    }
    const row = header.map((col) => {
      if (col in meta) return meta[col];
      if (col in labelToValue) return labelToValue[col];
      return "";
    });

    // 5) Append the row
    const appendRes = await sheetsFetch(
      `/spreadsheets/${spreadsheetId}/values/${SHEET_TAB}!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      { method: "POST", body: JSON.stringify({ values: [row] }) },
      keys,
    );
    if (!appendRes.ok) {
      const t = await appendRes.text();
      throw new Error(`sheets append failed (${appendRes.status}): ${t.slice(0, 300)}`);
    }

    // 6) Persist the URL on the client (handy in admin)
    await sb
      .from("client_progress")
      .update({
        business_deep_dive_sheet_id: spreadsheetId,
        business_deep_dive_sheet_url: spreadsheetUrl,
      })
      .eq("client_code", client_code);

    return new Response(
      JSON.stringify({ ok: true, spreadsheetId, spreadsheetUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[create-business-deep-dive-sheet]", e);
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
