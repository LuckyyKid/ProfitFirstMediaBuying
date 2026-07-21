// Scheduled (pg_cron, hourly):
//  1. Si client bloqué > 24h sur la même étape et aucune relance → envoie un email de suivi.
//  2. Si une relance a été envoyée, > 24h plus tard l'étape n'a pas bougé → marque "à rappeler" (callback_due_at).
//  3. Si le client a avancé d'étape → reset des compteurs de suivi.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { renderFollowUpEmail } from "../_shared/email-design.ts";
import { sendResendEmail } from "../_shared/resend.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ONBOARDING_BASE = "https://tdiaonboarding.lovable.app";
const FROM = Deno.env.get("EMAIL_FROM") || "TDIA <onboarding@resend.dev>";


const STEP_NAMES = [
  "Bienvenue",
  "Accès plateformes",
  "Formulaire",
  "Founder Scan",
  "Paiement",
  "Contrat",
  "Appel démarrage",
];


serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("Missing RESEND_API_KEY");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Optional: target a single client (admin "send follow-up now" button)
    let forceClientCode: string | null = null;
    if (req.method === "POST") {
      try {
        const b = await req.json();
        if (b && typeof b.client_code === "string") forceClientCode = b.client_code;
      } catch { /* no body */ }
    }

    const now = Date.now();
    const cutoff = new Date(now - 24 * 3600 * 1000).toISOString();

    let query = supabase
      .from("client_progress")
      .select("client_code, email, client_name, company_name, phone, current_step, updated_at, completed_at, archived_at, followup_sent_at, followup_count, followup_step, callback_due_at, callback_notified_at, slack_invite_url, slack_channel_name");
    if (forceClientCode) {
      query = query.eq("client_code", forceClientCode);
    } else {
      query = query.is("completed_at", null).is("archived_at", null);
    }
    const { data, error } = await query;
    if (error) throw error;

    let sent = 0, callbacks = 0, reset = 0, slackPosted = 0;
    for (const c of data ?? []) {
      const currentStep = c.current_step ?? 1;

      // Cas A : le client a avancé depuis la dernière relance → reset du suivi
      if (!forceClientCode && c.followup_sent_at && c.followup_step != null && currentStep !== c.followup_step) {
        await supabase
          .from("client_progress")
          .update({ followup_sent_at: null, followup_step: null, callback_due_at: null, callback_notified_at: null })
          .eq("client_code", c.client_code);
        reset++;
        continue;
      }

      // Cas B : relance déjà envoyée, > 24h, étape inchangée, pas encore "à rappeler"
      if (!forceClientCode && c.followup_sent_at && !c.callback_due_at && new Date(c.followup_sent_at).getTime() < now - 24 * 3600 * 1000) {
        await supabase
          .from("client_progress")
          .update({ callback_due_at: new Date().toISOString() })
          .eq("client_code", c.client_code);
        callbacks++;
        // Notify #head-of-things on Slack (once)
        const posted = await notifyHeadOfThings(supabase, c);
        if (posted) slackPosted++;
        continue;
      }

      // Cas D : déjà "à rappeler" mais notification Slack pas encore envoyée (rattrapage)
      if (!forceClientCode && c.callback_due_at && !c.callback_notified_at) {
        const posted = await notifyHeadOfThings(supabase, c);
        if (posted) slackPosted++;
      }


      // Cas C : pas de relance encore, et stuck > 24h → envoie la relance
      // En mode "force" (déclenché par l'admin), on bypasse les conditions de temps / followup_sent_at.
      const shouldSend = forceClientCode
        ? !!c.email
        : (!c.followup_sent_at && c.email && c.updated_at && c.updated_at < cutoff);
      if (shouldSend) {
        const link = `${ONBOARDING_BASE}/?client=${encodeURIComponent(c.client_code)}`;
        // Look up payment URL (only show "Payer maintenant" if not yet paid)
        let paymentUrl: string | null = null;
        try {
          const { data: deal } = await supabase
            .from("closed_deals")
            .select("stripe_payment_url, stripe_payment_status")
            .eq("client_code", c.client_code)
            .maybeSingle();
          if (deal && (deal as any).stripe_payment_status !== "paid" && (deal as any).stripe_payment_url) {
            paymentUrl = (deal as any).stripe_payment_url;
          }
        } catch { /* ignore */ }

        const html = renderFollowUpEmail({
          contactName: c.client_name,
          companyName: c.company_name,
          currentStep,
          stepNames: STEP_NAMES,
          resumeUrl: link,
          slackInviteUrl: c.slack_invite_url,
          slackChannelName: c.slack_channel_name,
          paymentUrl,
        });

        try {
          await sendResendEmail({ apiKey: RESEND_API_KEY, from: FROM, to: c.email, subject: "On peut vous aider à finaliser votre onboarding TDIA ?", html });
          await supabase
            .from("client_progress")
            .update({
              followup_sent_at: new Date().toISOString(),
              followup_step: currentStep,
              followup_count: (c.followup_count ?? 0) + 1,
              callback_due_at: null,
            })
            .eq("client_code", c.client_code);
          sent++;
        } catch (e) {
          console.warn("[follow-up]", c.client_code, (e as Error).message);
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, scanned: data?.length ?? 0, sent, callbacks, reset, slackPosted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function formatDuration(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  if (h < 48) return `${h}h`;
  const d = Math.floor(h / 24);
  const rem = h % 24;
  return rem ? `${d}j ${rem}h` : `${d}j`;
}

async function notifyHeadOfThings(supabase: any, c: any): Promise<boolean> {
  const token = Deno.env.get("SLACK_BOT_TOKEN");
  if (!token) {
    console.warn("[head-of-things] SLACK_BOT_TOKEN missing");
    return false;
  }
  try {
    const stepName = STEP_NAMES[(c.current_step ?? 1) - 1] ?? `Étape ${c.current_step}`;
    const stuckMs = c.updated_at ? (Date.now() - new Date(c.updated_at).getTime()) : 0;
    const stuckLabel = stuckMs > 0 ? formatDuration(stuckMs) : "—";

    // Recent actions on this client
    const { data: logs } = await supabase
      .from("client_activity_log")
      .select("event_type, status, created_at")
      .eq("client_code", c.client_code)
      .order("created_at", { ascending: false })
      .limit(8);

    const actionsList = (logs ?? []).length
      ? (logs ?? []).map((l: any) => {
          const ts = new Date(l.created_at).toLocaleString("fr-FR", { timeZone: "America/Toronto" });
          const flag = l.status === "ok" ? "✅" : l.status === "error" ? "⚠️" : "•";
          return `${flag} ${ts} — ${l.event_type}`;
        }).join("\n")
      : "_aucune action enregistrée_";

    const text = [
      `📞 *Client à rappeler — action manuelle requise*`,
      ``,
      `*Client :* ${c.client_name ?? "—"} (${c.client_code})`,
      `*Entreprise :* ${c.company_name ?? "—"}`,
      `*Téléphone :* ${c.phone ? `<tel:${c.phone}|${c.phone}>` : "_non renseigné_"}`,
      `*Email :* ${c.email ?? "—"}`,
      ``,
      `*Bloqué sur :* Étape ${c.current_step}/${STEP_NAMES.length} — ${stepName}`,
      `*Durée d'inactivité :* ${stuckLabel}`,
      `*Relances email envoyées :* ${c.followup_count ?? 0}`,
      ``,
      `*Historique récent des actions :*`,
      actionsList,
      ``,
      `🔗 https://tdiaonboarding.lovable.app/admin`,
    ].join("\n");

    const res = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({ channel: "head-of-things", text, mrkdwn: true }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) {
      console.warn("[head-of-things] post failed:", data?.error || res.status);
      await supabase.from("client_activity_log").insert({
        client_code: c.client_code,
        event_type: "callback_slack_notify",
        status: "error",
        error: data?.error || `HTTP ${res.status}`,
      });
      return false;
    }
    await supabase
      .from("client_progress")
      .update({ callback_notified_at: new Date().toISOString() })
      .eq("client_code", c.client_code);
    await supabase.from("client_activity_log").insert({
      client_code: c.client_code,
      event_type: "callback_slack_notify",
      status: "ok",
      details: { channel: "head-of-things", stuck_label: stuckLabel },
    });
    return true;
  } catch (e) {
    console.warn("[head-of-things] exception:", (e as Error).message);
    return false;
  }
}

