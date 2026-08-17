// meeting-scheduled — endpoint d'ingestion externe.
//
// Reçoit un POST depuis une app tierce quand un employé soumet le formulaire
// "créer un meeting". Objectif : capturer client_id + date + heure du RDV
// pour les afficher dans l'admin de cette app.
//
// URL publique :
//   POST https://gcgwcjeryahysjwfznww.supabase.co/functions/v1/meeting-scheduled
//
// Auth : header X-Meeting-Token qui doit matcher l'env MEETING_INGEST_TOKEN.
//
// Payload accepté (deux formes) :
//   { "client_id": "CLI-XXXX", "date": "2026-08-20", "time": "14:30" }
//   { "client_id": "CLI-XXXX", "scheduled_at": "2026-08-20T14:30:00-04:00" }
//
// Si date+time séparés, on interprète en TZ America/Toronto (DST auto-géré).
//
// verify_jwt = false (voir config.toml). L'auth du call est faite par le
// header X-Meeting-Token — l'app émettrice le stocke côté serveur.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-meeting-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Calcule l'offset UTC pour une date donnée en America/Toronto (gère DST).
// Ex: torontoOffset("2026-08-20") → "-04:00" (EDT), "2026-12-15" → "-05:00" (EST).
function torontoOffset(dateStr: string): string {
  const probe = new Date(`${dateStr}T12:00:00Z`);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Toronto",
    timeZoneName: "shortOffset",
  }).formatToParts(probe);
  const off = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT-05:00";
  const m = off.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!m) return "-05:00";
  return `${m[1]}${m[2].padStart(2, "0")}:${m[3] ?? "00"}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

  // ─── Auth par header partagé ─────────────────────────────────────────────
  const expected = Deno.env.get("MEETING_INGEST_TOKEN");
  if (!expected) {
    console.error("[meeting-scheduled] MEETING_INGEST_TOKEN not configured");
    return json({ ok: false, error: "server_misconfigured" }, 500);
  }
  const provided = req.headers.get("x-meeting-token") ?? "";
  if (provided !== expected) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  // ─── Parse body ──────────────────────────────────────────────────────────
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const clientId = String(body.client_id ?? "").trim();
  if (!clientId) return json({ ok: false, error: "client_id_required" }, 400);

  // Résout scheduled_at depuis (scheduled_at direct) ou (date + time)
  let scheduledAt: Date;
  const scheduledIso = String(body.scheduled_at ?? "").trim();
  if (scheduledIso) {
    scheduledAt = new Date(scheduledIso);
    if (isNaN(scheduledAt.getTime())) {
      return json({ ok: false, error: "scheduled_at_invalid" }, 400);
    }
  } else {
    const date = String(body.date ?? "").trim();
    const time = String(body.time ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return json({ ok: false, error: "date_invalid_format", expected: "YYYY-MM-DD" }, 400);
    }
    if (!/^\d{2}:\d{2}(:\d{2})?$/.test(time)) {
      return json({ ok: false, error: "time_invalid_format", expected: "HH:MM" }, 400);
    }
    const t = time.length === 5 ? `${time}:00` : time;
    scheduledAt = new Date(`${date}T${t}${torontoOffset(date)}`);
    if (isNaN(scheduledAt.getTime())) {
      return json({ ok: false, error: "date_time_combination_invalid" }, 400);
    }
  }

  const source = String(body.source ?? "external_webhook").trim().slice(0, 100);

  // ─── Insert ─────────────────────────────────────────────────────────────
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data, error } = await supabase
    .from("client_meetings")
    .insert({
      client_code: clientId,
      scheduled_at: scheduledAt.toISOString(),
      source,
      payload_raw: body,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[meeting-scheduled] insert failed", error.message);
    return json({ ok: false, error: "insert_failed", detail: error.message }, 500);
  }

  // Le cycle NPS hebdo est orchestré par pulse-weekly-scheduler (cron toutes
  // les 15 min) : envoi initial à T-48h, suivis toutes les 24h, ping Slack
  // #client-nps le jour du meeting si non-répondu. Rien à déclencher ici.

  return json({
    ok: true,
    id: data.id,
    client_code: clientId,
    scheduled_at: scheduledAt.toISOString(),
  });
});
