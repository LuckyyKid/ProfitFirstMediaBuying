import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { ExternalLink, RefreshCw, Info } from "lucide-react";
import { SectionHeader, StatusBadge, RiskBadge } from "@/crm/ui";

/**
 * The CRM client list is derived automatically from the closed deals
 * (client_progress). Any deal that becomes a client shows up here — no manual
 * creation. On load we upsert a matching crm_clients row (by client_code) so
 * every closed deal has an intelligence record.
 */
async function syncFromClosedDeals(): Promise<number> {
  const { data: deals, error } = await supabase
    .from("client_progress")
    .select("client_code, company_name, client_name, deal_value, created_at")
    .not("client_code", "is", null);
  if (error) throw error;

  const { data: existing } = await supabase
    .from("crm_clients")
    .select("client_code");
  const known = new Set((existing ?? []).map((r) => r.client_code));

  const toInsert = (deals ?? [])
    .filter((d) => d.client_code && !known.has(d.client_code))
    .map((d) => ({
      client_code: d.client_code,
      company_name: d.company_name || d.client_name || d.client_code,
      main_contact_name: d.client_name ?? null,
      deal_value: d.deal_value ?? null,
      closing_date: d.created_at ? new Date(d.created_at).toISOString().slice(0, 10) : null,
      current_phase: "Onboarding",
      risk_level: "Low",
    }));

  if (toInsert.length > 0) {
    const { error: insErr } = await supabase.from("crm_clients").insert(toInsert);
    if (insErr) throw insErr;
  }
  return toInsert.length;
}

export default function CrmClients() {
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [syncing, setSyncing] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("crm_clients")
      .select("*")
      .order("created_at", { ascending: false });
    setRows(data ?? []);
  };

  const runSync = async (verbose = false) => {
    setSyncing(true);
    try {
      const n = await syncFromClosedDeals();
      await load();
      if (verbose) toast.success(n > 0 ? `${n} client(s) importé(s) depuis les deals` : "Portefeuille à jour");
    } catch (e: any) {
      if (verbose) toast.error(e.message);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    // First sync silently, then load, then subscribe to future closed deals.
    runSync(false);
    const channel = supabase
      .channel("crm_clients_sync")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "client_progress" },
        () => runSync(false)
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = rows.filter(
    (r) =>
      !q ||
      [r.company_name, r.client_code, r.industry, r.am_owner_name].some((v) =>
        (v ?? "").toLowerCase().includes(q.toLowerCase())
      )
  );

  return (
    <div>
      <SectionHeader
        title="Clients"
        description="Portefeuille TDIA — synchronisé automatiquement depuis les deals closés"
        actions={
          <Button size="sm" variant="outline" onClick={() => runSync(true)} disabled={syncing}>
            <RefreshCw className={`h-4 w-4 mr-1 ${syncing ? "animate-spin" : ""}`} />
            Synchroniser
          </Button>
        }
      />

      <Card className="p-3 mb-4 bg-muted/40 border-dashed flex items-start gap-2 text-sm text-muted-foreground">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <div>
          Les clients apparaissent ici dès qu'un deal est closé. Aucune création manuelle nécessaire —
          modifie les infos business dans le profil client (onglet Overview) une fois le client importé.
        </div>
      </Card>

      <Card className="p-4">
        <Input placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} className="mb-3 max-w-sm" />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Entreprise</TableHead>
              <TableHead>Industrie</TableHead>
              <TableHead>AM</TableHead>
              <TableHead>Phase</TableHead>
              <TableHead>Risque</TableHead>
              <TableHead>Launch</TableHead>
              <TableHead>ClickUp</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{r.client_code}</TableCell>
                <TableCell className="font-medium">{r.company_name}</TableCell>
                <TableCell>{r.industry ?? "—"}</TableCell>
                <TableCell>{r.am_owner_name ?? "—"}</TableCell>
                <TableCell>
                  <StatusBadge status={r.current_phase} />
                </TableCell>
                <TableCell>
                  <RiskBadge level={r.risk_level} />
                </TableCell>
                <TableCell>{r.launch_target_date ?? "—"}</TableCell>
                <TableCell>
                  {r.clickup_task_url ? (
                    <a className="text-primary underline" href={r.clickup_task_url} target="_blank" rel="noreferrer">
                      Lien
                    </a>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>
                  <Button asChild size="sm" variant="outline">
                    <Link to={`/admin/crm/clients/${r.id}`}>
                      Ouvrir <ExternalLink className="h-3 w-3 ml-1" />
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  Aucun client — ils apparaîtront ici automatiquement après un deal closé
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
