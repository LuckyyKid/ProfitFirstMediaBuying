// Send a DocuSign envelope by email (DocuSign delivers its own signing
// invitation). This is intentionally split from create-docusign-envelope
// so the Step 7 embedded-signing flow stays untouched.
//
// Called from admin/contract-creator when the admin clicks "Envoyer par email".
// The caller passes the freshly-generated contract (DOCX preferred, PDF for
// legacy) as base64 so we don't rely on any storage / URL lookup. DocuSign
// auto-converts DOCX to PDF on their side.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { SignJWT, importPKCS8 } from "npm:jose@5";

const INTEGRATION_KEY = Deno.env.get("DOCUSIGN_INTEGRATION_KEY")!;
const USER_ID = Deno.env.get("DOCUSIGN_USER_ID")!;
const ACCOUNT_ID = Deno.env.get("DOCUSIGN_ACCOUNT_ID")!;
const BASE_URL = Deno.env.get("DOCUSIGN_BASE_URL")!;
const PRIVATE_KEY = Deno.env.get("DOCUSIGN_PRIVATE_KEY")!;

const IS_DEMO = BASE_URL.includes("demo.docusign");
const AUTH_HOST = IS_DEMO ? "account-d.docusign.com" : "account.docusign.com";

async function readJsonResponse(res: Response) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return {
      raw: text.slice(0, 1000),
      contentType: res.headers.get("content-type") ?? null,
    };
  }
}

function normalizeApiBaseUrl(baseUrl: string, accountId: string) {
  let normalized = baseUrl.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(normalized)) normalized = `https://${normalized}`;
  normalized = normalized
    .replace(/\/restapi\/v2\.1\/accounts\/[^/]+$/i, "")
    .replace(/\/v2\.1\/accounts\/[^/]+$/i, "")
    .replace(/\/restapi$/i, "");
  if (/\/oauth$/i.test(normalized)) normalized = normalized.replace(/\/oauth$/i, "");
  return `${normalized}/restapi/v2.1/accounts/${accountId}`;
}

function pkcs1ToPkcs8Pem(pkcs1Pem: string): string {
  const b64 = pkcs1Pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const pkcs1Der = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const encodeLen = (len: number): number[] => {
    if (len < 128) return [len];
    const bytes: number[] = [];
    let n = len;
    while (n > 0) { bytes.unshift(n & 0xff); n >>= 8; }
    return [0x80 | bytes.length, ...bytes];
  };
  const octet = [0x04, ...encodeLen(pkcs1Der.length), ...pkcs1Der];
  const version = [0x02, 0x01, 0x00];
  const algId = [0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00];
  const inner = [...version, ...algId, ...octet];
  const seq = [0x30, ...encodeLen(inner.length), ...inner];
  const pkcs8B64 = btoa(String.fromCharCode(...seq));
  return `-----BEGIN PRIVATE KEY-----\n${pkcs8B64.match(/.{1,64}/g)!.join("\n")}\n-----END PRIVATE KEY-----`;
}

function normalizeKey(raw: string): string {
  let key = raw.trim();
  if (key.includes("\\n")) key = key.replace(/\\n/g, "\n");
  if (!key.includes("-----BEGIN")) {
    const b64 = key.replace(/\s+/g, "");
    try {
      const der = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      let idx = 1;
      if (der[idx] & 0x80) idx += (der[idx] & 0x7f) + 1; else idx += 1;
      const isPkcs8 = der[idx] === 0x02 && der[idx + 1] === 0x01 && der[idx + 2] === 0x00
        && der[idx + 3] === 0x30;
      if (isPkcs8) {
        key = `-----BEGIN PRIVATE KEY-----\n${b64.match(/.{1,64}/g)!.join("\n")}\n-----END PRIVATE KEY-----`;
      } else {
        key = `-----BEGIN RSA PRIVATE KEY-----\n${b64.match(/.{1,64}/g)!.join("\n")}\n-----END RSA PRIVATE KEY-----`;
      }
    } catch {
      key = `-----BEGIN RSA PRIVATE KEY-----\n${b64.match(/.{1,64}/g)!.join("\n")}\n-----END RSA PRIVATE KEY-----`;
    }
  }
  if (key.includes("BEGIN RSA PRIVATE KEY")) key = pkcs1ToPkcs8Pem(key);
  return key;
}

async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const pkcs8 = normalizeKey(PRIVATE_KEY);
  const privateKey = await importPKCS8(pkcs8, "RS256");
  const assertion = await new SignJWT({ scope: "signature impersonation" })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(INTEGRATION_KEY)
    .setSubject(USER_ID)
    .setAudience(AUTH_HOST)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(privateKey);
  const res = await fetch(`https://${AUTH_HOST}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const data = await readJsonResponse(res);
  if (!res.ok) {
    const hint = data?.error === "consent_required"
      ? ` — Open https://${AUTH_HOST}/oauth/auth?response_type=code&scope=signature%20impersonation&client_id=${INTEGRATION_KEY}&redirect_uri=https://www.docusign.com and click Accept.`
      : "";
    throw new Error(`DocuSign auth failed: ${JSON.stringify(data)}${hint}`);
  }
  return data.access_token as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const {
      email,
      name,
      client_code,
      contract_pdf_base64,
      contract_docx_base64,
      email_subject,
      email_body,
    } = body as {
      email?: string;
      name?: string;
      client_code?: string;
      contract_pdf_base64?: string;
      contract_docx_base64?: string;
      email_subject?: string;
      email_body?: string;
    };

    if (!email || !name) {
      return new Response(
        JSON.stringify({ error: "email and name are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Prefer DOCX (current admin flow) over PDF (legacy). DocuSign accepts both
    // and converts DOCX to PDF internally.
    const contractBase64 = contract_docx_base64 || contract_pdf_base64;
    const contractFileExtension = contract_docx_base64 ? "docx" : "pdf";
    const contractFileName = contract_docx_base64 ? "Contrat.docx" : "Contrat.pdf";
    if (!contractBase64 || contractBase64.length === 0) {
      return new Response(
        JSON.stringify({
          error: "contract_docx_base64 or contract_pdf_base64 is required for email delivery",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const accessToken = await getAccessToken();
    const apiBase = normalizeApiBaseUrl(BASE_URL, ACCOUNT_ID);

    // No clientUserId on the signer → DocuSign sends its own signing invitation
    // email to the recipient. This is the whole point of the email flow.
    const envelopePayload = {
      emailSubject: email_subject || `Contrat TDIA — ${name}`,
      emailBlurb: email_body || undefined,
      status: "sent",
      documents: [
        {
          documentBase64: contractBase64,
          name: contractFileName,
          fileExtension: contractFileExtension,
          documentId: "1",
        },
      ],
      recipients: {
        signers: [
          {
            email,
            name,
            recipientId: "1",
            routingOrder: "1",
            tabs: {
              signHereTabs: [
                { anchorString: "/sig/", anchorUnits: "pixels", anchorXOffset: "0", anchorYOffset: "0" },
              ],
            },
          },
        ],
      },
    };

    const envRes = await fetch(`${apiBase}/envelopes`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(envelopePayload),
    });
    const envData = await readJsonResponse(envRes);
    if (!envRes.ok) {
      return new Response(
        JSON.stringify({ error: "Envelope creation failed", details: envData }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const envelopeId = envData.envelopeId as string;

    // Best-effort: log the email envelope on the client_progress row so admin
    // has a trail. We don't overwrite docusign_envelope_id — that column is
    // owned by the embedded Step 7 flow.
    try {
      const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
      const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
      if (SUPABASE_URL && SERVICE_KEY && client_code) {
        await fetch(
          `${SUPABASE_URL}/rest/v1/client_progress?client_code=eq.${encodeURIComponent(client_code)}`,
          {
            method: "PATCH",
            headers: {
              apikey: SERVICE_KEY,
              Authorization: `Bearer ${SERVICE_KEY}`,
              "Content-Type": "application/json",
              Prefer: "return=minimal",
            },
            body: JSON.stringify({
              docusign_email_envelope_id: envelopeId,
              docusign_email_sent_at: new Date().toISOString(),
              docusign_email_sent_to: email,
              updated_at: new Date().toISOString(),
            }),
          },
        );
      }
    } catch (logErr) {
      console.warn("[send-docusign-contract-email] progress log failed:", logErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        envelopeId,
        emailSentTo: email,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
