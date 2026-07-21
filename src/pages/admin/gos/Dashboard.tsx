import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { RiskBadge, PhaseBadge } from "@/gos/ui";
import {
  RefreshCw,
  ExternalLink,
  Users,
  AlertTriangle,
  AlertCircle,
  Settings,
  LineChart,
  LayoutDashboard,
} from "lucide-react";
import { useSelectedClient } from "@/gos/context";
import { Button } from "@/components/ui/button";
import {
  TwentyPage,
  PageHeader,
  NavDivider,
  InsightStrip,
  StatPill,
  TwentyTableWrap,
  TwentyTable,
  TwentyThead,
  Th,
  TwentyRow,
  Td,
  EmptyRow,
  LoadingRow,
} from "@/components/admin-shell";

type Client = {
  id: string;
  client_code: string;
  company_name: string;
  business_type: string;
  current_phase: string;
  risk_level: string;
  am_owner: string | null;
  industry: string | null;
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function GosDashboard() {
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [ready, setReady] = useState<Set<string>>(new Set());
  const [hasForecast, setHasForecast] = useState<Set<string>>(new Set());
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const nav = useNavigate();
  const { setSelectedClient, workflowMode, setWorkflowMode } = useSelectedClient();
  const workflowModes = [
    { key: "new-client" as const, label: "Nouveau client" },
    { key: "active-client" as const, label: "Client actif" },
  ];

  const load = async () => {
    setLoading(true);
    const { data: cs } = await supabase
      .from("gos_clients")
      .select("*")
      .order("created_at", { ascending: false });
    setClients((cs as any) ?? []);
    const [{ data: bc }, { data: fi }, { data: qb }] = await Promise.all([
      supabase.from("gos_business_contexts").select("client_id,status"),
      supabase.from("gos_financial_inputs").select("client_id,status"),
      supabase.from("gos_quantitative_baselines").select("client_id,status"),
    ]);
    const bcs = new Map((bc ?? []).map((r) => [r.client_id, r.status]));
    const fis = new Map((fi ?? []).map((r) => [r.client_id, r.status]));
    const qbs = new Map((qb ?? []).map((r) => [r.client_id, r.status]));
    const readySet = new Set<string>();
    (cs ?? []).forEach((c: any) => {
      const ok = ["PRÊT", "APPROVED"];
      if (
        ok.includes(bcs.get(c.id) ?? "") &&
        ok.includes(fis.get(c.id) ?? "") &&
        ok.includes(qbs.get(c.id) ?? "")
      ) {
        readySet.add(c.id);
      }
    });
    setReady(readySet);
    setHasForecast(new Set());
    setLoading(false);
    setLastRefresh(new Date());
  };

  useEffect(() => {
    load();
  }, []);

  const totalClients = clients.length;
  const atRisk = clients.filter(
    (c) => ["HIGH", "CRITICAL"].includes(c.risk_level) || c.current_phase === "AT_RISK"
  ).length;
  const missingSetup = clients.filter((c) => !ready.has(c.id)).length;
  const needAttention = clients.filter(
    (c) => ["HIGH", "CRITICAL"].includes(c.risk_level) || !ready.has(c.id)
  ).length;
  const missingForecast = clients.filter((c) => !hasForecast.has(c.id)).length;

  const setupPct =
    totalClients > 0 ? Math.round(((totalClients - missingSetup) / totalClients) * 100) : 0;

  const attention = clients
    .filter(
      (c) =>
        ["HIGH", "CRITICAL"].includes(c.risk_level) ||
        c.current_phase === "AT_RISK" ||
        !ready.has(c.id)
    )
    .slice(0, 5);

  const goToClient = (
    c: Client,
    path: "workspace" | "intelligence" | "profit-first-workspace" = "workspace"
  ) => {
    setSelectedClient(c);
    nav(`/admin/gos/clients/${c.id}/${path}`);
  };

  const timeStr = lastRefresh.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <TwentyPage inLayout>
      <PageHeader
        icon={LayoutDashboard}
        title="Tableau de bord TDIA Intelligence"
        description="Cockpit AM global — risque, progression et prochaines actions"
        actions={
          <>
            <div className="hidden md:flex items-center bg-secondary rounded-md p-0.5">
              {workflowModes.map((mode) => {
                const active = workflowMode === mode.key;
                return (
                  <button
                    key={mode.key}
                    type="button"
                    onClick={() => setWorkflowMode(mode.key)}
                    className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                      active
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {mode.label}
                  </button>
                );
              })}
            </div>
            <NavDivider />
            <Button size="sm" variant="ghost" onClick={load} className="h-7 px-2 text-xs hover:bg-muted">
              <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
            </Button>
            <Button asChild size="sm" className="h-7 px-2 text-xs">
              <Link to="/admin/gos/clients/new">New Client</Link>
            </Button>
          </>
        }
      />

      <InsightStrip>
        <StatPill label="Total clients" value={totalClients} tone="blue" />
        <StatPill label="Nécessitent attention" value={needAttention} tone="amber" />
        <StatPill label="À risque" value={atRisk} tone="red" />
        <StatPill label="Config manquante" value={missingSetup} />
        <StatPill label="Prévision manquante" value={missingForecast} />
      </InsightStrip>

      <div className="flex-1 overflow-auto">
        {/* Attention Queue */}
        <div>
          <div className="px-4 md:px-6 py-2 flex items-center justify-between border-b border-border bg-amber-500/10">
            <div>
              <div className="text-xs font-semibold text-foreground">Attention Queue</div>
              <div className="text-[10px] text-muted-foreground">Top 5 clients triés par urgence</div>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <span>MAJ {timeStr}</span>
              <Link to="/admin/gos/clients" className="text-primary hover:underline">
                Voir tout
              </Link>
            </div>
          </div>
          <TwentyTable>
            <TwentyThead>
              <Th>Client</Th>
              <Th>Risk</Th>
              <Th>Phase</Th>
              <Th>Problème</Th>
              <Th>Next Action</Th>
              <Th className="w-32"></Th>
            </TwentyThead>
            <tbody>
              {loading ? (
                <LoadingRow colSpan={6} />
              ) : attention.length === 0 ? (
                <EmptyRow colSpan={6} title="Tout va bien — aucun client urgent" />
              ) : attention.map((c) => {
                const problem = !ready.has(c.id)
                  ? "Configuration du modèle incomplète"
                  : "Flag haut risque";
                const next = !ready.has(c.id)
                  ? "Compléter la configuration"
                  : "Revoir l'espace";
                return (
                  <TwentyRow key={c.id}>
                    <Td className="font-medium text-foreground">{c.company_name}</Td>
                    <Td><RiskBadge level={c.risk_level} /></Td>
                    <Td><PhaseBadge phase={c.current_phase} /></Td>
                    <Td className="text-muted-foreground">{problem}</Td>
                    <Td className="text-muted-foreground">{next}</Td>
                    <Td>
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => goToClient(c, "profit-first-workspace")}
                          className="h-6 px-2 text-[10px] hover:bg-muted"
                        >
                          Profit Plan
                        </Button>
                      </div>
                    </Td>
                  </TwentyRow>
                );
              })}
            </tbody>
          </TwentyTable>
        </div>

        {/* Client Overview */}
        <div className="border-t border-border">
          <div className="px-4 md:px-6 py-2 flex items-center justify-between border-b border-border">
            <div className="text-xs font-semibold text-foreground">Client Overview</div>
            <Link to="/admin/gos/clients" className="text-[10px] text-primary hover:underline">
              Voir tout
            </Link>
          </div>
          <TwentyTable>
            <TwentyThead>
              <Th>Client</Th>
              <Th>Business Type</Th>
              <Th>Phase</Th>
              <Th>Growth Setup</Th>
              <Th>AM Owner</Th>
              <Th>Next Action</Th>
              <Th className="w-40"></Th>
            </TwentyThead>
            <tbody>
              {loading ? (
                <LoadingRow colSpan={7} />
              ) : clients.length === 0 ? (
                <EmptyRow colSpan={7} title="Aucun client — crée ton premier client pour démarrer" />
              ) : clients.map((c) => {
                const isReady = ready.has(c.id);
                return (
                  <TwentyRow key={c.id}>
                    <Td className="font-medium text-foreground">{c.company_name}</Td>
                    <Td className="text-muted-foreground">{c.business_type.replace("_", " ")}</Td>
                    <Td><PhaseBadge phase={c.current_phase} /></Td>
                    <Td>
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                          isReady
                            ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
                            : "bg-amber-500/15 text-amber-300 border-amber-500/40"
                        }`}
                      >
                        {isReady ? "PRÊT" : "INCOMPLET"}
                      </span>
                    </Td>
                    <Td className="text-muted-foreground">{c.am_owner ?? "—"}</Td>
                    <Td className="text-muted-foreground">
                      {isReady ? "Lancer le diagnostic" : "Compléter la configuration"}
                    </Td>
                    <Td>
                      <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => goToClient(c, "profit-first-workspace")}
                          title="Profit Plan"
                          className="h-6 w-6 hover:bg-background"
                        >
                          <LineChart className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => goToClient(c, "workspace")}
                          title="Workspace"
                          className="h-6 w-6 hover:bg-background"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </div>
                    </Td>
                  </TwentyRow>
                );
              })}
            </tbody>
          </TwentyTable>
        </div>

        {/* Bottom KPI Grid */}
        <div className="border-t border-border p-4 md:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="border border-border rounded-md p-4 flex items-center gap-4">
            <div className="relative w-14 h-14 flex items-center justify-center shrink-0">
              <svg className="absolute w-full h-full -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="16" fill="none" className="stroke-border" strokeWidth="2.5" />
                <circle
                  cx="18" cy="18" r="16"
                  fill="none"
                  className="stroke-primary"
                  strokeWidth="2.5"
                  strokeDasharray="100"
                  strokeDashoffset={100 - setupPct}
                  strokeLinecap="round"
                />
              </svg>
              <span className="text-[11px] font-bold text-foreground tabular-nums">{setupPct}%</span>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Configuration du modèle
              </div>
              <div className="text-base font-semibold text-foreground mt-0.5 tabular-nums">
                {totalClients - missingSetup} / {totalClients}
              </div>
            </div>
          </div>

          <div className="border border-border rounded-md p-4">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Prévisions
            </div>
            <div className="text-xl font-semibold text-foreground tabular-nums">
              0 / {totalClients}
            </div>
            <div className="mt-2 flex gap-1 items-end h-8">
              {[0.4, 0.6, 0.5, 0.8, 0.7, 0.5].map((h, i) => (
                <div key={i} className="w-1.5 bg-primary/30 rounded-full" style={{ height: `${h * 100}%` }} />
              ))}
            </div>
          </div>

          <div className="border border-border rounded-md p-4">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" /> Optimisation live
            </div>
            <div className="text-xl font-semibold text-foreground">—</div>
            <div className="mt-2 text-[10px] text-muted-foreground italic">
              En attente de données de production
            </div>
          </div>

          <div className="border border-border rounded-md p-4">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
              <Settings className="h-3 w-3" /> Boucle d'apprentissage
            </div>
            <div className="text-xl font-semibold text-foreground">—</div>
            <div className="mt-3 h-1 bg-border rounded-full w-full overflow-hidden">
              <div className="h-full bg-primary" style={{ width: "0%" }} />
            </div>
          </div>
        </div>
      </div>
    </TwentyPage>
  );
}
