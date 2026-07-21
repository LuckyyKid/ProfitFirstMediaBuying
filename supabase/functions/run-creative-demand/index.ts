// TDIA Intelligence Engine — creative demand (v1.0). Mirror of upstream repo.
import { z } from "npm:zod@3.25.76";
import {
  corsHeaders, json, errorStatus, toErrorPayload,
  ModelValidationError, insertModelRun,
} from "../_shared/tdiaEngine.ts";

const MODEL = { model_name: "creative_demand_engine", version: "v1.0" } as const;

const inputSchema = z.object({
  client_id: z.string().uuid(),
  planned_meta_spend: z.number().min(0),
  current_top_3_ads_spend_share: z.number().min(0).max(1),
  frequency: z.number().min(0),
  new_creatives_last_30d: z.number().int().min(0),
  active_ads: z.number().int().min(0),
  priority_angles: z.array(z.string()),
  priority_products: z.array(z.string()),
}).strict();
type Input = z.output<typeof inputSchema>;
type Risk = "Low" | "Medium" | "High";

const FORMULA = {
  model_name: MODEL.model_name,
  model_version: MODEL.version,
  risk_rules: {
    concentration_risk: [
      "current_top_3_ads_spend_share > 0.60 => High",
      "0.40 <= current_top_3_ads_spend_share <= 0.60 => Medium",
      "current_top_3_ads_spend_share < 0.40 => Low",
    ],
    fatigue_risk: ["frequency > 5 => High", "3 <= frequency <= 5 => Medium", "frequency < 3 => Low"],
    supply_risk: [
      "new_creatives_last_30d = 0 => High",
      "new_creatives_last_30d < 8 => Medium",
      "new_creatives_last_30d >= 8 => Low",
    ],
  },
  deterministic_range_resolution: {
    High: "Use the upper bound of the required 16-24 range: 24.",
    Medium: "Use the upper bound of the required 8-16 range: 16.",
    Low: "Use the upper bound of the required 4-8 range: 8.",
  },
  split: "60% video and 40% static, rounded to nearest whole number.",
};

const concRisk = (s: number): Risk => s > 0.6 ? "High" : s >= 0.4 ? "Medium" : "Low";
const fatRisk = (f: number): Risk => f > 5 ? "High" : f >= 3 ? "Medium" : "Low";
const supRisk = (n: number): Risk => n === 0 ? "High" : n < 8 ? "Medium" : "Low";
const overall = (rs: Risk[]): Risk => rs.includes("High") ? "High" : rs.includes("Medium") ? "Medium" : "Low";
const countFor = (r: Risk) => r === "High" ? 24 : r === "Medium" ? 16 : 8;

function compute(i: Input) {
  const c = concRisk(i.current_top_3_ads_spend_share);
  const f = fatRisk(i.frequency);
  const s = supRisk(i.new_creatives_last_30d);
  const o = overall([c, f, s]);
  const total = countFor(o);
  const videos = Math.round(total * 0.6);
  const statics = Math.round(total * 0.4);
  return {
    model_name: MODEL.model_name,
    model_version: MODEL.version,
    concentration_risk: c, fatigue_risk: f, supply_risk: s, overall_creative_risk: o,
    total_creatives_needed: total, videos_needed: videos, statics_needed: statics,
    priority_angles: i.priority_angles, priority_products: i.priority_products,
    rationale: `Overall creative risk is ${o}. Recommended output uses the upper bound of the specified ${o === "High" ? "16-24" : o === "Medium" ? "8-16" : "4-8"} range and splits production 60% video / 40% static.`,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed. Use POST." }, 405);
  try {
    const raw = await req.json();
    const parsed = inputSchema.safeParse(raw);
    if (!parsed.success) throw new ModelValidationError(parsed.error.issues.map((i) => ({ path: i.path.join(".") || "root", message: i.message })));
    const input = parsed.data;
    const output = compute(input);
    const insert = await insertModelRun({
      client_id: input.client_id,
      model_name: MODEL.model_name,
      model_version: MODEL.version,
      input_json: input,
      output_json: output,
      formula_used: FORMULA,
      generated_by: req.headers.get("x-tdia-user") ?? "supabase_edge_function",
    });
    if (!insert.inserted && !insert.skipped) return json({ error: "model_runs insert failed.", details: insert, output }, 500);
    return json({ output, model_run: insert.inserted ? insert.row : null });
  } catch (e) {
    return json(toErrorPayload(e), errorStatus(e));
  }
});
