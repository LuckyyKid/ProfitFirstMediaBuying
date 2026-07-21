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

export function MarketResearchTab({ clientId }: { clientId: string }) {
  const { rows, reload } = useCrmList("crm_market_research", clientId);
  const [f, setF] = useState<any>({});
  const add = async () => {
    if (!f.finding_text) return toast.error("Finding requis");
    const { error } = await supabase.from("crm_market_research").insert({ ...f, client_id: clientId });
    if (error) return toast.error(error.message);
    setF({});
    reload();
    toast.success("Ajouté");
  };
  const del = async (id: string) => {
    await supabase.from("crm_market_research").delete().eq("id", id);
    reload();
  };
  return (
    <div className="space-y-4">
      <Card className="p-4 border-border shadow-none">
        <h3 className="font-semibold mb-3">Ajouter un finding</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Input placeholder="Compétiteur" value={f.competitor_name ?? ""} onChange={(e) => setF({ ...f, competitor_name: e.target.value })} />
          <Input placeholder="Source (ex: FB Ad Library)" value={f.source_type ?? ""} onChange={(e) => setF({ ...f, source_type: e.target.value })} />
          <Input placeholder="Source URL" value={f.source_url ?? ""} onChange={(e) => setF({ ...f, source_url: e.target.value })} />
          <Input placeholder="ICP segment" value={f.icp_segment ?? ""} onChange={(e) => setF({ ...f, icp_segment: e.target.value })} />
          <Input placeholder="Angle créatif" value={f.creative_angle ?? ""} onChange={(e) => setF({ ...f, creative_angle: e.target.value })} />
          <Input placeholder="Gap compétiteur" value={f.competitor_gap ?? ""} onChange={(e) => setF({ ...f, competitor_gap: e.target.value })} />
          <Textarea className="col-span-2 md:col-span-3" placeholder="Finding" value={f.finding_text ?? ""} onChange={(e) => setF({ ...f, finding_text: e.target.value })} />
          <Textarea className="col-span-2 md:col-span-3" placeholder="VOC quote" value={f.customer_voice_quote ?? ""} onChange={(e) => setF({ ...f, customer_voice_quote: e.target.value })} />
          <Input type="number" placeholder="Evidence 1-5" value={f.evidence_strength ?? ""} onChange={(e) => setF({ ...f, evidence_strength: Number(e.target.value) })} />
          <Input type="number" placeholder="Confidence 1-5" value={f.confidence ?? ""} onChange={(e) => setF({ ...f, confidence: Number(e.target.value) })} />
          <Input placeholder="Claim risk" value={f.claim_risk ?? ""} onChange={(e) => setF({ ...f, claim_risk: e.target.value })} />
        </div>
        <div className="mt-3 flex justify-end">
          <Button onClick={add}><Plus className="h-4 w-4 mr-1" />Ajouter</Button>
        </div>
      </Card>
      <Card className="p-4 border-border shadow-none">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Compétiteur</TableHead><TableHead>Angle</TableHead>
              <TableHead>Finding</TableHead><TableHead>Ev.</TableHead><TableHead>Conf.</TableHead><TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell>{r.competitor_name}</TableCell>
                <TableCell>{r.creative_angle}</TableCell>
                <TableCell className="max-w-md truncate">{r.finding_text}</TableCell>
                <TableCell>{r.evidence_strength ?? "—"}</TableCell>
                <TableCell>{r.confidence ?? "—"}</TableCell>
                <TableCell>
                  <Button size="icon" variant="ghost" onClick={() => del(r.id)}><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Aucun finding</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
