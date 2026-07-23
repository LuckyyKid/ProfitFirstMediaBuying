// Sends the seasonal broadcast emails (yearly 1:1 check-in, Christmas, New Year)
// to every non-archived client from `client_progress`.
//
// Triggered by pg_cron once a year per type. Each (client_code, type, year) pair
// is recorded in `seasonal_email_sends` so a re-run is a no-op.
//
// Manual invocation:
//   POST { "type": "yearly_checkin" | "christmas" | "new_year",
//          "dry_run"?: boolean,
//          "only_client_code"?: string,
//          "override_year"?: number }
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  renderYearlyCheckinEmail,
  renderChristmasEmail,
  renderNewYearEmail,
} from "../_shared/email-design.ts";
import { sendResendEmail } from "../_shared/resend.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type SeasonalType = "yearly_checkin" | "christmas" | "new_year";

const FROM = Deno.env.get("EMAIL_FROM") || "TDIA <onboarding@resend.dev>";
const CALENDLY_URL = "https://calendly.com/tdiaagency/30min";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("Missing RESEND_API_KEY");

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const type = body.type as SeasonalType | undefined;
    if (!type || !["yearly_checkin", "christmas", "new_year"].includes(type)) {
      throw new Error("`type` must be one of: yearly_checkin | christmas | new_year");
    }

    const dryRun: boolean = !!body.dry_run;
    const onlyClientCode: string | undefined = body.only_client_code;

    // "yearly" for a check-in sent in November/December means: current calendar year.
    // For January runs (edge case), we still want to reference the year that just ended.
    const now = new Date();
    const currentYear: number = body.override_year ?? now.getUTCFullYear();
    const nextYear = currentYear + 1;

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let query = sb
      .from("client_progress")
      .select("client_code, email, client_name, company_name, archived_at")
      .is("archived_at", null);
    if (onlyClientCode) query = query.eq("client_code", onlyClientCode);

    const { data: clients, error } = await query;
    if (error) throw error;

    // Filter out clients missing an email — we can't send anything to them.
    const targets = (clients ?? []).filter((c) => typeof c.email === "string" && c.email.includes("@"));

    // Load prior sends for this (type, year) so we don't double-send.
    const { data: already } = await sb
      .from("seasonal_email_sends")
      .select("client_code")
      .eq("type", type)
      .eq("year", currentYear);
    const skip = new Set((already ?? []).map((r: any) => r.client_code));

    const results: any[] = [];
    let sent = 0, skipped = 0, failed = 0;

    for (const c of targets) {
      if (skip.has(c.client_code)) {
        skipped++;
        results.push({ client_code: c.client_code, status: "skipped_already_sent" });
        continue;
      }

      const { subject, html } = buildEmail(type, {
        contactName: c.client_name,
        companyName: c.company_name,
        currentYear,
        nextYear,
      });

      if (dryRun) {
        results.push({ client_code: c.client_code, to: c.email, subject, status: "dry_run" });
        continue;
      }

      try {
        const r = await sendResendEmail({
          apiKey: RESEND_API_KEY,
          from: FROM,
          to: c.email,
          subject,
          html,
        });
        await sb.from("seasonal_email_sends").insert({
          client_code: c.client_code,
          recipient_email: c.email,
          type,
          year: currentYear,
          status: r.redirected ? "sent_sandbox" : "sent",
          email_id: r.id ?? null,
        });
        sent++;
        results.push({
          client_code: c.client_code,
          to: c.email,
          status: r.redirected ? "sent_sandbox" : "sent",
          email_id: r.id,
        });
      } catch (e) {
        const msg = (e as Error).message;
        await sb.from("seasonal_email_sends").insert({
          client_code: c.client_code,
          recipient_email: c.email,
          type,
          year: currentYear,
          status: "error",
          error: msg,
        });
        failed++;
        results.push({ client_code: c.client_code, to: c.email, status: "error", error: msg });
      }
    }

    return new Response(JSON.stringify({
      ok: true, type, year: currentYear, scanned: targets.length, sent, skipped, failed, dryRun, results,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function buildEmail(
  type: SeasonalType,
  p: { contactName?: string | null; companyName?: string | null; currentYear: number; nextYear: number },
): { subject: string; html: string } {
  if (type === "yearly_checkin") {
    return {
      subject: `${firstNameOf(p.contactName)}, on prend 30 min avant que ${p.currentYear} se termine ?`,
      html: renderYearlyCheckinEmail({ ...p, calendlyUrl: CALENDLY_URL }),
    };
  }
  if (type === "christmas") {
    return {
      subject: `Joyeux Noël de la part de toute l'équipe TDIA`,
      html: renderChristmasEmail(p),
    };
  }
  return {
    subject: `Que ${p.nextYear} soit à la hauteur de vos ambitions`,
    html: renderNewYearEmail(p),
  };
}

function firstNameOf(fullName?: string | null): string {
  const n = (fullName ?? "").trim().split(/\s+/)[0];
  return n || "bonjour";
}
