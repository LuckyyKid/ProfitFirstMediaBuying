import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { SignJWT, importPKCS8 } from "npm:jose@5";
import { encodeBase64 } from "jsr:@std/encoding@1.0.10/base64";

const INTEGRATION_KEY = Deno.env.get("DOCUSIGN_INTEGRATION_KEY")!;
const USER_ID = Deno.env.get("DOCUSIGN_USER_ID")!;
const ACCOUNT_ID = Deno.env.get("DOCUSIGN_ACCOUNT_ID")!;
const BASE_URL = Deno.env.get("DOCUSIGN_BASE_URL")!;
const PRIVATE_KEY = Deno.env.get("DOCUSIGN_PRIVATE_KEY")!;
const TEMPLATE_ID = Deno.env.get("DOCUSIGN_TEMPLATE_ID") ?? "";

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

  if (!/^https?:\/\//i.test(normalized)) {
    normalized = `https://${normalized}`;
  }

  normalized = normalized
    .replace(/\/restapi\/v2\.1\/accounts\/[^/]+$/i, "")
    .replace(/\/v2\.1\/accounts\/[^/]+$/i, "")
    .replace(/\/restapi$/i, "");

  if (/\/oauth$/i.test(normalized)) {
    normalized = normalized.replace(/\/oauth$/i, "");
  }

  return `${normalized}/restapi/v2.1/accounts/${accountId}`;
}

// Convert PKCS#1 (BEGIN RSA PRIVATE KEY) to PKCS#8 (BEGIN PRIVATE KEY) by wrapping
// the DER bytes with the standard PrivateKeyInfo header for rsaEncryption.
function pkcs1ToPkcs8Pem(pkcs1Pem: string): string {
  const b64 = pkcs1Pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const pkcs1Der = Uint8Array.from(atob(b64), c => c.charCodeAt(0));

  // ASN.1 length encoding
  const encodeLen = (len: number): number[] => {
    if (len < 128) return [len];
    const bytes: number[] = [];
    let n = len;
    while (n > 0) { bytes.unshift(n & 0xff); n >>= 8; }
    return [0x80 | bytes.length, ...bytes];
  };

  // OCTET STRING wrapping the PKCS#1
  const octet = [0x04, ...encodeLen(pkcs1Der.length), ...pkcs1Der];
  // Version INTEGER 0
  const version = [0x02, 0x01, 0x00];
  // AlgorithmIdentifier: SEQUENCE { OID rsaEncryption (1.2.840.113549.1.1.1), NULL }
  const algId = [0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00];
  const inner = [...version, ...algId, ...octet];
  const seq = [0x30, ...encodeLen(inner.length), ...inner];

  const pkcs8B64 = btoa(String.fromCharCode(...seq));
  return `-----BEGIN PRIVATE KEY-----\n${pkcs8B64.match(/.{1,64}/g)!.join("\n")}\n-----END PRIVATE KEY-----`;
}

function normalizeKey(raw: string): string {
  let key = raw.trim();
  if (key.includes("\\n")) key = key.replace(/\\n/g, "\n");
  // If no PEM headers, assume raw base64 and try PKCS#8 first, else PKCS#1
  if (!key.includes("-----BEGIN")) {
    const b64 = key.replace(/\s+/g, "");
    // Try to detect: PKCS#8 DER starts with SEQUENCE then INTEGER 0; PKCS#1 starts with SEQUENCE then INTEGER (n)
    try {
      const der = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      // PKCS#8: after SEQUENCE header, next is 0x02 0x01 0x00 (version 0)
      // Quick heuristic: look at bytes
      let idx = 1;
      // skip length
      if (der[idx] & 0x80) idx += (der[idx] & 0x7f) + 1; else idx += 1;
      const isPkcs8 = der[idx] === 0x02 && der[idx + 1] === 0x01 && der[idx + 2] === 0x00
        && der[idx + 3] === 0x30; // followed by AlgorithmIdentifier SEQUENCE
      if (isPkcs8) {
        key = `-----BEGIN PRIVATE KEY-----\n${b64.match(/.{1,64}/g)!.join("\n")}\n-----END PRIVATE KEY-----`;
      } else {
        key = `-----BEGIN RSA PRIVATE KEY-----\n${b64.match(/.{1,64}/g)!.join("\n")}\n-----END RSA PRIVATE KEY-----`;
      }
    } catch {
      key = `-----BEGIN RSA PRIVATE KEY-----\n${b64.match(/.{1,64}/g)!.join("\n")}\n-----END RSA PRIVATE KEY-----`;
    }
  }
  if (key.includes("BEGIN RSA PRIVATE KEY")) {
    key = pkcs1ToPkcs8Pem(key);
  }
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

function buildPlaceholderPdfBase64(name: string, clientCode?: string): string {
  const safe = (s: string) => s.replace(/[\\()]/g, "\\$&");
  const line1 = `Contrat TDIA - ${safe(name)}`;
  const line2 = clientCode ? `Client: ${safe(clientCode)}` : "";
  const line3 = "Signez ici: /sig/";
  const stream = `BT /F1 14 Tf 72 760 Td (${line1}) Tj 0 -24 Td (${line2}) Tj 0 -24 Td (${line3}) Tj ET`;
  const objs = [
    "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj",
    "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj",
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Resources<</Font<</F1 5 0 R>>>>/Contents 4 0 R>>endobj",
    `4 0 obj<</Length ${stream.length}>>stream\n${stream}\nendstream endobj`,
    "5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (const o of objs) { offsets.push(pdf.length); pdf += o + "\n"; }
  const xrefPos = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += `${off.toString().padStart(10, "0")} 00000 n \n`;
  pdf += `trailer<</Size ${objs.length + 1}/Root 1 0 R>>\nstartxref\n${xrefPos}\n%%EOF`;
  return btoa(pdf);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { email, name, client_code, return_url } = body as {
      email?: string; name?: string; client_code?: string; return_url?: string;
    };

    if (!email || !name) {
      return new Response(JSON.stringify({ error: "email and name are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = await getAccessToken();
    const apiBase = normalizeApiBaseUrl(BASE_URL, ACCOUNT_ID);

    // Fetch contract PDF: priority to the contract generated via admin Contract Creator
    // (stored in closed-deals-contracts bucket and linked via client_progress.manual_contract_pdf_url).
    // Fallback to external CRM download-contract function for legacy clients.
    let contractBase64: string | null = null;
    let contractFetchError: string | null = null;
    let contractSource: string | null = null;

    if (client_code) {
      // 1) Try manual contract uploaded from admin Contract Creator
      try {
        const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
        const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
        if (SUPABASE_URL && SERVICE_KEY) {
          const lookupRes = await fetch(
            `${SUPABASE_URL}/rest/v1/client_progress?client_code=eq.${encodeURIComponent(client_code)}&select=manual_contract_pdf_url`,
            { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
          );
          if (lookupRes.ok) {
            const rows = await lookupRes.json();
            const manualUrl: string | null = rows?.[0]?.manual_contract_pdf_url ?? null;
            if (manualUrl) {
              const pdfRes = await fetch(manualUrl);
              if (pdfRes.ok) {
                const buf = new Uint8Array(await pdfRes.arrayBuffer());
                contractBase64 = encodeBase64(buf);
                contractSource = "manual_contract_creator";
                console.log(`[docusign] Using manual contract from ${manualUrl}`);
              } else {
                contractFetchError = `manual contract download failed (status ${pdfRes.status})`;
                console.warn(contractFetchError);
              }
            }
          }
        }
      } catch (e) {
        contractFetchError = `manual contract fetch exception: ${(e as Error).message}`;
        console.warn(contractFetchError);
      }

      // 1b) Try closed_deals.contract_pdf_path (uploaded via ClosedDeals form) → signed URL
      if (!contractBase64) {
        try {
          const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
          const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
          if (SUPABASE_URL && SERVICE_KEY) {
            const dealRes = await fetch(
              `${SUPABASE_URL}/rest/v1/closed_deals?client_code=eq.${encodeURIComponent(client_code)}&select=contract_pdf_path&order=created_at.desc&limit=1`,
              { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
            );
            if (dealRes.ok) {
              const rows = await dealRes.json();
              const pdfPath: string | null = rows?.[0]?.contract_pdf_path ?? null;
              if (pdfPath) {
                const signRes = await fetch(
                  `${SUPABASE_URL}/storage/v1/object/sign/closed-deals-contracts/${encodeURI(pdfPath)}`,
                  {
                    method: "POST",
                    headers: {
                      apikey: SERVICE_KEY,
                      Authorization: `Bearer ${SERVICE_KEY}`,
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ expiresIn: 600 }),
                  },
                );
                if (signRes.ok) {
                  const { signedURL } = await signRes.json();
                  const fullUrl = signedURL?.startsWith("http") ? signedURL : `${SUPABASE_URL}/storage/v1${signedURL}`;
                  const pdfRes = await fetch(fullUrl);
                  if (pdfRes.ok) {
                    const buf = new Uint8Array(await pdfRes.arrayBuffer());
                    contractBase64 = encodeBase64(buf);
                    contractSource = "closed_deals_upload";
                    console.log(`[docusign] Using closed_deals contract at ${pdfPath}`);
                  } else {
                    contractFetchError = `closed_deals signed download failed (status ${pdfRes.status})`;
                  }
                } else {
                  contractFetchError = `signed url failed (status ${signRes.status})`;
                }
              }
            }
          }
        } catch (e) {
          contractFetchError = `closed_deals fetch exception: ${(e as Error).message}`;
          console.warn(contractFetchError);
        }
      }

      // 2) Fallback to external CRM
      if (!contractBase64) {
        try {
          const STABLE_CONTRACT_BASE_URL = "https://vzezlelfmfplfaleqage.supabase.co";
          const configuredExternalUrl = (Deno.env.get("EXTERNAL_SUPABASE_URL") ?? "")
            .trim()
            .replace(/\/+$/, "");
          const externalUrls = [
            STABLE_CONTRACT_BASE_URL,
            configuredExternalUrl,
          ].filter((value, index, arr) => value && arr.indexOf(value) === index);

          for (const externalUrl of externalUrls) {
            const downloadUrl = `${externalUrl}/functions/v1/download-contract?client_code=${encodeURIComponent(client_code)}`;
            const pdfRes = await fetch(downloadUrl, { method: "GET", redirect: "follow" });
            if (!pdfRes.ok) {
              contractFetchError = `download-contract failed from ${externalUrl} (status ${pdfRes.status})`;
              console.error(contractFetchError);
              continue;
            }
            const buf = new Uint8Array(await pdfRes.arrayBuffer());
            contractBase64 = encodeBase64(buf);
            contractSource = "external_crm";
            contractFetchError = null;
            break;
          }
        } catch (e) {
          contractFetchError = `contract fetch exception: ${(e as Error).message}`;
          console.error(contractFetchError);
        }
      }
    }

    if (client_code && !contractBase64) {
      console.warn(
        `No contract PDF for ${client_code} (${contractFetchError}); falling back to ${TEMPLATE_ID ? "template" : "placeholder"}.`,
      );
    } else if (contractSource) {
      console.log(`[docusign] contract source = ${contractSource}`);
    }

    // Build envelope: prefer fetched PDF, else template, else placeholder
    const envelopePayload: Record<string, unknown> = contractBase64
      ? {
          emailSubject: `Contrat TDIA — ${name}`,
          status: "sent",
          documents: [
            {
              documentBase64: contractBase64,
              name: "Contrat.pdf",
              fileExtension: "pdf",
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
                clientUserId: client_code || email,
                tabs: {
                  signHereTabs: [
                    { anchorString: "/sig/", anchorUnits: "pixels", anchorXOffset: "0", anchorYOffset: "0" },
                  ],
                },
              },
            ],
          },
        }
      : TEMPLATE_ID
      ? {
          templateId: TEMPLATE_ID,
          templateRoles: [
            {
              email,
              name,
              roleName: "Client",
              clientUserId: client_code || email,
            },
          ],
          status: "sent",
          emailSubject: `Contrat TDIA — ${name}`,
        }
      : {
          emailSubject: `Contrat TDIA — ${name}`,
          status: "sent",
          documents: [
            {
              documentBase64: buildPlaceholderPdfBase64(name, client_code),
              name: "Contrat.pdf",
              fileExtension: "pdf",
              documentId: "1",
            },
          ],
          recipients: {
            signers: [
              {
                email, name, recipientId: "1", routingOrder: "1",
                clientUserId: client_code || email,
                tabs: {
                  signHereTabs: [
                    { anchorString: "/sig/", anchorUnits: "pixels", anchorXOffset: "0", anchorYOffset: "0" },
                  ],
                },
              },
            ],
          },
        };

    let envRes = await fetch(`${apiBase}/envelopes`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(envelopePayload),
    });
    let envData = await readJsonResponse(envRes);

    // Fallback: if template is invalid for this account, retry without template
    if (
      !envRes.ok &&
      (envelopePayload as any).templateId &&
      typeof envData?.message === "string" &&
      /templateId/i.test(envData.message)
    ) {
      console.warn(`Invalid DOCUSIGN_TEMPLATE_ID '${TEMPLATE_ID}' — retrying without template.`);
      const fallbackPayload = {
        emailSubject: `Contrat TDIA — ${name}`,
        status: "sent",
        documents: [
          {
            documentBase64: buildPlaceholderPdfBase64(name, client_code),
            name: "Contrat.pdf",
            fileExtension: "pdf",
            documentId: "1",
          },
        ],
        recipients: {
          signers: [
            {
              email, name, recipientId: "1", routingOrder: "1",
              clientUserId: client_code || email,
              tabs: {
                signHereTabs: [
                  { anchorString: "/sig/", anchorUnits: "pixels", anchorXOffset: "0", anchorYOffset: "0" },
                ],
              },
            },
          ],
        },
      };
      envRes = await fetch(`${apiBase}/envelopes`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(fallbackPayload),
      });
      envData = await readJsonResponse(envRes);
    }

    if (!envRes.ok) {
      return new Response(JSON.stringify({ error: "Envelope creation failed", details: envData }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


    const envelopeId = envData.envelopeId as string;

    // Create embedded recipient view (signing URL)
    const viewRes = await fetch(`${apiBase}/envelopes/${envelopeId}/views/recipient`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        returnUrl: return_url || "https://testtdia.lovable.app/step7",
        authenticationMethod: "none",
        email,
        userName: name,
        clientUserId: client_code || email,
      }),
    });
    const viewData = await readJsonResponse(viewRes);
    if (!viewRes.ok) {
      return new Response(JSON.stringify({ error: "Signing URL creation failed", details: viewData, envelopeId }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      envelopeId,
      signingUrl: viewData.url,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
