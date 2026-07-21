import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { client_code } = await req.json();
    if (!client_code) throw new Error("client_code required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: answers, error } = await supabase
      .from("client_form_answers")
      .select("*")
      .eq("client_code", client_code)
      .eq("form_type", "founder_scan")
      .order("created_at", { ascending: true });
    if (error) throw error;
    if (!answers || answers.length === 0) {
      return new Response(JSON.stringify({ error: "no founder_scan answers" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const formatted = answers
      .map((a) => `Q: ${a.question_label}\nR: ${a.answer ?? "—"}`)
      .join("\n\n");

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "Tu es un account manager senior chez TDIA. À partir des réponses du Founder Scan d'un client, génère un résumé interne JSON strict avec ces clés exactes: communication_style, detail_level, feedback_availability, involvement_level, relationship_risk, recommendations. Chaque valeur est une string concise (max 2 phrases). Réponds UNIQUEMENT avec le JSON.",
          },
          { role: "user", content: formatted },
        ],
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      throw new Error(`AI gateway ${aiRes.status}: ${errText}`);
    }
    const aiData = await aiRes.json();
    let content = aiData.choices?.[0]?.message?.content ?? "{}";
    content = content.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
    let summary: Record<string, string> = {};
    try {
      summary = JSON.parse(content);
    } catch {
      summary = { raw: content };
    }

    await supabase
      .from("client_progress")
      .update({ founder_summary: summary })
      .eq("client_code", client_code);

    return new Response(JSON.stringify({ success: true, summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
