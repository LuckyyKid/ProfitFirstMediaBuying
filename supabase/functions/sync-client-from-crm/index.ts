import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const GET_CLIENT_ENDPOINT =
  "https://ytnrkpabzskqwpozqato.supabase.co/functions/v1/get-client";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MASTER_PREFIXES = ["master-"];

function humanize(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  if (!t || UUID_RE.test(t)) return null;
  return t;
}

function pickFirst<T>(...values: T[]): T | null {
  for (const v of values) if (v !== null && v !== undefined && v !== "") return v;
  return null;
}

async function sha256Hex(s: string) {
  const buf = new TextEncoder().encode(s);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Look up user names in the external CRM's `profiles` table.
// Returns a Map<uuid, name>.
async function resolveProfileNames(uuids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const clean = uuids.filter((u) => typeof u === "string" && UUID_RE.test(u));
  if (clean.length === 0) return out;
  const URL = Deno.env.get("EXTERNAL_SUPABASE_URL");
  const KEY = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY");
  if (!URL || !KEY) return out;
  const inList = `(${clean.map((u) => `"${u}"`).join(",")})`;
  try {
    const r = await fetch(
      `${URL}/rest/v1/profiles?id=in.${inList}&select=id,name,email`,
      { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } }
    );
    if (r.ok) {
      const rows = await r.json();
      for (const row of rows ?? []) {
        const name = humanize(row.name) ?? humanize(row.email);
        if (name) out.set(row.id, name);
      }
    }
  } catch (e) {
    console.warn("[resolveProfileNames]", e);
  }
  return out;
}

async function mapSnapshotToLocal(snap: any): Promise<Record<string, any>> {
  const client = snap?.client ?? {};
  const lead = snap?.lead ?? {};

  const closerId = client.closed_by ?? null;
  const supervisorId = client.supervisor_id ?? null;
  const names = await resolveProfileNames([closerId, supervisorId].filter(Boolean));

  const closer =
    humanize(client.closed_by_name) ??
    humanize(client.closer_name) ??
    humanize(lead.closer_name) ??
    (closerId ? names.get(closerId) ?? null : null);

  const supervisor =
    humanize(client.supervisor_name) ??
    humanize(client.sales_supervisor) ??
    humanize(lead.sales_supervisor) ??
    (supervisorId ? names.get(supervisorId) ?? null : null);

  return {
    client_id: client.id ?? lead.client_id ?? null,
    lead_id: client.lead_id ?? lead.id ?? null,
    client_name: pickFirst(
      humanize(client.name),
      humanize(client.contact_name),
      humanize(client.owner_name),
      humanize(lead.name),
      humanize(lead.full_name),
      humanize(snap?.caller_name)
    ),
    company_name: pickFirst(
      client.company_name,
      client.business_name,
      lead.company_name,
      lead.business_name
    ),
    brand_name: pickFirst(
      client.business_name,
      client.company_name,
      lead.business_name
    ),
    email: pickFirst(client.contact_email, client.email, lead.email),
    phone: pickFirst(client.contact_phone, client.phone, lead.phone),
    lead_source: pickFirst(lead.source, lead.lead_source, client.lead_source),
    closing_date: pickFirst(
      client.closed_at,
      client.closing_date,
      lead.closing_date
    ),
    closer_name: closer,
    sales_supervisor: supervisor,
    already_runs_ads:
      typeof client.has_run_ads === "boolean"
        ? client.has_run_ads
        : typeof lead.has_run_ads === "boolean"
          ? lead.has_run_ads
          : typeof client.already_runs_ads === "boolean"
            ? client.already_runs_ads
            : null,
    ad_budget: pickFirst(client.ad_budget, lead.ad_budget),
    deal_value: pickFirst(client.deal_value, lead.deal_value),
    stripe_link: pickFirst(client.stripe_link, lead.stripe_link),
    docusign_link: pickFirst(client.docusign_link, lead.docusign_link),
    owner_pain_point: pickFirst(client.owner_pain_point, lead.owner_pain_point),
    contract_start_date: client.contract_start_date ?? null,
    contract_end_date: client.contract_end_date ?? null,
    external_status: client.status ?? null,
    churned_at: client.churned_at ?? null,
    churn_reason: client.churn_reason ?? null,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const body = await req.json().catch(() => ({}));
    const { client_id, client_code, force } = body ?? {};

    if (!client_id && !client_code) {
      return new Response(
        JSON.stringify({ error: "client_id or client_code required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ref = (client_id ?? client_code) as string;
    if (typeof ref === "string" && MASTER_PREFIXES.some((p) => ref.startsWith(p))) {
      return new Response(
        JSON.stringify({ outcome: "skipped", reason: "master code" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const query = supabase.from("client_progress").select("*");
    const { data: local } = await (client_id
      ? query.eq("client_id", client_id).maybeSingle()
      : query.eq("client_code", client_code).maybeSingle());

    const lookupBody = client_id
      ? { client_id }
      : UUID_RE.test(client_code)
        ? { client_id: client_code }
        : { client_code };

    const extRes = await fetch(GET_CLIENT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(lookupBody),
    });
    const snap = await extRes.json();

    if (!extRes.ok || !snap?.success) {
      const err = snap?.error || `HTTP ${extRes.status}`;
      if (local?.client_code) {
        await supabase
          .from("client_progress")
          .update({ external_sync_error: err })
          .eq("client_code", local.client_code);
        await supabase.from("client_activity_log").insert({
          client_code: local.client_code,
          event_type: "external_sync",
          status: "error",
          error: err,
        });
      }
      return new Response(
        JSON.stringify({ outcome: "error", error: err }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Hash on raw snapshot (before name resolution) — resolved names are derived from the same data.
    const stable = JSON.stringify(snap, Object.keys(snap).sort());
    const hash = await sha256Hex(stable);
    const now = new Date().toISOString();

    const unchanged =
      !force && local?.external_snapshot_hash && local.external_snapshot_hash === hash;

    if (unchanged && local?.client_code) {
      await supabase
        .from("client_progress")
        .update({ external_synced_at: now, external_sync_error: null })
        .eq("client_code", local.client_code);
      return new Response(
        JSON.stringify({ outcome: "unchanged", client_code: local.client_code }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const mapped = await mapSnapshotToLocal(snap);
    const update: Record<string, any> = {
      ...mapped,
      external_snapshot: snap,
      external_snapshot_hash: hash,
      external_synced_at: now,
      external_sync_error: null,
    };
    if (!update.client_id && local?.client_id) delete update.client_id;

    if (local?.client_code) {
      // Helper: try update, retry without conflicting fields on unique violations.
      const tryUpdate = async (payload: Record<string, any>) => {
        return await supabase
          .from("client_progress")
          .update(payload)
          .eq("client_code", local.client_code)
          .select("client_code");
      };

      let attempt = { ...update };
      let { data: updated, error: updErr } = await tryUpdate(attempt);
      const droppedFields: string[] = [];

      // 23505 = unique_violation. Retry up to 3 times stripping the offending column.
      for (let i = 0; i < 3 && updErr?.code === "23505"; i++) {
        const msg = updErr.message || "";
        const match = msg.match(/constraint "([^"]+)"/);
        const constraint = match?.[1] ?? "";
        let dropKey: string | null = null;
        if (constraint.includes("email")) dropKey = "email";
        else if (constraint.includes("client_id")) dropKey = "client_id";
        else if (constraint.includes("phone")) dropKey = "phone";
        else if (constraint.includes("lead_id")) dropKey = "lead_id";
        if (!dropKey || !(dropKey in attempt)) break;
        delete attempt[dropKey];
        droppedFields.push(dropKey);
        ({ data: updated, error: updErr } = await tryUpdate(attempt));
      }

      if (updErr) {
        console.error("[sync-client-from-crm] update error", updErr);
        await supabase
          .from("client_progress")
          .update({ external_sync_error: updErr.message })
          .eq("client_code", local.client_code);
        return new Response(
          JSON.stringify({ outcome: "error", error: updErr.message, droppedFields, mapped }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      await supabase.from("client_activity_log").insert({
        client_code: local.client_code,
        event_type: "external_sync",
        status: local.external_snapshot_hash ? "updated" : "initial",
        details: { fields: Object.keys(attempt), droppedFields, rows: updated?.length ?? 0 },
      });
      return new Response(
        JSON.stringify({
          outcome: "updated",
          client_code: local.client_code,
          rows: updated?.length ?? 0,
          droppedFields,
          mapped,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ outcome: "no_local_row", snapshot: snap, mapped, hash }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ outcome: "error", error: String(e?.message ?? e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
