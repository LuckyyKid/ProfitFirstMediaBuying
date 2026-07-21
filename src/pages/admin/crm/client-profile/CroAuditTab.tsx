import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { useCrmList } from "@/crm/hooks";

export function CroAuditTab({ clientId }: { clientId: string }) {
  const { rows, reload } = useCrmList("crm_cro_offer_audits", clientId);
  const [f, setF] = useState<any>({});
  const add = async () => {
    if (!f.finding) return toast.error("Finding requis");
    const { error } = await supabase.from("crm_cro_offer_audits").insert({ ...f, client_id: clientId });
    if (error) return toast.error(error.message);
    setF({});
    reload();
  };
  const del = async (id: string) => {
    await supabase.from("crm_cro_offer_audits").delete().eq("id", id);
    reload();
  };
  return (
    <div className="space-y-4">
      <Card className="p-4 border-border shadow-none">
        <h3 className="font-semibold mb-3">Nouveau finding CRO</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Input placeholder="Page URL" value={f.page_url ?? ""} onChange={(e) => setF({ ...f, page_url: e.target.value })} />
          <Select value={f.page_type ?? ""} onValueChange={(v) => setF({ ...f, page_type: v })}>
            <SelectTrigger><SelectValue placeholder="Type de page" /></SelectTrigger>
            <SelectContent>{["Homepage", "Landing", "PDP", "Checkout", "Mobile UX", "Autre"].map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}</SelectContent>
          </Select>
          <Input placeholder="Friction type" value={f.friction_type ?? ""} onChange={(e) => setF({ ...f, friction_type: e.target.value })} />
          <Select value={f.severity ?? ""} onValueChange={(v) => setF({ ...f, severity: v })}>
            <SelectTrigger><SelectValue placeholder="Sévérité" /></SelectTrigger>
            <SelectContent>{["Low", "Medium", "High", "Critical"].map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}</SelectContent>
          </Select>
          <Select value={f.priority ?? ""} onValueChange={(v) => setF({ ...f, priority: v })}>
            <SelectTrigger><SelectValue placeholder="Priorité" /></SelectTrigger>
            <SelectContent>{["P0", "P1", "P2", "Low"].map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}</SelectContent>
          </Select>
          <Input placeholder="Expected impact" value={f.expected_impact ?? ""} onChange={(e) => setF({ ...f, expected_impact: e.target.value })} />
          <Textarea className="col-span-2 md:col-span-3" placeholder="Finding" value={f.finding ?? ""} onChange={(e) => setF({ ...f, finding: e.target.value })} />
          <Textarea className="col-span-2 md:col-span-3" placeholder="Evidence" value={f.evidence ?? ""} onChange={(e) => setF({ ...f, evidence: e.target.value })} />
          <Textarea className="col-span-2 md:col-span-3" placeholder="Recommendation" value={f.recommendation ?? ""} onChange={(e) => setF({ ...f, recommendation: e.target.value })} />
        </div>
        <div className="mt-3 flex justify-end">
          <Button onClick={add}><Plus className="h-4 w-4 mr-1" />Ajouter</Button>
        </div>
      </Card>
      <Card className="p-4 border-border shadow-none">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Page</TableHead><TableHead>Friction</TableHead><TableHead>Finding</TableHead>
              <TableHead>Sévérité</TableHead><TableHead>Priorité</TableHead><TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell>{r.page_type}</TableCell>
                <TableCell>{r.friction_type}</TableCell>
                <TableCell className="max-w-md truncate">{r.finding}</TableCell>
                <TableCell>{r.severity}</TableCell>
                <TableCell>{r.priority}</TableCell>
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
