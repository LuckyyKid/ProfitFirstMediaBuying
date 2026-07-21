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

export function ExperimentalTab({ clientId }: { clientId: string }) {
  const { rows, reload } = useCrmList("crm_experimental_history", clientId);
  const [f, setF] = useState<any>({});
  const add = async () => {
    const { error } = await supabase.from("crm_experimental_history").insert({ ...f, client_id: clientId });
    if (error) return toast.error(error.message);
    setF({});
    reload();
  };
  const del = async (id: string) => {
    await supabase.from("crm_experimental_history").delete().eq("id", id);
    reload();
  };
  return (
    <div className="space-y-4">
      <Card className="p-4 border-border shadow-none">
        <h3 className="font-semibold mb-3">Nouveau test</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {["campaign_name", "test_period", "channel", "angle", "hook", "format", "offer", "landing_page"].map((k) => (
            <Input key={k} placeholder={k} value={f[k] ?? ""} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
          ))}
          {["spend", "cpa", "roas", "ctr"].map((k) => (
            <Input key={k} type="number" placeholder={k} value={f[k] ?? ""} onChange={(e) => setF({ ...f, [k]: Number(e.target.value) })} />
          ))}
          <Input placeholder="result" value={f.result ?? ""} onChange={(e) => setF({ ...f, result: e.target.value })} />
          <Input placeholder="pattern" value={f.pattern_type ?? ""} onChange={(e) => setF({ ...f, pattern_type: e.target.value })} />
          <Textarea className="col-span-2 md:col-span-4" placeholder="notes" value={f.notes ?? ""} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </div>
        <div className="mt-3 flex justify-end">
          <Button onClick={add}><Plus className="h-4 w-4 mr-1" />Ajouter</Button>
        </div>
      </Card>
      <Card className="p-4 border-border shadow-none">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Campagne</TableHead><TableHead>Channel</TableHead><TableHead>Angle</TableHead>
              <TableHead>Spend</TableHead><TableHead>CPA</TableHead><TableHead>ROAS</TableHead>
              <TableHead>Result</TableHead><TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell>{r.campaign_name}</TableCell>
                <TableCell>{r.channel}</TableCell>
                <TableCell>{r.angle}</TableCell>
                <TableCell>{r.spend}</TableCell>
                <TableCell>{r.cpa}</TableCell>
                <TableCell>{r.roas}</TableCell>
                <TableCell>{r.result}</TableCell>
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
