import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { StatusBadge } from "@/crm/ui";
import { useCrmList } from "@/crm/hooks";
import { computeDecision } from "@/crm/formulas";

const CRITERIA: [string, string][] = [
  ["business_impact", "Impact business"],
  ["goal_alignment", "Goal alignment"],
  ["evidence_strength", "Evidence"],
  ["confidence_score", "Confidence"],
  ["ease_of_execution", "Ease"],
  ["urgency", "Urgency"],
  ["risk", "Risk"],
  ["dependency_level", "Dependency"],
  ["expected_time_to_result", "Time to result"],
];

export function DecisionScoringTab({ clientId }: { clientId: string }) {
  const { rows: hypotheses } = useCrmList("crm_hypotheses", clientId);
  const { rows: scores, reload } = useCrmList("crm_decision_scores", clientId);
  const [sel, setSel] = useState<string>("");
  const [f, setF] = useState<any>({});

  const preview = computeDecision(f);

  const save = async () => {
    if (!sel) return toast.error("Choisis une hypothèse");
    const c = computeDecision(f);
    const payload = { ...f, ...c, client_id: clientId, hypothesis_id: sel };
    delete payload.override_note;
    const { error } = await supabase.from("crm_decision_scores").insert(payload);
    if (error) return toast.error(error.message);
    setF({});
    setSel("");
    reload();
    toast.success("Score enregistré");
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 border-border shadow-none">
        <h3 className="font-semibold mb-3">Nouveau scoring (1-5)</h3>
        <Select value={sel} onValueChange={setSel}>
          <SelectTrigger className="mb-3"><SelectValue placeholder="Choisir une hypothèse approuvée" /></SelectTrigger>
          <SelectContent>
            {hypotheses
              .filter((h: any) => h.status === "Approved" || h.status === "Ready for Scoring")
              .map((h: any) => (
                <SelectItem key={h.id} value={h.id}>{h.hypothesis?.slice(0, 80)}</SelectItem>
              ))}
          </SelectContent>
        </Select>
        <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
          {CRITERIA.map(([k, label]) => (
            <div key={k}>
              <Label className="text-xs">{label}</Label>
              <Input type="number" min={1} max={5} value={f[k] ?? ""} onChange={(e) => setF({ ...f, [k]: Number(e.target.value) })} />
            </div>
          ))}
        </div>
        <div className="mt-4 p-3 border rounded bg-muted/30 text-sm flex gap-6">
          <div><span className="text-muted-foreground">Score:</span> <b>{preview.decision_score}</b></div>
          <div><span className="text-muted-foreground">Priorité:</span> <b>{preview.priority}</b></div>
          {preview.override_note && <div className="text-amber-500">{preview.override_note}</div>}
        </div>
        <div className="mt-3 flex justify-end"><Button onClick={save}>Enregistrer</Button></div>
      </Card>
      <Card className="p-4 border-border shadow-none">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Hypothèse</TableHead><TableHead>Score</TableHead>
              <TableHead>Priorité</TableHead><TableHead>AM</TableHead><TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {scores.map((s: any) => {
              const h = hypotheses.find((x: any) => x.id === s.hypothesis_id);
              return (
                <TableRow key={s.id}>
                  <TableCell className="max-w-md truncate">{h?.hypothesis ?? s.hypothesis_id}</TableCell>
                  <TableCell><b>{s.decision_score}</b></TableCell>
                  <TableCell><StatusBadge status={s.priority} /></TableCell>
                  <TableCell>{s.am_approved ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : "—"}</TableCell>
                  <TableCell className="text-xs">{new Date(s.created_at).toLocaleDateString()}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
