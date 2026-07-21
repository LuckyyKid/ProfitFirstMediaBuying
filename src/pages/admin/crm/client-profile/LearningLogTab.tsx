import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { useCrmList } from "@/crm/hooks";

const TEXT_KEYS = [
  "industry", "creative_angle", "offer", "cro_module",
  "expected_lift", "actual_lift", "result",
  "time_to_signal", "time_to_result", "decision",
];

export function LearningLogTab({ clientId }: { clientId: string }) {
  const { rows, reload } = useCrmList("crm_learning_library", clientId);
  const [f, setF] = useState<any>({});
  const add = async () => {
    const { error } = await supabase.from("crm_learning_library").insert({ ...f, client_id: clientId });
    if (error) return toast.error(error.message);
    setF({});
    reload();
  };
  return (
    <div className="space-y-4">
      <Card className="p-4 border-border shadow-none">
        <h3 className="font-semibold mb-3">Log d'apprentissage</h3>
        <div className="grid grid-cols-3 gap-3">
          {TEXT_KEYS.map((k) => (
            <Input key={k} placeholder={k} value={f[k] ?? ""} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
          ))}
          <Textarea className="col-span-3" placeholder="Hypothèse" value={f.hypothesis ?? ""} onChange={(e) => setF({ ...f, hypothesis: e.target.value })} />
          <Textarea className="col-span-3" placeholder="Action taken" value={f.action_taken ?? ""} onChange={(e) => setF({ ...f, action_taken: e.target.value })} />
          <Textarea className="col-span-3" placeholder="Notes" value={f.notes ?? ""} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </div>
        <div className="mt-3 flex justify-end">
          <Button onClick={add}>Ajouter</Button>
        </div>
      </Card>
      <Card className="p-4 border-border shadow-none">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Hypothèse</TableHead><TableHead>Result</TableHead>
              <TableHead>Decision</TableHead><TableHead>Actual lift</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="max-w-md truncate">{r.hypothesis}</TableCell>
                <TableCell>{r.result}</TableCell>
                <TableCell>{r.decision}</TableCell>
                <TableCell>{r.actual_lift}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
