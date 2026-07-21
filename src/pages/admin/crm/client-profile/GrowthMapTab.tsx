import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { useCrmList } from "@/crm/hooks";

const NUMERIC_KEYS = ["revenue_target", "spend_target", "cac_target", "mer_target", "creative_output_target"];

export function GrowthMapTab({ clientId }: { clientId: string }) {
  const { rows, reload } = useCrmList("crm_growth_execution_maps", clientId, "week_number");
  const [f, setF] = useState<any>({});
  const add = async () => {
    const { error } = await supabase.from("crm_growth_execution_maps").insert({ ...f, client_id: clientId });
    if (error) return toast.error(error.message);
    setF({});
    reload();
  };
  const del = async (id: string) => {
    await supabase.from("crm_growth_execution_maps").delete().eq("id", id);
    reload();
  };
  return (
    <div className="space-y-4">
      <Card className="p-4 border-border shadow-none">
        <h3 className="font-semibold mb-3">Nouvelle semaine</h3>
        <div className="grid grid-cols-3 gap-3">
          <Input type="number" placeholder="Semaine #" value={f.week_number ?? ""} onChange={(e) => setF({ ...f, week_number: Number(e.target.value) })} />
          <Input placeholder="Weekly goal" value={f.weekly_goal ?? ""} onChange={(e) => setF({ ...f, weekly_goal: e.target.value })} />
          <Input placeholder="Key milestone" value={f.key_milestone ?? ""} onChange={(e) => setF({ ...f, key_milestone: e.target.value })} />
          <Textarea className="col-span-3" placeholder="Planned actions" value={f.planned_actions ?? ""} onChange={(e) => setF({ ...f, planned_actions: e.target.value })} />
          {NUMERIC_KEYS.map((k) => (
            <Input key={k} type="number" placeholder={k} value={f[k] ?? ""} onChange={(e) => setF({ ...f, [k]: Number(e.target.value) })} />
          ))}
          <Textarea className="col-span-3" placeholder="Dependencies" value={f.dependencies ?? ""} onChange={(e) => setF({ ...f, dependencies: e.target.value })} />
        </div>
        <div className="mt-3 flex justify-end">
          <Button onClick={add}><Plus className="h-4 w-4 mr-1" />Ajouter</Button>
        </div>
      </Card>
      <Card className="p-4 border-border shadow-none">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sem.</TableHead><TableHead>Goal</TableHead><TableHead>Revenue</TableHead>
              <TableHead>Spend</TableHead><TableHead>CAC</TableHead><TableHead>Milestone</TableHead><TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell>{r.week_number}</TableCell>
                <TableCell>{r.weekly_goal}</TableCell>
                <TableCell>{r.revenue_target}</TableCell>
                <TableCell>{r.spend_target}</TableCell>
                <TableCell>{r.cac_target}</TableCell>
                <TableCell>{r.key_milestone}</TableCell>
                <TableCell>
                  <Button size="icon" variant="ghost" onClick={() => del(r.id)}><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
