import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SLACK_CHANNEL = "client-onboarding-progression";

// Mirror of src/lib/onboardingHelpers.ts (server-side, framework-free)
const STEPS = [
  { key: "welcome", label: "Bienvenue", flag: "welcome_completed_at", legacy: null as string | null },
  { key: "platforms", label: "Accès plateformes", flag: "platforms_completed_at", legacy: null },
  { key: "form", label: "Formulaire", flag: "form_completed_at", legacy: "welcome_form_submitted" },
  { key: "founder_scan", label: "Founder Scan", flag: "founder_scan_completed_at", legacy: "founder_scan_submitted" },
  { key: "payment", label: "Paiement", flag: "payment_completed_at", legacy: "paid" },
  { key: "contract", label: "Contrat", flag: "contract_completed_at", legacy: "contract_signed" },
  { key: "kickoff", label: "Appel démarrage", flag: "kickoff_completed_at", legacy: "kickoff_scheduled" },
  { key: "done", label: "Terminé", flag: "completed_at", legacy: null },
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

function isStepDone(c: any, idx: number) {
  const s = STEPS[idx];
  if (!s) return false;
  if (s.key === "platforms") return Boolean(c.platforms_completed_at || c.video_watched);
  if (s.key === "kickoff") return Boolean(c.kickoff_completed_at || c.kickoff_scheduled || c.kickoff_scheduled_at);
  if (c[s.flag]) return true;
  if (s.legacy && c[s.legacy]) return true;
  return false;
}

function currentStepIndex(c: any) {
  for (let i = 0; i < STEPS.length; i++) if (!isStepDone(c, i)) return i;
  return STEPS.length - 1;
}

function completedCount(c: any) {
  let n = 0;
  for (let i = 0; i < STEPS.length; i++) if (isStepDone(c, i)) n++;
  return n;
}

function normalizeProgressState(c: any) {
  const x = { ...c };

  if (x.platforms_completed_at || x.video_watched) {
    x.welcome_completed_at = x.welcome_completed_at ?? x.last_activity_at ?? x.updated_at ?? new Date().toISOString();
  }
  if (x.form_completed_at || x.welcome_form_submitted) {
    x.welcome_completed_at = x.welcome_completed_at ?? x.form_completed_at ?? x.last_activity_at ?? new Date().toISOString();
    x.platforms_completed_at = x.platforms_completed_at ?? x.form_completed_at ?? x.last_activity_at ?? new Date().toISOString();
    x.video_watched = true;
  }
  if (x.founder_scan_completed_at || x.founder_scan_submitted) {
    x.welcome_completed_at = x.welcome_completed_at ?? x.founder_scan_completed_at ?? x.last_activity_at ?? new Date().toISOString();
    x.platforms_completed_at = x.platforms_completed_at ?? x.founder_scan_completed_at ?? x.last_activity_at ?? new Date().toISOString();
    x.form_completed_at = x.form_completed_at ?? x.founder_scan_completed_at ?? x.last_activity_at ?? new Date().toISOString();
    x.welcome_form_submitted = true;
    x.video_watched = true;
  }
  if (x.payment_completed_at || x.paid) {
    x.welcome_completed_at = x.welcome_completed_at ?? x.payment_completed_at ?? x.last_activity_at ?? new Date().toISOString();
    x.platforms_completed_at = x.platforms_completed_at ?? x.payment_completed_at ?? x.last_activity_at ?? new Date().toISOString();
    x.form_completed_at = x.form_completed_at ?? x.payment_completed_at ?? x.last_activity_at ?? new Date().toISOString();
    x.founder_scan_completed_at = x.founder_scan_completed_at ?? x.payment_completed_at ?? x.last_activity_at ?? new Date().toISOString();
    x.welcome_form_submitted = true;
    x.founder_scan_submitted = true;
    x.video_watched = true;
  }
  if (x.contract_completed_at || x.contract_signed) {
    x.payment_completed_at = x.payment_completed_at ?? x.contract_completed_at ?? x.last_activity_at ?? new Date().toISOString();
    x.paid = true;
  }
  if (x.kickoff_completed_at || x.kickoff_scheduled || x.kickoff_scheduled_at) {
    x.contract_completed_at = x.contract_completed_at ?? x.kickoff_completed_at ?? x.kickoff_scheduled_at ?? x.last_activity_at ?? new Date().toISOString();
    x.contract_signed = true;
  }

  return x;
}

function riskLevel(c: any): "low" | "normal" | "medium" | "high" {
  if (isStepDone(c, 7)) return "low";
  const sent = c.onboarding_sent_at ? new Date(c.onboarding_sent_at).getTime() : null;
  const last = c.last_activity_at ? new Date(c.last_activity_at).getTime() : sent;
  const now = Date.now();
  const notStarted = completedCount(c) === 0;
  if (notStarted && sent && now - sent > 48 * 3600 * 1000) return "high";
  if (notStarted && sent && now - sent > 24 * 3600 * 1000) return "medium";
  if (last && now - last > 48 * 3600 * 1000) return "high";
  if (last && now - last > 24 * 3600 * 1000) return "medium";
  return "normal";
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { client_code, force } = await req.json();
    if (!client_code) {
      return new Response(JSON.stringify({ error: 'client_code required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: c, error } = await supabase
      .from('client_progress')
      .select('*')
      .eq('client_code', client_code)
      .maybeSingle();
    if (error) throw error;
    if (!c) {
      return new Response(JSON.stringify({ error: 'client not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const normalized = normalizeProgressState(c);
    const idx = currentStepIndex(normalized);
    const step = STEPS[idx];
    const total = STEPS.length;
    const done = completedCount(normalized);
    const progress_percent = Math.round((done / total) * 1000) / 10;

    const paid = Boolean(normalized.payment_completed_at || normalized.paid);
    const signed = Boolean(normalized.contract_completed_at || normalized.contract_signed);
    const kickoff = Boolean(normalized.kickoff_completed_at || normalized.kickoff_scheduled || normalized.kickoff_scheduled_at);

    const company_name = c.company_name ?? c.brand_name ?? c.client_name ?? null;

    const isDone = step.key === "done" || Boolean(normalized.completed_at);

    const payload: Record<string, unknown> = isDone
      ? { company_name }
      : {
          event_type: "onboarding_step_updated",
          client_id: c.client_id ?? c.client_code,
          client_code: c.client_code,
          client_name: c.client_name ?? null,
          company_name,
          deal_value: c.deal_value ?? null,
          current_step: done,
          current_step_index: idx,
          total_steps: total,
          current_step_name: step.label,
          current_step_key: step.key,
          progress_percent,
          payment_status: paid ? "paid" : "pending",
          contract_status: signed ? "signed" : "pending",
          kickoff_status: kickoff ? "booked" : "not_booked",
          last_activity_at: c.last_activity_at ?? new Date().toISOString(),
          risk_level: riskLevel(c),
          next_action: NEXT_ACTIONS[step.key] ?? "",
          admin_dashboard_url: `https://testtdia.lovable.app/admin/clients/${c.client_code}`,
        };

    // Dedupe: skip if the last sent payload for this client has the same step + statuses
    if (!force) {
      const { data: lastLog } = await supabase
        .from('client_activity_log')
        .select('details')
        .eq('client_code', client_code)
        .eq('event_type', 'step_progress_webhook')
        .eq('status', 'ok')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      const prev = (lastLog?.details as any)?.snapshot;
      if (prev
        && prev.current_step_key === payload.current_step_key
        && prev.payment_status === payload.payment_status
        && prev.contract_status === payload.contract_status
        && prev.kickoff_status === payload.kickoff_status) {
        return new Response(JSON.stringify({ skipped: true, reason: 'no_change' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    let slackOk = false;
    let slackError: string | null = null;

    if (isDone) {
      // Final completion uses the dedicated notify-onboarding-complete function elsewhere.
      slackOk = true;
    } else {
      const token = Deno.env.get('SLACK_BOT_TOKEN');
      if (!token) {
        slackError = 'SLACK_BOT_TOKEN missing';
      } else {
        const p = payload as any;
        const text = [
          `🚀 *Progression onboarding client*`,
          ``,
          `*Client ID :* ${p.client_id ?? '—'}`,
          ``,
          `*Entreprise :* ${p.company_name ?? '—'}`,
          ``,
          `*Client :* ${p.client_name ?? '—'}`,
          ``,
          `*Deal value :* ${p.deal_value ?? '—'}$ / mois`,
          ``,
          `*Progression :* ${p.progress_percent}%`,
          ``,
          `*Étape actuelle :* ${p.current_step}/${p.total_steps} — ${p.current_step_name}`,
          ``,
          `*Dernière activité :* ${p.last_activity_at}`,
          ``,
          `*Paiement :* ${p.payment_status}`,
          ``,
          `*Contrat :* ${p.contract_status}`,
          ``,
          `*Appel démarrage :* ${p.kickoff_status}`,
          ``,
          `*Statut risque :* ${p.risk_level}`,
          ``,
          `*Action recommandée :* ${p.next_action}`,
          ``,
          `🔗 ${p.admin_dashboard_url}`,
        ].join('\n');

        const res = await fetch('https://slack.com/api/chat.postMessage', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json; charset=utf-8',
          },
          body: JSON.stringify({ channel: SLACK_CHANNEL, text, mrkdwn: true }),
        });
        const data = await res.json().catch(() => ({}));
        slackOk = res.ok && data?.ok === true;
        if (!slackOk) slackError = data?.error || `HTTP ${res.status}`;
      }
    }

    await supabase.from('client_activity_log').insert({
      client_code,
      event_type: 'step_progress_webhook',
      status: slackOk ? 'ok' : 'error',
      error: slackOk ? null : slackError,
      details: {
        snapshot: {
          current_step_key: step.key,
          payment_status: paid ? "paid" : "pending",
          contract_status: signed ? "signed" : "pending",
          kickoff_status: kickoff ? "booked" : "not_booked",
          progress_percent,
        },
      },
    });

    return new Response(JSON.stringify({ success: slackOk, payload, slackError }), {
      status: slackOk ? 200 : 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('notify-step-progress error:', err);
    return new Response(JSON.stringify({ error: err?.message || 'unknown' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
