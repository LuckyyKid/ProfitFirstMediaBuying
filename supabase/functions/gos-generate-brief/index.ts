// Ultimate Creative Brief generator — Lovable AI
// Takes a structured brief + business context + winner concepts and composes
// a production-ready creative brief in markdown.

import "https://deno.land/x/xhr@0.1.0/mod.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) return json({ error: "Missing LOVABLE_API_KEY" }, 500);

    const body = await req.json();
    const {
      client_name, objective, brief, business_context, winners, brand_voice,
    } = body ?? {};

    const winnersBlock = Array.isArray(winners) && winners.length
      ? winners.map((w: any, i: number) =>
        `Winner ${i + 1} — "${w.concept_name}" (${w.angle ?? "?"}, ${w.format ?? "?"})
  Hypothèse: ${w.hypothesis ?? "—"}
  Résultat: ${w.orders} orders @ CPA $${w.cpa ?? "—"}, ROAS ${w.roas ?? "—"}
  Apprentissage: ${w.learning ?? "—"}`).join("\n\n")
      : "Aucun winner documenté — s'appuyer sur les hypothèses.";

    const systemPrompt = `Tu es un Creative Strategist senior spécialisé DTC / performance. Tu produis des briefs créatifs actionnables, non-générique, ancrés dans le contexte business.

Ton output DOIT :
1. Suivre EXACTEMENT la structure demandée en markdown.
2. Être écrit en français.
3. Être concret, spécifique, exploitable par un créatif junior sans questions.
4. Refléter les insights des winners si fournis.
5. Ne PAS inventer de faits ; si une info manque, écrire "à préciser".`;

    const userPrompt = `# Contexte
Client: ${client_name ?? "—"}
Voix de marque: ${brand_voice ?? "à préciser"}

# Objectif business lié
${objective ? `${objective.label} — KPI: ${objective.primary_kpi}, cible: ${objective.target_value ?? "—"}
Rationale: ${objective.rationale ?? "—"}` : "Aucun objectif lié"}

# Contexte business
${business_context ?? "—"}

# Winners du Concept Log
${winnersBlock}

# Brief brut à composer
- Titre: ${brief.title}
- Audience cible: ${brief.target_audience ?? "—"}
- Pains: ${brief.audience_pains ?? "—"}
- Désirs: ${brief.audience_desires ?? "—"}
- Big idea: ${brief.big_idea ?? "—"}
- Promesse: ${brief.core_promise ?? "—"}
- Proof points: ${brief.proof_points ?? "—"}
- Offre: ${brief.offer ?? "—"}
- Mandatories: ${brief.mandatory_elements ?? "—"}
- Do not use: ${brief.do_not_use ?? "—"}
- Formats: ${(brief.formats ?? []).join(", ") || "—"}
- Plateformes: ${(brief.platforms ?? []).join(", ") || "—"}
- Nb livrables: ${brief.deliverables_count ?? 1}

# Structure attendue (markdown)

## 🎯 Contexte & objectif
## 👤 Cible & insight consommateur
## 💡 Big idea (une phrase)
## 🗣️ Promesse & angle de communication
## 📐 Structure narrative recommandée (hook / body / CTA)
## 🎬 Directions créatives (2-3 pistes concrètes)
## ✅ Mandatories
## ❌ À éviter
## 📦 Livrables & formats
## 🧪 Ce qu'on cherche à valider (hypothèse mesurable)
## 📚 Références (winners internes + benchmarks)`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      if (res.status === 429) return json({ error: "Rate limit — réessaie dans un instant." }, 429);
      if (res.status === 402) return json({ error: "Crédits AI épuisés. Ajoute des crédits dans Settings → Usage." }, 402);
      return json({ error: `AI Gateway error: ${errText}` }, 500);
    }

    const data = await res.json();
    const generated = data?.choices?.[0]?.message?.content ?? "";
    return json({ generated });
  } catch (e: any) {
    return json({ error: e.message ?? "Unknown error" }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
