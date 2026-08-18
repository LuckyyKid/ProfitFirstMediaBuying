import { useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, LogOut, Search } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { useAdminClients } from "@/hooks/useAdminClients";
import { MetaAdsDashboard } from "@/components/portal/MetaAdsDashboard";
import { AmActivityLogWidget } from "@/components/admin/AmActivityLogWidget";
import { GenerateReportWizard } from "@/components/admin/reports/GenerateReportWizard";
import { ReportHistoryDialog } from "@/components/admin/reports/ReportHistoryDialog";

const MetaAdsMonitor = () => {
  const { isAuthed, ready, logout } = useAdminAuth();
  const { clients, loading } = useAdminClients();
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const options = useMemo(() => {
    const rows = clients
      .filter((c) => c.client_code && !c.archived_at)
      .map((c) => ({
        code: c.client_code as string,
        label:
          (c.company_name as string | undefined) ||
          (c.brand_name as string | undefined) ||
          (c.client_name as string | undefined) ||
          (c.client_code as string),
        secondary: [c.client_name, c.email].filter(Boolean).join(" · "),
      }));
    rows.sort((a, b) => a.label.localeCompare(b.label, "fr"));
    return rows;
  }, [clients]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) =>
      `${o.code} ${o.label} ${o.secondary}`.toLowerCase().includes(q),
    );
  }, [options, search]);

  const selected = useMemo(
    () => options.find((o) => o.code === selectedCode) ?? null,
    [options, selectedCode],
  );

  if (!ready) return <div className="min-h-screen" />;
  if (!isAuthed) return <Navigate to="/admin/login" replace />;

  return (
    <div className="premium-shell min-h-screen px-3 sm:px-4 md:px-8 py-6 sm:py-8">
      <div className="w-full mx-auto space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Performances clients — Meta Ads
            </h1>
            <p className="text-sm text-muted-foreground">
              Vue admin. Sélectionne un client pour voir exactement le dashboard qu'il consulte
              dans son portail.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link to="/admin">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Admin
              </Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={logout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <Card className="p-4 glass-card space-y-3 h-fit">
            <div>
              <h2 className="text-sm font-medium">Clients</h2>
              <p className="text-xs text-muted-foreground mt-1">
                {loading
                  ? "Chargement…"
                  : `${options.length} client${options.length > 1 ? "s" : ""} disponible${options.length > 1 ? "s" : ""}`}
              </p>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher (nom, code, email)…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="max-h-[70vh] overflow-y-auto -mx-1 pr-1">
              {filtered.length === 0 ? (
                <div className="text-xs text-muted-foreground px-2 py-3">
                  Aucun client ne correspond.
                </div>
              ) : (
                <ul className="space-y-1">
                  {filtered.map((o) => {
                    const active = o.code === selectedCode;
                    return (
                      <li key={o.code}>
                        <button
                          type="button"
                          onClick={() => setSelectedCode(o.code)}
                          className={`w-full text-left rounded-md px-3 py-2 border transition ${
                            active
                              ? "border-primary/40 bg-primary/10"
                              : "border-transparent hover:bg-muted/20 hover:border-border/40"
                          }`}
                        >
                          <div className="text-sm font-medium truncate">{o.label}</div>
                          <div className="text-[11px] text-muted-foreground font-mono truncate">
                            {o.code}
                          </div>
                          {o.secondary && (
                            <div className="text-[11px] text-muted-foreground truncate">
                              {o.secondary}
                            </div>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </Card>

          <div className="min-w-0">
            {selected ? (
              <Card className="glass-card overflow-hidden">
                <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-border/40">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{selected.label}</div>
                    <div className="text-[11px] text-muted-foreground font-mono truncate">
                      {selected.code}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <GenerateReportWizard
                      clientCode={selected.code}
                      clientLabel={selected.label}
                    />
                    <ReportHistoryDialog
                      clientCode={selected.code}
                      clientLabel={selected.label}
                    />
                    <Button asChild size="sm" variant="ghost">
                      <Link to={`/admin/clients/${selected.code}`}>Fiche client</Link>
                    </Button>
                  </div>
                </div>
                <div style={{ background: "#060910" }}>
                  <MetaAdsDashboard clientCode={selected.code} initialPeriod="30j" />
                </div>
              </Card>
            ) : (
              <Card className="glass-card p-10 text-center text-sm text-muted-foreground">
                Sélectionne un client à gauche pour afficher ses performances Meta Ads.
              </Card>
            )}
          </div>
        </div>
      </div>

      <AmActivityLogWidget
        clientCode={selected?.code ?? null}
        clientLabel={selected?.label ?? null}
      />
    </div>
  );
};

export default MetaAdsMonitor;
