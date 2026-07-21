// gos-ai-automation: run a Lovable AI-powered automation for a client
// Persists the run to gos_ai_automation_runs and returns the result.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type AutomationType =
  | "weekly_exec_summary"
  | "creative_brief_ideas"
  | "wayfinder_prep"
  | "portfolio_insights"
  | "custom_prompt";

const SYSTEM_PROMPTS: Record<AutomationType, string> = {
  weekly_exec_summary:
    "Tu es un stratège growth. Rédige un rapport hebdomadaire exécutif structuré en français (Highlights, Défis, Décisions, Prochaine semaine). Reste concis, factuel, orienté action.",
  creative_brief_ideas:
    "Tu es un directeur créatif performance. Propose 5 angles créatifs (statique/vidéo/UGC) alignés avec le contexte fourni. Format Markdown, chaque angle avec: Angle · Audience · Hook · Format · Métrique cible.",
  wayfinder_prep:
    "Tu es un coach de business review. Prépare un ordre du jour Wayfinder Wednesday en français avec 5 sections: Wins, Losers, Hypothèses testées, Prochaines expérimentations, Décisions à prendre. Sois direct.",
  portfolio_insights:
    "Tu es un analyste portfolio agence. Fournis 3 insights transverses et 3 alertes pour le portefeuille client. Format court, Markdown.",
  custom_prompt:
    "Tu es l'assistant growth du client. Réponds de manière structurée et actionnable en français.",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization") ?? "";
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

  if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY missing" }, 500);

  const authed = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: authHeader } },
  });
  const svc = createClient(SUPABASE_URL, SERVICE);

  const { data: userData, error: userErr } = await authed.auth.getUser();
  if (userErr || !userData?.user) return json({ error: "unauthorized" }, 401);
  const userId = userData.user.id;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  const {
    client_id,
    automation_type,
    title,
    prompt,
    context = {},
    model = "google/gemini-2.5-flash",
  } = body as {
    client_id?: string;
    automation_type?: AutomationType;
    title?: string;
    prompt?: string;
    context?: Record<string, unknown>;
    model?: string;
  };

  if (!client_id || !automation_type) return json({ error: "client_id and automation_type required" }, 400);
  if (!(automation_type in SYSTEM_PROMPTS)) return json({ error: "unknown automation_type" }, 400);

  // Check membership via authed client (RLS on gos_clients)
  const { data: client, error: cerr } = await authed
    .from("gos_clients")
    .select("id, company_name, business_type, current_phase, risk_level, industry")
    .eq("id", client_id)
    .maybeSingle();
  if (cerr || !client) return json({ error: "client not accessible" }, 403);

  // Create pending run row
  const { data: runRow, error: insErr } = await svc
    .from("gos_ai_automation_runs")
    .insert({
      client_id,
      automation_type,
      title: title ?? automation_type,
      input: { prompt, context },
      model,
      status: "running",
      created_by: userId,
    })
    .select("id")
    .single();
  if (insErr || !runRow) return json({ error: insErr?.message ?? "insert failed" }, 500);

  const runId = runRow.id;
  const t0 = Date.now();

  const systemPrompt = SYSTEM_PROMPTS[automation_type as AutomationType];
  const userPrompt = [
    prompt?.trim() || "(aucune instruction supplémentaire fournie)",
    "\n\nContexte client:",
    JSON.stringify({ client, extra: context }, null, 2),
  ].join("\n");

  try {
    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (aiRes.status === 429) {
      await svc.from("gos_ai_automation_runs")
        .update({ status: "error", error: "rate limited", duration_ms: Date.now() - t0 })
        .eq("id", runId);
      return json({ error: "Rate limit — réessaie dans un moment." }, 429);
    }
    if (aiRes.status === 402) {
      await svc.from("gos_ai_automation_runs")
        .update({ status: "error", error: "insufficient credits", duration_ms: Date.now() - t0 })
        .eq("id", runId);
      return json({ error: "Crédits IA insuffisants dans Lovable AI." }, 402);
    }
    if (!aiRes.ok) {
      const t = await aiRes.text();
      await svc.from("gos_ai_automation_runs")
        .update({ status: "error", error: `${aiRes.status}: ${t.slice(0, 500)}`, duration_ms: Date.now() - t0 })
        .eq("id", runId);
      return json({ error: "AI gateway error", detail: t }, 500);
    }

    const data = await aiRes.json();
    const text: string = data?.choices?.[0]?.message?.content ?? "";
    const usage = data?.usage ?? {};

    await svc.from("gos_ai_automation_runs")
      .update({
        status: "completed",
        output: data,
        output_text: text,
        tokens_input: usage.prompt_tokens ?? null,
        tokens_output: usage.completion_tokens ?? null,
        duration_ms: Date.now() - t0,
      })
      .eq("id", runId);

    return json({ id: runId, output_text: text, model, usage });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await svc.from("gos_ai_automation_runs")
      .update({ status: "error", error: msg, duration_ms: Date.now() - t0 })
      .eq("id", runId);
    return json({ error: msg }, 500);
  }
});
