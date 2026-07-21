import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_FORMS: Record<string, { field: string; ts: string; type: string; step: number; webhook: string }> = {
  welcome: {
    field: "welcome_form_submitted",
    ts: "form_completed_at",
    type: "welcome_quiz",
    step: 4,
    webhook: "https://hook.us1.make.com/z5notv79fqjj9qg9e6r1nnfsefj8zasp",
  },
  founder_scan: {
    field: "founder_scan_submitted",
    ts: "founder_scan_completed_at",
    type: "founder_scan",
    step: 5,
    webhook: "https://hook.us1.make.com/939rnmwmxldwbmse2j6k4qdqmgwi8s92",
  },
  business_deep_dive: {
    field: "business_deep_dive_submitted",
    ts: "business_deep_dive_completed_at",
    type: "business_deep_dive",
    step: 6,
    // TODO: remplacer par l'URL du webhook Make dédié au Business Deep Dive
    webhook: "REPLACE_ME_BUSINESS_DEEP_DIVE_WEBHOOK",
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const body = await req.json().catch(() => ({}));
    const { client_code, form, answers } = body ?? {};

    if (!form || !ALLOWED_FORMS[form]) {
      return new Response(JSON.stringify({ error: "Invalid form" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!client_code || typeof client_code !== "string") {
      return new Response(JSON.stringify({ error: "Missing client_code" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const meta = ALLOWED_FORMS[form];
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const now = new Date().toISOString();

    const update: Record<string, unknown> = {
      client_code,
      [meta.field]: true,
      [meta.ts]: now,
      last_activity_at: now,
      current_step: meta.step,
      updated_at: now,
    };

    const { data, error } = await supabase
      .from("client_progress")
      .upsert(update, { onConflict: "client_code" })
      .select()
      .single();
    if (error) throw error;

    // Persist individual answers
    if (Array.isArray(answers) && answers.length > 0) {
      // Wipe previous answers for this form so resubmissions stay clean
      await supabase
        .from("client_form_answers")
        .delete()
        .eq("client_code", client_code)
        .eq("form_type", meta.type);

      const rows = answers.map((a: any) => ({
        client_code,
        form_type: meta.type,
        section: a.section ?? null,
        question_key: a.id ?? a.question_key ?? "unknown",
        question_label: a.question ?? a.question_label ?? null,
        answer: typeof a.answer === "string" ? a.answer : JSON.stringify(a.answer ?? null),
      }));
      await supabase.from("client_form_answers").insert(rows);
    }

    // Activity log
    await supabase.from("client_activity_log").insert({
      client_code,
      event_type: `${form}_submitted`,
      status: "ok",
      details: { answers_count: Array.isArray(answers) ? answers.length : 0 },
    });

    // For Business Deep Dive: create a Google Sheet with the answers instead of a Make webhook
    if (form === "business_deep_dive") {
      try {
        const { error: sheetErr } = await supabase.functions.invoke(
          "create-business-deep-dive-sheet",
          {
            body: {
              client_code,
              client_name: data?.client_name ?? null,
              company_name: data?.company_name ?? null,
              brand_name: data?.brand_name ?? null,
              email: data?.email ?? null,
              business_type: (data as any)?.business_type ?? null,
              drive_folder_id: (data as any)?.drive_folder_id ?? null,
              answers: Array.isArray(answers) ? answers : [],
            },
          },
        );
        await supabase.from("client_activity_log").insert({
          client_code,
          event_type: `${form}_sheet_created`,
          status: sheetErr ? "error" : "ok",
          error: sheetErr ? sheetErr.message : null,
        });
      } catch (whErr) {
        console.error("Sheet creation error:", whErr);
        await supabase.from("client_activity_log").insert({
          client_code,
          event_type: `${form}_sheet_created`,
          status: "error",
          error: (whErr as Error).message,
        });
      }
    } else if (meta.webhook && !meta.webhook.startsWith("REPLACE_ME")) {
      // Fire Make.com webhook server-side (reliable, no CORS issue)
      try {
        const webhookPayload = {
          form,
          client_code,
          client_id: data?.client_id ?? null,
          client_name: data?.client_name ?? null,
          company_name: data?.company_name ?? null,
          brand_name: data?.brand_name ?? null,
          email: data?.email ?? null,
          phone: data?.phone ?? null,
          submitted_at: now,
          answers: Array.isArray(answers) ? answers : [],
          ...(Array.isArray(answers)
            ? Object.fromEntries(
                answers.map((a: any) => [a.id ?? a.question_key ?? "unknown", a.answer ?? null]),
              )
            : {}),
        };
        const res = await fetch(meta.webhook, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(webhookPayload),
        });
        await supabase.from("client_activity_log").insert({
          client_code,
          event_type: `${form}_webhook_sent`,
          status: res.ok ? "ok" : "error",
          error: res.ok ? null : `HTTP ${res.status}`,
          details: { webhook: meta.webhook },
        });
      } catch (whErr) {
        console.error("Webhook error:", whErr);
        await supabase.from("client_activity_log").insert({
          client_code,
          event_type: `${form}_webhook_sent`,
          status: "error",
          error: (whErr as Error).message,
        });
      }
    } else {
      console.warn(`Webhook not configured for form=${form}, skipping.`);
    }


    // Notify progress webhook (fire and forget)
    supabase.functions
      .invoke("notify-step-progress", { body: { client_code } })
      .catch((e) => console.error("notify-step-progress error:", e));

    return new Response(JSON.stringify({ success: true, progress: data }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Unhandled:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
