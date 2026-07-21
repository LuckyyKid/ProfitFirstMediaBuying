// TDIA Intelligence Engine — decision scoring (v1.0)
// Mirror of https://github.com/LuckyyKid/tdia-intelligence-engine
// DO NOT modify formulas; update by re-syncing from the upstream repo.
import { z } from "npm:zod@3.25.76";
import {
  corsHeaders, json, errorStatus, toErrorPayload,
  ModelValidationError, insertModelRun,
} from "../_shared/tdiaEngine.ts";

const MODEL = { model_name: "decision_scoring_engine", version: "v1.0" } as const;

const score = z.number().int().min(1).max(5);
const inputSchema = z.object({
  client_id: z.string().uuid(),
  hypothesis_id: z.string().uuid(),
  business_impact: score,
  goal_alignment: score,
  evidence_strength: score,
  confidence_score: score,
  ease_of_execution: score,
  urgency: score,
  risk: score,
  dependency_level: score,
  expected_time_to_result: score,
}).strict();
type Input = z.output<typeof inputSchema>;

type Priority = "P0" | "P1" | "P2" | "Research Needed" | "Blocked" | "Needs Review" | "P2 Maximum / Not P0" | "Low Priority";

const FORMULA = {
  model_name: MODEL.model_name,
  model_version: MODEL.version,
  formula: "(business_impact * 25) + (goal_alignment * 20) + (evidence_strength * 20) + (confidence_score * 15) + (urgency * 10) + (ease_of_execution * 10) - (risk * 15) - (dependency_level * 10)",
  priority_rule_order: [
    "dependency_level = 5 => Blocked",
    "risk = 5 => Needs Review",
    "evidence_strength <= 2 and confidence_score <= 2 => Research Needed",
    "goal_alignment <= 2 => P2 Maximum / Not P0",
    "decision_score >= 350 => P0",
    "decision_score >= 275 => P1",
    "decision_score >= 200 => P2",
    "else => Low Priority",
  ],
  unused_v1_inputs: ["expected_time_to_result"],
};

function calc(i: Input) {
  return i.business_impact * 25 + i.goal_alignment * 20 + i.evidence_strength * 20 +
    i.confidence_score * 15 + i.urgency * 10 + i.ease_of_execution * 10 -
    i.risk * 15 - i.dependency_level * 10;
}
function classify(i: Input, s: number): { priority: Priority; priority_reason: string } {
  if (i.dependency_level === 5) return { priority: "Blocked", priority_reason: "dependency_level is 5, so execution is blocked until dependency is resolved." };
  if (i.risk === 5) return { priority: "Needs Review", priority_reason: "risk is 5, so AM/Strategy Lead review is required before approval." };
  if (i.evidence_strength <= 2 && i.confidence_score <= 2) return { priority: "Research Needed", priority_reason: "evidence_strength and confidence_score are both 2 or lower." };
  if (i.goal_alignment <= 2) return { priority: "P2 Maximum / Not P0", priority_reason: "goal_alignment is 2 or lower, so the guardrail prevents P0 classification." };
  if (s >= 350) return { priority: "P0", priority_reason: "decision_score is 350 or higher with no blocking guardrail." };
  if (s >= 275) return { priority: "P1", priority_reason: "decision_score is between 275 and 349 with no blocking guardrail." };
  if (s >= 200) return { priority: "P2", priority_reason: "decision_score is between 200 and 274 with no blocking guardrail." };
  return { priority: "Low Priority", priority_reason: "decision_score is below 200 with no blocking guardrail." };
}
function nextAction(p: Priority): string {
  switch (p) {
    case "P0": return "Execute immediately or include in 30-day roadmap.";
    case "P1": return "Plan after P0 actions or include if capacity allows.";
    case "P2":
    case "P2 Maximum / Not P0": return "Keep as secondary opportunity.";
    case "Research Needed": return "Collect more evidence before execution.";
    case "Blocked": return "Resolve dependency before execution.";
    case "Needs Review": return "AM/Strategy Lead must review risk before approval.";
    case "Low Priority": return "Do not prioritize now.";
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed. Use POST." }, 405);
  try {
    const raw = await req.json();
    const parsed = inputSchema.safeParse(raw);
    if (!parsed.success) throw new ModelValidationError(parsed.error.issues.map((i) => ({ path: i.path.join(".") || "root", message: i.message })));
    const input = parsed.data;
    const s = calc(input);
    const pr = classify(input, s);
    const output = {
      model_name: MODEL.model_name,
      model_version: MODEL.version,
      hypothesis_id: input.hypothesis_id,
      decision_score: s,
      priority: pr.priority,
      priority_reason: pr.priority_reason,
      risk_flag: input.risk === 5 ? "risk is 5; AM/Strategy Lead review is required." : null,
      dependency_flag: input.dependency_level === 5 ? "dependency_level is 5; dependency must be resolved." : null,
      recommended_next_action: nextAction(pr.priority),
    };

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
