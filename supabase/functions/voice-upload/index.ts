// Voice onboarding upload endpoint.
// Accepts a multipart form with an audio blob (or a text fallback) and upserts a row
// in voice_answers. Runs with service_role so the client never touches the bucket.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUCKET = "onboarding-voice";

const ALLOWED_FORMS = new Set(["welcome", "founder_scan", "business_deep_dive"]);
const ALLOWED_STATUS = new Set(["complete", "short", "text_fallback", "missing", "skipped"]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function extFromMime(mime: string): string {
  if (!mime) return "bin";
  if (mime.includes("webm")) return "webm";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("mp4") || mime.includes("m4a") || mime.includes("aac")) return "m4a";
  if (mime.includes("mpeg")) return "mp3";
  if (mime.includes("wav")) return "wav";
  return "bin";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let form: FormData;
  try {
    form = await req.formData();
  } catch (_e) {
    return json({ error: "invalid_multipart" }, 400);
  }

  const clientCode = (form.get("client_code") as string | null)?.trim() ?? "";
  const formKey = (form.get("form_key") as string | null)?.trim() ?? "";
  const questionId = (form.get("question_id") as string | null)?.trim() ?? "";
  const durationMs = Number(form.get("duration_ms") ?? 0) | 0;
  const rawStatus = (form.get("status") as string | null) ?? "complete";
  const status = ALLOWED_STATUS.has(rawStatus) ? rawStatus : "complete";
  const writtenFallback = (form.get("written_fallback") as string | null) ?? null;
  const ambientWarn = (form.get("ambient_noise_warning") as string | null) === "true";
  let targetFieldIds: unknown = [];
  try {
    const raw = form.get("target_field_ids");
    if (typeof raw === "string" && raw.length > 0) targetFieldIds = JSON.parse(raw);
  } catch (_e) {
    return json({ error: "invalid_target_field_ids" }, 400);
  }
  const audio = form.get("audio") as File | null;

  if (!clientCode) return json({ error: "missing_client_code" }, 400);
  if (!ALLOWED_FORMS.has(formKey)) return json({ error: "invalid_form_key" }, 400);
  if (!questionId) return json({ error: "missing_question_id" }, 400);
  if (!audio && !writtenFallback && status !== "skipped" && status !== "missing") {
    return json({ error: "missing_payload" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return json({ error: "missing_service_credentials" }, 500);
  const admin = createClient(supabaseUrl, serviceKey);

  let audioPath: string | null = null;
  let audioMime: string | null = null;

  if (audio) {
    const mime = audio.type || "audio/webm";
    const ext = extFromMime(mime);
    const safeQ = questionId.replace(/[^a-zA-Z0-9_-]/g, "_");
    audioPath = `${clientCode}/${formKey}/${safeQ}-${Date.now()}.${ext}`;
    audioMime = mime;
    const { error: upErr } = await admin.storage
      .from(BUCKET)
      .upload(audioPath, audio, { contentType: mime, upsert: true });
    if (upErr) return json({ error: "storage_upload_failed", detail: upErr.message }, 500);
  }

  const row = {
    client_code: clientCode,
    form_key: formKey,
    question_id: questionId,
    audio_bucket: audioPath ? BUCKET : null,
    audio_path: audioPath,
    audio_mime: audioMime,
    duration_ms: durationMs,
    status,
    written_fallback: writtenFallback,
    target_field_ids: targetFieldIds ?? [],
    ambient_noise_warning: ambientWarn,
    updated_at: new Date().toISOString(),
  };

  const { data, error: dbErr } = await admin
    .from("voice_answers")
    .upsert(row, { onConflict: "client_code,form_key,question_id" })
    .select("id, audio_path, status")
    .single();

  if (dbErr) return json({ error: "db_upsert_failed", detail: dbErr.message }, 500);

  await admin.from("client_activity_log").insert({
    client_code: clientCode,
    event_type: "voice_answer_saved",
    status: "ok",
    details: { form_key: formKey, question_id: questionId, duration_ms: durationMs, answer_status: status },
  }).then(() => null, (e) => console.error("activity log error:", e));

  return json({ ok: true, id: data.id, audio_path: data.audio_path, status: data.status });
});
