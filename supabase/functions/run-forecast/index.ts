// TDIA Intelligence Engine — forecast (v1.0). Mirror of upstream repo.
import { z } from "npm:zod@3.25.76";
import {
  corsHeaders, json, errorStatus, toErrorPayload,
  ModelValidationError, insertModelRun, clamp, roundTo,
} from "../_shared/tdiaEngine.ts";

const MODEL = { model_name: "forecast_engine", version: "v1.0" } as const;

const cc = (max: number) => z.number().min(0).max(max);
const inputSchema = z.object({
  client_id: z.string().uuid(),
  forecast_name: z.string().min(1),
  selected_hypotheses: z.array(z.object({
    hypothesis_id: z.string().uuid(),
    expected_lift_min: z.number(),
    expected_lift_base: z.number(),
    expected_lift_max: z.number(),
  }).strict()).min(1),
  overlap_discount: z.union([z.literal(0.5), z.literal(0.7), z.literal(0.85)]).default(0.7),
  timeline: z.string(),
  conditions: z.string(),
  risks: z.string(),
  dependencies: z.string(),
  confidence_components: z.object({
    data_quality_score: cc(20),
    evidence_strength_score: cc(20),
    goal_alignment_score: cc(20),
    execution_readiness_score: cc(15),
    tracking_confidence_score: cc(10),
    historical_similarity_score: cc(10),
    risk_penalty: cc(15),
    dependency_penalty: cc(15),
  }).strict(),
}).strict();
type Input = z.output<typeof inputSchema>;

const FORMULA = {
  model_name: MODEL.model_name,
  model_version: MODEL.version,
  formulas: {
    forecast_lift_low: "sum(expected_lift_min) * overlap_discount",
    forecast_lift_base: "sum(expected_lift_base) * overlap_discount",
    forecast_lift_high: "sum(expected_lift_max) * overlap_discount",
    confidence_score: "data_quality_score + evidence_strength_score + goal_alignment_score + execution_readiness_score + tracking_confidence_score + historical_similarity_score - risk_penalty - dependency_penalty, clamped 0-100",
  },
  confidence_labels: { "0-49": "Low", "50-69": "Medium", "70-84": "High", "85-100": "Very High / Rare" },
  required_summary_text: "This is a conditional forecast, not a guarantee.",
};

function label(s: number) {
  if (s < 50) return "Low";
  if (s < 70) return "Medium";
  if (s < 85) return "High";
  return "Very High / Rare";
}

function compute(i: Input) {
  const sumMin = i.selected_hypotheses.reduce((a, h) => a + h.expected_lift_min, 0);
  const sumBase = i.selected_hypotheses.reduce((a, h) => a + h.expected_lift_base, 0);
  const sumMax = i.selected_hypotheses.reduce((a, h) => a + h.expected_lift_max, 0);
  const c = i.confidence_components;
  const raw = c.data_quality_score + c.evidence_strength_score + c.goal_alignment_score +
    c.execution_readiness_score + c.tracking_confidence_score + c.historical_similarity_score -
    c.risk_penalty - c.dependency_penalty;
  const conf = roundTo(clamp(raw, 0, 100));
  const lbl = label(conf);
  return {
    model_name: MODEL.model_name,
    model_version: MODEL.version,
    forecast_lift_low: roundTo(sumMin * i.overlap_discount),
    forecast_lift_base: roundTo(sumBase * i.overlap_discount),
    forecast_lift_high: roundTo(sumMax * i.overlap_discount),
    confidence_score: conf,
    confidence_label: lbl,
    timeline: i.timeline,
    conditions: i.conditions,
    risks: i.risks,
    dependencies: i.dependencies,
    forecast_summary: `This is a conditional forecast, not a guarantee. Forecast Confidence Score is ${conf} (${lbl}) for the stated timeline, conditions, risks, and dependencies.`,
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
