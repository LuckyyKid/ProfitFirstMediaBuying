// Creates a ClickUp task when a new closed deal is submitted.
// Fills the JOUR 1 fields with the info we already have from the deal.
// Fields left empty on purpose (filled later by the AM or other automations):
//   AM Owner, Meta / Shopify / Gates / CRM fields.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LIST_ID = "901714791842";

// ---- Custom field IDs (JOUR 1) --------------------------------------------
const CF_CLIENT_NAME = "63202fcb-ce44-4bc4-ab3d-cf8dc6b9705c";
const CF_EMAIL       = "9accfe04-f53b-4b8d-b41c-dfc42f22253c";
const CF_PHONE       = "7dcbf594-ede1-4823-b3e8-1d7bcccd1ee8";
const CF_SLACK       = "79193371-5761-4c00-ad5b-c495eb91ee9f";
const CF_NEXT_MS     = "a1388c0a-a850-487f-8121-0033e3b9557d";
const CF_LAUNCH_DATE = "6b2a06ef-c0be-4461-baee-174cbe69da62";

// Dropdown: Current Phase → Onboarding
const CF_CURRENT_PHASE = "a978b8c7-3661-45c9-b7a2-c487cf9e11e2";
const OPT_PHASE_ONBOARDING = "efefcddb-56ea-4eb8-8257-8431a202b00c";

// Dropdown: Payment Status → Pending (default; deal is closed but Stripe may still be pending)
const CF_PAYMENT_STATUS = "f9b59dd9-6cae-4328-a29a-b9e08c3803a5";
const OPT_PAYMENT_PENDING = "3acdb322-fdd6-4aef-aa2e-16c61a96371b";
const OPT_PAYMENT_PAID    = "9801042e-186b-441b-a6ab-7a7e4c82e714";
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const token = Deno.env.get("CLICKUP_API_TOKEN");
    if (!token) throw new Error("CLICKUP_API_TOKEN not configured");

    const body = await req.json();
    const {
      client_name,
      contact_name,
      email,
      phone,
      slack_channel_name,
      business_type,
      industry,
      main_objective,
      monthly_price,
      closing_date,
      payment_status, // "paid" | "pending" | undefined
    } = body || {};

    const description = [
      `**Client :** ${client_name || ""}`,
      `**Contact :** ${contact_name || ""}`,
      `**Type :** ${business_type || ""}`,
      industry ? `**Industrie :** ${industry}` : null,
      main_objective ? `**Objectif :** ${main_objective}` : null,
      monthly_price != null ? `**Prix mensuel :** ${monthly_price}` : null,
    ].filter(Boolean).join("\n");

    // Normalize phone to E.164
    const normalizePhone = (raw?: string): string | null => {
      if (!raw) return null;
      const trimmed = String(raw).trim();
      if (trimmed.startsWith("+")) return trimmed.replace(/[^\d+]/g, "");
      const digits = trimmed.replace(/\D/g, "");
      if (digits.length === 10) return `+1${digits}`;
      if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
      return null;
    };
    const phoneE164 = normalizePhone(phone);

    // Launch target = closing_date + 30 days (fallback: today + 30d)
    const baseDate = closing_date ? new Date(closing_date) : new Date();
    if (isNaN(baseDate.getTime())) baseDate.setTime(Date.now());
    const launchDate = new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    const launchIso = launchDate.toISOString().slice(0, 10);
    const launchMs = launchDate.getTime();

    const paymentOption =
      String(payment_status || "").toLowerCase() === "paid"
        ? OPT_PAYMENT_PAID
        : OPT_PAYMENT_PENDING;

    const custom_fields: Array<{ id: string; value: unknown }> = [
      { id: CF_CLIENT_NAME,     value: client_name || "" },
      { id: CF_EMAIL,           value: email || "" },
      { id: CF_SLACK,           value: slack_channel_name || "" },
      { id: CF_NEXT_MS,         value: "Kickoff / Onboarding call" },
      { id: CF_LAUNCH_DATE,     value: launchMs },
      { id: CF_CURRENT_PHASE,   value: OPT_PHASE_ONBOARDING },
      { id: CF_PAYMENT_STATUS,  value: paymentOption },
    ];
    if (phoneE164) custom_fields.push({ id: CF_PHONE, value: phoneE164 });

    const payload = {
      name: client_name || contact_name || "Nouveau client",
      description,
      status: "on track",
      custom_fields,
    };

    const res = await fetch(`https://api.clickup.com/api/v2/list/${LIST_ID}/task`, {
      method: "POST",
      headers: {
        Authorization: token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    if (!res.ok) {
      console.error("[clickup] error", res.status, text);
      return new Response(
        JSON.stringify({ error: "ClickUp API error", status: res.status, details: text }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = JSON.parse(text);
    console.log("[clickup] task created", data?.id, "launch=", launchIso);
    return new Response(
      JSON.stringify({ ok: true, task_id: data?.id, url: data?.url, launch_target_date: launchIso }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("[clickup] failed", e);
    return new Response(JSON.stringify({ error: e.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
