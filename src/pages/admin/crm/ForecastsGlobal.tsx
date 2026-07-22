import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SectionHeader, StatusBadge } from "@/crm/ui";
import { Link } from "react-router-dom";

export default function ForecastsGlobal() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("crm_forecasts").select("*, crm_clients(company_name, id)").order("created_at", { ascending: false });
      setRows(data ?? []);
    })();
  }, []);
  return (
    <div>
      <SectionHeader title="Forecasts" description="Prévisions actives" />
      <Card className="p-4">
        <Table>
          <TableHeader><TableRow><TableHead>Client</TableHead><TableHead>Nom</TableHead><TableHead>Range</TableHead><TableHead>Confidence</TableHead><TableHead>Statut</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map(r => (
              <TableRow key={r.id}>
                <TableCell><Link className="text-primary underline" to={`/admin/crm/clients/${r.crm_clients?.id}`}>{r.crm_clients?.company_name}</Link></TableCell>
                <TableCell>{r.forecast_name}</TableCell>
                <TableCell>{r.expected_lift_low}% / {r.expected_lift_base}% / {r.expected_lift_high}%</TableCell>
                <TableCell>{r.confidence_score} — {r.confidence_label}</TableCell>
                <TableCell><StatusBadge status={r.forecast_status} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
