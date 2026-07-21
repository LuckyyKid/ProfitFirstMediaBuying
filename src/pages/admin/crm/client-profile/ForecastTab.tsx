import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { StatusBadge } from "@/crm/ui";
import { useCrmList } from "@/crm/hooks";
import { computeForecast, computeConfidence } from "@/crm/formulas";

type Overlap = "heavy" | "normal" | "complementary";

const CONFIDENCE_KEYS = [
  "data_quality",
  "evidence_strength",
  "goal_alignment",
  "execution_readiness",
  "tracking_confidence",
  "historical_similarity",
  "risk_penalty",
  "dependency_penalty",
];

export function ForecastTab({ clientId }: { clientId: string }) {
  const { rows: hypotheses } = useCrmList("crm_hypotheses", clientId);
  const { rows: forecasts, reload } = useCrmList("crm_forecasts", clientId);
  const [sel, setSel] = useState<string[]>([]);
  const [overlap, setOverlap] = useState<Overlap>("normal");
  const [conf, setConf] = useState<any>({});
  const [meta, setMeta] = useState<any>({ forecast_name: "", forecast_period: "90d", goal: "" });

  const selected = hypotheses.filter((h: any) => sel.includes(h.id));
  const fc = computeForecast(selected, overlap);
  const cf = computeConfidence(conf);

  const save = async () => {
    if (!meta.forecast_name) return toast.error("Nom requis");
    const payload = {
      client_id: clientId,
      ...meta,
      selected_hypotheses: sel,
      ...fc,
      ...cf,
      forecast_status: "Draft",
    };
    delete (payload as any).discount;
    const { error } = await supabase.from("crm_forecasts").insert(payload);
    if (error) return toast.error(error.message);
    setSel([]);
    setConf({});
    setMeta({ forecast_name: "", forecast_period: "90d", goal: "" });
    reload();
    toast.success("Forecast créé");
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 border-border shadow-none">
        <h3 className="font-semibold mb-3">Nouveau forecast</h3>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <Input placeholder="Nom" value={meta.forecast_name} onChange={(e) => setMeta({ ...meta, forecast_name: e.target.value })} />
          <Input placeholder="Période (ex 90d)" value={meta.forecast_period} onChange={(e) => setMeta({ ...meta, forecast_period: e.target.value })} />
          <Input placeholder="Goal" value={meta.goal} onChange={(e) => setMeta({ ...meta, goal: e.target.value })} />
        </div>
        <Label className="text-xs">Hypothèses (multi-sélection)</Label>
        <div className="max-h-40 overflow-y-auto border rounded p-2 space-y-1 mb-3">
          {hypotheses.map((h: any) => (
            <label key={h.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={sel.includes(h.id)}
                onChange={(e) => setSel(e.target.checked ? [...sel, h.id] : sel.filter((x) => x !== h.id))}
              />
              <span className="truncate">{h.hypothesis}</span>
            </label>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div>
            <Label className="text-xs">Overlap</Label>
            <Select value={overlap} onValueChange={(v) => setOverlap(v as Overlap)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="heavy">Heavy (0.50)</SelectItem>
                <SelectItem value="normal">Normal (0.70)</SelectItem>
                <SelectItem value="complementary">Complementary (0.85)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="border rounded p-3 bg-muted/30 text-sm mb-3">
          <div>Range: <b>{fc.expected_lift_low}%</b> / <b>{fc.expected_lift_base}%</b> / <b>{fc.expected_lift_high}%</b></div>
        </div>
        <h4 className="font-semibold mb-2 text-sm">Confidence scoring</h4>
        <div className="grid grid-cols-4 gap-3">
          {CONFIDENCE_KEYS.map((k) => (
            <div key={k}>
              <Label className="text-xs">{k}</Label>
              <Input type="number" value={conf[k] ?? ""} onChange={(e) => setConf({ ...conf, [k]: Number(e.target.value) })} />
            </div>
          ))}
        </div>
        <div className="border rounded p-3 bg-muted/30 text-sm mt-3">
          <div>Confidence: <b>{cf.confidence_score}</b> — <b>{cf.confidence_label}</b></div>
        </div>
        <div className="mt-3 flex justify-end"><Button onClick={save}>Enregistrer forecast</Button></div>
      </Card>
      <Card className="p-4 border-border shadow-none">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead><TableHead>Period</TableHead>
              <TableHead>Range</TableHead><TableHead>Confidence</TableHead><TableHead>Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {forecasts.map((f: any) => (
              <TableRow key={f.id}>
                <TableCell>{f.forecast_name}</TableCell>
                <TableCell>{f.forecast_period}</TableCell>
                <TableCell>{f.expected_lift_low}% / {f.expected_lift_base}% / {f.expected_lift_high}%</TableCell>
                <TableCell>{f.confidence_score} — {f.confidence_label}</TableCell>
                <TableCell><StatusBadge status={f.forecast_status} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
