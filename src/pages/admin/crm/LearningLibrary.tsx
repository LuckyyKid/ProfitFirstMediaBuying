import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SectionHeader } from "@/crm/ui";

export default function LearningLibrary() {
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState("");
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("crm_learning_library").select("*, crm_clients(company_name)").order("created_at", { ascending: false });
      setRows(data ?? []);
    })();
  }, []);
  const filtered = rows.filter(r => !q || [r.hypothesis, r.industry, r.creative_angle, r.offer, r.decision].some(v => (v ?? "").toLowerCase().includes(q.toLowerCase())));
  return (
    <div>
      <SectionHeader title="Learning Library" description="Base de connaissances TDIA" />
      <Card className="p-4">
        <Input placeholder="Rechercher…" value={q} onChange={e => setQ(e.target.value)} className="mb-3 max-w-sm" />
        <Table>
          <TableHeader><TableRow><TableHead>Client</TableHead><TableHead>Industrie</TableHead><TableHead>Hypothèse</TableHead><TableHead>Angle</TableHead><TableHead>Result</TableHead><TableHead>Decision</TableHead></TableRow></TableHeader>
          <TableBody>
            {filtered.map(r => (
              <TableRow key={r.id}>
                <TableCell>{r.crm_clients?.company_name ?? "—"}</TableCell>
                <TableCell>{r.industry ?? "—"}</TableCell>
                <TableCell className="max-w-md truncate">{r.hypothesis}</TableCell>
                <TableCell>{r.creative_angle}</TableCell>
                <TableCell>{r.result}</TableCell>
                <TableCell>{r.decision}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
