import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { ModelBadge, ForecastDisclaimer } from "@/crm/ModelBadge";
import { toast } from "sonner";
import { Cpu, Loader2, Play, ChevronDown, ChevronRight } from "lucide-react";
import { useCrmClientBriefs, useModelRuns } from "@/crm/hooks";
import { TwentyPage, PageHeader } from "@/components/admin-shell";

const MODELS = [
  { fn: "run-decision-scoring", label: "Decision Scoring", model_name: "decision_scoring_engine" },
  { fn: "run-forecast",         label: "Forecast",         model_name: "forecast_engine" },
  { fn: "run-metric-targets",   label: "Metric Targets",   model_name: "metric_targets_engine" },
  { fn: "run-creative-demand",  label: "Creative Demand",  model_name: "creative_demand_engine" },
] as const;

const EXAMPLES: Record<string, unknown> = {
  "run-decision-scoring": {
    client_id: "REPLACE_WITH_crm_clients.id",
    hypothesis_id: "REPLACE_WITH_crm_hypotheses.id",
    business_impact: 5, goal_alignment: 5, evidence_strength: 4, confidence_score: 4,
    ease_of_execution: 3, urgency: 4, risk: 2, dependency_level: 1, expected_time_to_result: 3,
  },
  "run-forecast": {
    client_id: "REPLACE_WITH_crm_clients.id",
    forecast_name: "Q1 Growth Plan",
    selected_hypotheses: [
      { hypothesis_id: "REPLACE_WITH_crm_hypotheses.id", expected_lift_min: 5, expected_lift_base: 10, expected_lift_max: 15 },
    ],
    overlap_discount: 0.7,
    timeline: "90 days", conditions: "Meta spend held flat", risks: "Creative fatigue", dependencies: "New creative delivery",
    confidence_components: {
      data_quality_score: 15, evidence_strength_score: 15, goal_alignment_score: 18,
      execution_readiness_score: 12, tracking_confidence_score: 8, historical_similarity_score: 7,
      risk_penalty: 5, dependency_penalty: 5,
    },
  },
  "run-metric-targets": {
    client_id: "REPLACE_WITH_crm_clients.id",
    forecast_id: "REPLACE_WITH_crm_forecasts.id",
    north_star_metric: "CAC",
    baseline: { revenue: 100000, ad_spend: 25000, mer: 4, cac: 60, aov: 80, new_customers: 400, returning_revenue: 20000 },
    forecast_lift_base: 10,
    goal: { revenue_target: null, cac_target: null, mer_target: null, new_customers_target: null },
  },
  "run-creative-demand": {
    client_id: "REPLACE_WITH_crm_clients.id",
    planned_meta_spend: 30000,
    current_top_3_ads_spend_share: 0.55,
    frequency: 3.2,
    new_creatives_last_30d: 4,
    active_ads: 20,
    priority_angles: ["problem-solution", "social-proof"],
    priority_products: ["Bestseller SKU"],
  },
};

export default function ModelRuns() {
  const clients = useCrmClientBriefs();
  const [clientId, setClientId] = useState<string>("");
  const { runs, loading, reload, setApproval, setOverride } = useModelRuns(clientId);
  const [fn, setFn] = useState<typeof MODELS[number]["fn"]>("run-decision-scoring");
  const [payload, setPayload] = useState(JSON.stringify(EXAMPLES["run-decision-scoring"], null, 2));
  const [invoking, setInvoking] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const onFnChange = (v: typeof MODELS[number]["fn"]) => {
    setFn(v);
    const ex: any = { ...(EXAMPLES[v] as any) };
    if (clientId && "client_id" in ex) ex.client_id = clientId;
    setPayload(JSON.stringify(ex, null, 2));
  };

  const persistToCrm = async (fnName: string, clientIdArg: string, output: any, input: any) => {
    try {
      if (fnName === "run-decision-scoring") {
        await supabase.from("crm_decision_scores" as any).insert({
          client_id: clientIdArg,
          hypothesis_id: output.hypothesis_id,
          decision_score: output.decision_score,
          priority: output.priority,
          notes: output.priority_reason,
        });
      } else if (fnName === "run-forecast") {
        await supabase.from("crm_forecasts" as any).insert({
          client_id: clientIdArg,
          forecast_name: input.forecast_name,
          forecast_lift_low: output.forecast_lift_low,
          forecast_lift_base: output.forecast_lift_base,
          forecast_lift_high: output.forecast_lift_high,
          confidence_score: output.confidence_score,
          confidence_label: output.confidence_label,
          timeline: output.timeline,
          conditions: output.conditions,
          risks: output.risks,
          dependencies: output.dependencies,
          summary: output.forecast_summary,
        });
      }
    } catch (e: any) {
      console.warn(`Optional CRM mirror failed for ${fnName}:`, e?.message ?? e);
    }
  };

  const invoke = async () => {
    let body: any;
    try { body = JSON.parse(payload); } catch { return toast.error("Invalid JSON"); }
    setInvoking(true);
    const { data, error } = await supabase.functions.invoke(fn, { body });
    setInvoking(false);
    if (error) return toast.error(error.message);
    toast.success(`${fn} succeeded`);
    if (body?.client_id && data?.output) await persistToCrm(fn, body.client_id, data.output, body);
    await reload();
  };

  const clientLabel = useMemo(() => {
    const m = new Map(clients.map((c) => [c.id, c.company_name ?? c.main_contact_name ?? c.id]));
    return (id: string | null) => (id ? (m.get(id) ?? id.slice(0, 8)) : "—");
  }, [clients]);

  return (
    <TwentyPage inLayout>
      <PageHeader
        icon={Cpu}
        title="Model Runs"
        description="Every execution of the TDIA Intelligence Engine is recorded here"
        actions={<ModelBadge />}
      />

      <div className="flex-1 overflow-auto p-4 md:p-6 space-y-4">
      <Card className="border-border shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Run engine</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label>Client filter</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger><SelectValue placeholder="All clients" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__" onSelect={() => setClientId("")}>All clients</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.company_name ?? c.main_contact_name ?? c.id.slice(0, 8)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Model</Label>
              <Select value={fn} onValueChange={(v) => onFnChange(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MODELS.map((m) => <SelectItem key={m.fn} value={m.fn}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={invoke} disabled={invoking} className="w-full">
                {invoking ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                Invoke
              </Button>
            </div>
          </div>
          <div>
            <Label>Input JSON</Label>
            <Textarea rows={12} value={payload} onChange={(e) => setPayload(e.target.value)} className="font-mono text-xs" />
          </div>
          {fn === "run-forecast" && <ForecastDisclaimer />}
        </CardContent>
      </Card>

      <Card className="border-border shadow-none">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            History
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            <span className="text-xs text-muted-foreground font-normal">({runs.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {runs.length === 0 && !loading && <div className="text-sm text-muted-foreground">No runs yet.</div>}
          {runs.map((r) => {
            const isForecast = r.model_name === "forecast_engine";
            const open = !!expanded[r.id];
            return (
              <div key={r.id} className="border rounded-md p-3 space-y-2">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline">{r.model_name}</Badge>
                      <Badge>{r.model_version}</Badge>
                      <span className="text-sm">{clientLabel(r.client_id)}</span>
                      {r.am_approved && <Badge variant="default">AM approved</Badge>}
                      {r.am_override && <Badge variant="destructive">Overridden</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(r.generated_at).toLocaleString()} · {r.generated_by ?? "—"}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs">Approved</Label>
                      <Switch checked={r.am_approved} onCheckedChange={(v) => setApproval(r.id, v)} />
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setExpanded((s) => ({ ...s, [r.id]: !open }))}>
                      {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      {open ? "Hide" : "Details"}
                    </Button>
                  </div>
                </div>
                {isForecast && <ForecastDisclaimer />}
                {open && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <pre className="text-[10px] bg-muted p-2 rounded overflow-auto max-h-80">{JSON.stringify(r.input_json, null, 2)}</pre>
                      <pre className="text-[10px] bg-muted p-2 rounded overflow-auto max-h-80">{JSON.stringify(r.output_json, null, 2)}</pre>
                    </div>
                    <div>
                      <Label className="text-xs">Override reason (setting a value marks the run as overridden)</Label>
                      <Input
                        defaultValue={r.override_reason ?? ""}
                        placeholder="Why did the AM override this output?"
                        onBlur={(e) => { if ((e.target.value ?? "") !== (r.override_reason ?? "")) setOverride(r.id, e.target.value); }}
                      />
                    </div>
                    <ModelBadge version={r.model_version} />
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
      </div>
    </TwentyPage>
  );
}
