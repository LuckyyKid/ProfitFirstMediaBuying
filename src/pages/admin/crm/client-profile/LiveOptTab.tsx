import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { useCrmList } from "@/crm/hooks";
import { classifyLiveProblem } from "@/crm/formulas";

const METRIC_KEYS = [
  "revenue_target", "revenue_actual", "spend_target", "spend_actual",
  "cac_target", "cac_actual", "mer_target", "mer_actual",
  "ctr_actual", "cvr_actual", "atc_actual",
];
const CREATIVE_KEYS = ["creative_output_target", "creative_output_actual"];
const NARRATIVE_KEYS = [
  "what_happened", "so_what", "now_what",
  "recommended_actions", "variance_summary", "client_success_payload",
];

export function LiveOptTab({ clientId }: { clientId: string }) {
  const { rows, reload } = useCrmList("crm_live_optimization_reviews", clientId);
  const [f, setF] = useState<any>({ review_period: "" });
  const problem = classifyLiveProblem(f);
  const add = async () => {
    const payload = { ...f, client_id: clientId, problem_type: problem };
    const { error } = await supabase.from("crm_live_optimization_reviews").insert(payload);
    if (error) return toast.error(error.message);
    setF({ review_period: "" });
    reload();
  };
  return (
    <div className="space-y-4">
      <Card className="p-4 border-border shadow-none">
        <h3 className="font-semibold mb-3">Nouvelle revue live</h3>
        <div className="grid grid-cols-3 gap-3">
          <Input placeholder="Période (ex 2026-W27)" value={f.review_period ?? ""} onChange={(e) => setF({ ...f, review_period: e.target.value })} />
          {METRIC_KEYS.map((k) => (
            <div key={k}>
              <Label className="text-xs">{k}</Label>
              <Input type="number" value={f[k] ?? ""} onChange={(e) => setF({ ...f, [k]: Number(e.target.value) })} />
            </div>
          ))}
          {CREATIVE_KEYS.map((k) => (
            <div key={k}>
              <Label className="text-xs">{k}</Label>
              <Input type="number" value={f[k] ?? ""} onChange={(e) => setF({ ...f, [k]: Number(e.target.value) })} />
            </div>
          ))}
          {NARRATIVE_KEYS.map((k) => (
            <Textarea key={k} className="col-span-3" placeholder={k} value={f[k] ?? ""} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
          ))}
        </div>
        <div className="mt-3 p-3 bg-muted/30 rounded text-sm">Auto-classification: <b>{problem}</b></div>
        <div className="mt-3 flex justify-end">
          <Button onClick={add}><Plus className="h-4 w-4 mr-1" />Ajouter</Button>
        </div>
      </Card>
      <Card className="p-4 border-border shadow-none">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Période</TableHead><TableHead>Rev</TableHead><TableHead>Spend</TableHead>
              <TableHead>CAC</TableHead><TableHead>MER</TableHead><TableHead>Problème</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell>{r.review_period}</TableCell>
                <TableCell>{r.revenue_actual}/{r.revenue_target}</TableCell>
                <TableCell>{r.spend_actual}/{r.spend_target}</TableCell>
                <TableCell>{r.cac_actual}/{r.cac_target}</TableCell>
                <TableCell>{r.mer_actual}/{r.mer_target}</TableCell>
                <TableCell>{r.problem_type}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
