import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { StatusBadge } from "@/crm/ui";
import { useCrmList } from "@/crm/hooks";

export function HypothesesTab({ clientId }: { clientId: string }) {
  const { rows, reload } = useCrmList("crm_hypotheses", clientId);
  const [f, setF] = useState<any>({ status: "Draft" });
  const add = async () => {
    if (!f.hypothesis) return toast.error("Hypothèse requise");
    const { error } = await supabase.from("crm_hypotheses").insert({ ...f, client_id: clientId });
    if (error) return toast.error(error.message);
    setF({ status: "Draft" });
    reload();
  };
  const updateStatus = async (id: string, status: string) => {
    await supabase.from("crm_hypotheses").update({ status }).eq("id", id);
    reload();
  };
  const del = async (id: string) => {
    await supabase.from("crm_hypotheses").delete().eq("id", id);
    reload();
  };
  return (
    <div className="space-y-4">
      <Card className="p-4 border-border shadow-none">
        <h3 className="font-semibold mb-3">Nouvelle hypothèse</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Input placeholder="Catégorie" value={f.category ?? ""} onChange={(e) => setF({ ...f, category: e.target.value })} />
          <Input placeholder="Primary metric" value={f.primary_metric ?? ""} onChange={(e) => setF({ ...f, primary_metric: e.target.value })} />
          <Input placeholder="Timeline" value={f.timeline ?? ""} onChange={(e) => setF({ ...f, timeline: e.target.value })} />
          <Textarea className="col-span-2 md:col-span-3" placeholder="Hypothèse" value={f.hypothesis ?? ""} onChange={(e) => setF({ ...f, hypothesis: e.target.value })} />
          <Textarea className="col-span-2 md:col-span-3" placeholder="Evidence" value={f.evidence ?? ""} onChange={(e) => setF({ ...f, evidence: e.target.value })} />
          <Textarea className="col-span-2 md:col-span-3" placeholder="Test description" value={f.test_description ?? ""} onChange={(e) => setF({ ...f, test_description: e.target.value })} />
          <Input type="number" placeholder="Lift min %" value={f.expected_lift_min ?? ""} onChange={(e) => setF({ ...f, expected_lift_min: Number(e.target.value) })} />
          <Input type="number" placeholder="Lift base %" value={f.expected_lift_base ?? ""} onChange={(e) => setF({ ...f, expected_lift_base: Number(e.target.value) })} />
          <Input type="number" placeholder="Lift max %" value={f.expected_lift_max ?? ""} onChange={(e) => setF({ ...f, expected_lift_max: Number(e.target.value) })} />
          <Input placeholder="Confidence" value={f.confidence ?? ""} onChange={(e) => setF({ ...f, confidence: e.target.value })} />
          <Input placeholder="Risk" value={f.risk ?? ""} onChange={(e) => setF({ ...f, risk: e.target.value })} />
          <Input placeholder="Dependencies" value={f.dependencies ?? ""} onChange={(e) => setF({ ...f, dependencies: e.target.value })} />
          <Input placeholder="Suggested priority" value={f.suggested_priority ?? ""} onChange={(e) => setF({ ...f, suggested_priority: e.target.value })} />
        </div>
        <div className="mt-3 flex justify-end">
          <Button onClick={add}><Plus className="h-4 w-4 mr-1" />Ajouter</Button>
        </div>
      </Card>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {rows.map((h: any) => (
          <Card key={h.id} className="p-4 border-border shadow-none">
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="text-xs text-muted-foreground">{h.category ?? "—"}</div>
                <div className="font-medium">{h.hypothesis}</div>
              </div>
              <StatusBadge status={h.status} />
            </div>
            <div className="text-xs text-muted-foreground mb-2">
              Lift: {h.expected_lift_min ?? "?"}% / {h.expected_lift_base ?? "?"}% / {h.expected_lift_max ?? "?"}% · Timeline: {h.timeline ?? "—"}
            </div>
            <div className="flex gap-1 flex-wrap">
              <Button size="sm" variant="outline" onClick={() => updateStatus(h.id, "Approved")}>Approve</Button>
              <Button size="sm" variant="outline" onClick={() => updateStatus(h.id, "Rejected")}>Reject</Button>
              <Button size="sm" variant="outline" onClick={() => updateStatus(h.id, "Ready for Scoring")}>Send to Scoring</Button>
              <Button size="sm" variant="ghost" onClick={() => del(h.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </Card>
        ))}
        {rows.length === 0 && <div className="text-muted-foreground text-sm">Aucune hypothèse</div>}
      </div>
    </div>
  );
}
