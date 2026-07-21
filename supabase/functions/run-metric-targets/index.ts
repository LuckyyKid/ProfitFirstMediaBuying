// TDIA Intelligence Engine — metric targets (v1.0). Mirror of upstream repo.
import { z } from "npm:zod@3.25.76";
import {
  corsHeaders, json, errorStatus, toErrorPayload,
  ModelValidationError, insertModelRun, pctInc, pctDec,
} from "../_shared/tdiaEngine.ts";

const MODEL = { model_name: "metric_targets_engine", version: "v1.0" } as const;

const nt = z.number().nullable();
const inputSchema = z.object({
  client_id: z.string().uuid(),
  forecast_id: z.string().uuid(),
  north_star_metric: z.string().min(1),
  baseline: z.object({
    revenue: z.number(), ad_spend: z.number(), mer: z.number(), cac: z.number(),
    aov: z.number(), new_customers: z.number(), returning_revenue: z.number(),
  }).strict(),
  forecast_lift_base: z.number(),
  goal: z.object({
    revenue_target: nt, cac_target: nt, mer_target: nt, new_customers_target: nt,
  }).strict(),
}).strict();
type Input = z.output<typeof inputSchema>;

const ACTION_RULES = [
  "If spend below target and efficiency above target -> Volume Problem",
  "If spend on target and CAC above target -> Efficiency Problem",
  "If CTR low and CAC high -> Creative / Message Issue",
  "If CTR good and CVR low -> CRO / Offer Issue",
  "If ROAS above target and spend below target -> Increase Volume",
  "If ROAS below target and spend high -> Reduce / Fix / Iterate",
];

const FORMULA = {
  model_name: MODEL.model_name,
  model_version: MODEL.version,
  rules: [
    "Explicit goal target wins when present.",
    "If no explicit target exists, projected targets are calculated only for the impacted metric using forecast_lift_base.",
    "CAC target improves by forecast_lift_base percent when CAC is the impacted metric.",
    "Revenue target is not invented without explicit AM input or spend/conversion assumptions.",
    "Channel targets are not invented without channel-level inputs.",
  ],
  action_rules: ACTION_RULES,
};

const norm = (s: string) => s.toLowerCase().replace(/[\s-]+/g, "_");
const has = (m: string, t: string) => m === t || m.includes(t);
const blank = (ch: string) => ({ spend_target: null, cac_target: null, roas_target: null, revenue_target: null, notes: `${ch} targets require channel-level baseline inputs.` });

function compute(i: Input) {
  const m = norm(i.north_star_metric);
  const missing: string[] = [];
  const push = (f: string, r: string) => missing.push(`${f}: ${r}`);

  const revenueTarget = i.goal.revenue_target;
  if (revenueTarget === null) push("revenue_target", "requires explicit AM input or supplied spend/conversion assumptions.");

  const merTarget = i.goal.mer_target ?? (has(m, "mer") ? pctInc(i.baseline.mer, i.forecast_lift_base) : null);
  if (merTarget === null) push("mer_target", "not explicit and MER is not the impacted metric.");

  const cacTarget = i.goal.cac_target ?? (has(m, "cac") ? pctDec(i.baseline.cac, i.forecast_lift_base) : null);
  if (cacTarget === null) push("cac_target", "not explicit and CAC is not the impacted metric.");

  const newCustTarget = i.goal.new_customers_target ??
    ((has(m, "new_customers") || has(m, "customers")) ? pctInc(i.baseline.new_customers, i.forecast_lift_base) : null);
  if (newCustTarget === null) push("new_customers_target", "not explicit and new customers is not the impacted metric.");

  const retRevTarget = has(m, "returning_revenue") ? pctInc(i.baseline.returning_revenue, i.forecast_lift_base) : null;
  if (retRevTarget === null) push("returning_revenue_target", "not explicit and returning revenue is not the impacted metric.");

  push("ad_spend_target", "requires explicit AM input or spend plan assumptions.");

  return {
    model_name: MODEL.model_name,
    model_version: MODEL.version,
    business_targets: { revenue_target: revenueTarget, ad_spend_target: null, mer_target: merTarget, cac_target: cacTarget },
    customer_targets: { new_customers_target: newCustTarget, returning_revenue_target: retRevTarget },
    channel_targets: { meta: blank("Meta"), google: blank("Google"), email: blank("Email") },
    missing_targets: missing,
    action_rules: [...ACTION_RULES],
    notes: "Targets are deterministic translations from explicit goals or the impacted north_star_metric. Revenue and channel targets are not generated without explicit inputs.",
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
