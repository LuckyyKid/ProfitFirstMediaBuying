import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { RiskBadge, PhaseBadge } from "@/gos/ui";
import { useSelectedClient } from "@/gos/context";
import { buildGosClientPayload, loadDealSources } from "@/gos/dealPrefill";
import { toast } from "sonner";
import { ExternalLink, Zap, RefreshCw, Users, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  TwentyPage,
  PageHeader,
  NavDivider,
  ViewBar,
  TwentyTableWrap,
  TwentyTable,
  TwentyThead,
  Th,
  TwentyRow,
  Td,
  EmptyRow,
  LoadingRow,
} from "@/components/admin-shell";

type PendingRow = { key: string; label: string; deal: any | null; progress: any | null };

export default function GosClients() {
  const [rows, setRows] = useState<any[]>([]);
  const [pending, setPending] = useState<PendingRow[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState<string | null>(null);
  const { setSelectedClient } = useSelectedClient();
  const nav = useNavigate();

  const load = async () => {
    setLoading(true);
    const [{ data: clients }, { sources, existingCodes }] = await Promise.all([
      supabase.from("gos_clients").select("*").order("created_at", { ascending: false }),
      loadDealSources(),
    ]);
    setRows(clients ?? []);
    setPending(sources.filter((s) => !existingCodes.has(s.key)));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const activate = async (row: PendingRow) => {
    setActivating(row.key);
    const payload = buildGosClientPayload(row.deal, row.progress);
    if (!payload.client_code) payload.client_code = row.key;
    const { data, error } = await supabase.from("gos_clients").insert(payload).select().single();
    setActivating(null);
    if (error) { toast.error(error.message); return; }
    toast.success(`${payload.company_name} activé dans Profit First.`);
    setSelectedClient(data as any);
    nav(`/admin/gos/clients/${data.id}/workspace`);
  };

  const matchQ = (s: string | null | undefined) => !q || (s ?? "").toLowerCase().includes(q.toLowerCase());
  const filtered = useMemo(
    () => rows.filter((r) => [r.company_name, r.client_code, r.industry, r.am_owner].some(matchQ)),
    [rows, q],
  );
  const filteredPending = useMemo(
    () => pending.filter((p) => [p.label, p.key, p.deal?.owner_email, p.progress?.email].some(matchQ)),
    [pending, q],
  );

  return (
    <TwentyPage inLayout>
      <PageHeader
        icon={Users}
        title="Clients"
        description="Clients issus des deals fermés + onboarding, avec relation directe"
        actions={
          <>
            <Button size="sm" variant="ghost" onClick={load} className="h-7 px-2 text-xs hover:bg-muted">
              <RefreshCw className="h-3.5 w-3.5 mr-1" /> Actualiser
            </Button>
            <NavDivider />
            <Button asChild size="sm" className="h-7 px-2 text-xs">
              <Link to="/admin/gos/clients/new">
                <Plus className="h-3.5 w-3.5 mr-1" /> Créer
              </Link>
            </Button>
          </>
        }
      />

      <ViewBar
        search={q}
        onSearchChange={setQ}
        searchPlaceholder="Chercher entreprise, code, email, AM…"
        total={filtered.length + filteredPending.length}
      />

      <div className="flex-1 overflow-auto">
        {filteredPending.length > 0 && (
          <div className="border-b border-border">
            <div className="px-4 md:px-6 py-2 flex items-center justify-between bg-amber-500/10">
              <div>
                <div className="text-xs font-semibold text-foreground">À activer</div>
                <div className="text-[10px] text-muted-foreground">
                  Deals fermés / onboardings pas encore reliés à Profit First
                </div>
              </div>
              <div className="text-[10px] text-muted-foreground">{filteredPending.length} en attente</div>
            </div>
            <TwentyTable>
              <TwentyThead>
                <Th>Entreprise</Th>
                <Th>Code</Th>
                <Th>Source</Th>
                <Th>Contact</Th>
                <Th>Deal</Th>
                <Th className="w-24"></Th>
              </TwentyThead>
              <tbody>
                {filteredPending.map((r) => {
                  const contact = r.deal?.owner_email || r.progress?.email || r.deal?.contact_name || r.progress?.client_name || "—";
                  const deal = r.deal?.contract_value != null ? `$${Number(r.deal.contract_value).toLocaleString()}` : "—";
                  const sources: string[] = [];
                  if (r.deal) sources.push("deal");
                  if (r.progress) sources.push("onboarding");
                  return (
                    <TwentyRow key={r.key}>
                      <Td className="font-medium text-foreground">{r.label}</Td>
                      <Td className="font-mono text-muted-foreground">{r.key}</Td>
                      <Td className="text-[10px] uppercase tracking-wider text-primary">
                        {sources.join(" + ")}
                      </Td>
                      <Td>{contact}</Td>
                      <Td className="tabular-nums">{deal}</Td>
                      <Td>
                        <div className="flex justify-end">
                          <Button
                            size="sm"
                            disabled={activating === r.key}
                            onClick={() => activate(r)}
                            className="h-6 px-2 text-[10px]"
                          >
                            <Zap className="h-3 w-3 mr-1" />
                            {activating === r.key ? "Activation…" : "Activer"}
                          </Button>
                        </div>
                      </Td>
                    </TwentyRow>
                  );
                })}
              </tbody>
            </TwentyTable>
          </div>
        )}

        <div>
          <div className="px-4 md:px-6 py-2 flex items-center justify-between border-b border-border">
            <div className="text-xs font-semibold text-foreground">Actifs dans Profit First</div>
            <div className="text-[10px] text-muted-foreground">{filtered.length} client{filtered.length > 1 ? "s" : ""}</div>
          </div>
          <TwentyTableWrap>
            <TwentyTable>
              <TwentyThead>
                <Th>Company</Th>
                <Th>Code</Th>
                <Th>Business Type</Th>
                <Th>Industry</Th>
                <Th>Phase</Th>
                <Th>Risk</Th>
                <Th>AM Owner</Th>
                <Th className="w-24"></Th>
              </TwentyThead>
              <tbody>
                {loading ? (
                  <LoadingRow colSpan={8} />
                ) : filtered.length === 0 ? (
                  <EmptyRow colSpan={8} title="Aucun client actif" />
                ) : filtered.map((r) => (
                  <TwentyRow key={r.id}>
                    <Td className="font-medium text-foreground">{r.company_name}</Td>
                    <Td className="font-mono text-muted-foreground">{r.client_code}</Td>
                    <Td>{(r.business_type ?? "—").replace("_", " ")}</Td>
                    <Td>{r.industry ?? "—"}</Td>
                    <Td><PhaseBadge phase={r.current_phase} /></Td>
                    <Td><RiskBadge level={r.risk_level} /></Td>
                    <Td>{r.am_owner ?? "—"}</Td>
                    <Td>
                      <div className="flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => { setSelectedClient(r); nav(`/admin/gos/clients/${r.id}/workspace`); }}
                          className="h-6 w-6 hover:bg-background"
                          title="Open Workspace"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </div>
                    </Td>
                  </TwentyRow>
                ))}
              </tbody>
            </TwentyTable>
          </TwentyTableWrap>
        </div>
      </div>
    </TwentyPage>
  );
}
