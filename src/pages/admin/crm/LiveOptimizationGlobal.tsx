import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SectionHeader } from "@/crm/ui";
import { Link } from "react-router-dom";

export default function LiveOptimizationGlobal() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("crm_live_optimization_reviews").select("*, crm_clients(company_name, id)").order("created_at", { ascending: false });
      setRows(data ?? []);
    })();
  }, []);
  return (
    <div>
      <SectionHeader title="Live Optimization" description="Revues hebdomadaires de performance" />
      <Card className="p-4">
        <Table>
          <TableHeader><TableRow><TableHead>Client</TableHead><TableHead>Période</TableHead><TableHead>Rev act/target</TableHead><TableHead>CAC act/target</TableHead><TableHead>Problème</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map(r => (
              <TableRow key={r.id}>
                <TableCell><Link className="text-primary underline" to={`/admin/crm/clients/${r.crm_clients?.id}`}>{r.crm_clients?.company_name}</Link></TableCell>
                <TableCell>{r.review_period}</TableCell>
                <TableCell>{r.revenue_actual}/{r.revenue_target}</TableCell>
                <TableCell>{r.cac_actual}/{r.cac_target}</TableCell>
                <TableCell>{r.problem_type}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
