import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const WEBHOOK_URL = "https://hook.us1.make.com/oiiawypimtr74ndct2rirtxmgc7k9ffg";

const STEPS = [
  { key: "welcome", label: "Bienvenue" },
  { key: "platforms", label: "Accès plateformes" },
  { key: "form", label: "Formulaire" },
  { key: "founder_scan", label: "Founder Scan" },
  { key: "payment", label: "Paiement" },
  { key: "contract", label: "Contrat" },
  { key: "kickoff", label: "Appel démarrage" },
  { key: "done", label: "Terminé" },
];

const NEXT_ACTIONS: Record<string, string> = {
  welcome: "Le client doit terminer l'écran de bienvenue.",
  platforms: "Le client doit accorder les accès plateformes.",
  form: "Le client doit compléter le formulaire d'onboarding.",
  founder_scan: "Le client doit compléter le Founder Scan.",
  payment: "Le client doit effectuer le paiement.",
  contract: "Le client doit signer le contrat.",
  kickoff: "Le client doit réserver l'appel de démarrage.",
  done: "Onboarding terminé.",
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { client_code, step_index } = await req.json();
    if (!client_code || typeof step_index !== 'number') {
      return new Response(JSON.stringify({ error: 'client_code and step_index required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (step_index < 0 || step_index >= STEPS.length) {
      return new Response(JSON.stringify({ error: 'step_index out of range (0-7)' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: c } = await supabase
      .from('client_progress')
      .select('*')
      .eq('client_code', client_code)
      .maybeSingle();

    const step = STEPS[step_index];
    const total = STEPS.length;
    const done = step_index + 1;
    const progress_percent = Math.round((done / total) * 1000) / 10;
    const company_name = c?.company_name ?? c?.brand_name ?? c?.client_name ?? "TEST COMPANY";
    const isDone = step.key === "done";

    const paid = step_index >= 4;
    const signed = step_index >= 5;
    const kickoff = step_index >= 6;

    const payload: Record<string, unknown> = {
      event_type: isDone ? "onboarding_completed" : "onboarding_step_updated",
      _test: true,
      client_id: c?.client_id ?? client_code,
      client_code,
      client_name: c?.client_name ?? null,
      company_name,
      deal_value: c?.deal_value ?? null,
      current_step: done,
      current_step_index: step_index,
      total_steps: total,
      current_step_name: step.label,
      current_step_key: step.key,
      progress_percent: isDone ? 100 : progress_percent,
      payment_status: paid || isDone ? "paid" : "pending",
      contract_status: signed || isDone ? "signed" : "pending",
      kickoff_status: kickoff || isDone ? "booked" : "not_booked",
      last_activity_at: new Date().toISOString(),
      risk_level: isDone ? "low" : "normal",
      next_action: NEXT_ACTIONS[step.key] ?? "",
      admin_dashboard_url: `https://testtdia.lovable.app/admin/clients/${client_code}`,
    };

    const started = Date.now();
    let res: Response;
    let responseText = "";
    try {
      res = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      responseText = await res.text();
    } catch (err: any) {
      return new Response(JSON.stringify({
        success: false,
        error: `Network error: ${err?.message || 'unknown'}`,
        payload,
      }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({
      success: res.ok,
      status: res.status,
      duration_ms: Date.now() - started,
      response_body: responseText.slice(0, 500),
      payload,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || 'unknown' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
