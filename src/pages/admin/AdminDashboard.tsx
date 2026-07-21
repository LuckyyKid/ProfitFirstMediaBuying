import { useEffect, useMemo, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Archive,
  ArchiveRestore,
  BellRing,
  ExternalLink,
  FileSignature,
  Handshake,
  LayoutDashboard,
  LogOut,
  Mail,
  MailCheck,
  MoreHorizontal,
  Plus,
  RefreshCcw,
  Send,
  Trash2,
  Users,
} from "lucide-react";
import {
  TwentyPage,
  PageHeader,
  NavPill,
  NavDivider,
  InsightStrip,
  StatPill,
  ViewBar,
  FilterChipBar,
  TwentyTableWrap,
  TwentyTable,
  TwentyThead,
  Th,
  TwentyRow,
  Td,
  EmptyRow,
  LoadingRow,
  StatusPill,
  StepDot,
} from "@/components/admin-shell";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { useAdminClients, archiveClient, deleteClient } from "@/hooks/useAdminClients";
import {
  ONBOARDING_STEPS,
  completedStepsCount,
  currentStepIndex,
  globalStatus,
  isStepDone,
  progressPercent,
  riskLevel,
  timeAgo,
} from "@/lib/onboardingHelpers";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const statusBadgeClass: Record<string, string> = {
  "Signed - Onboarding Sent": "bg-blue-50 text-blue-700 border-blue-200",
  "Onboarding Not Started": "bg-muted text-muted-foreground border-border",
  "Onboarding In Progress": "bg-cyan-50 text-cyan-700 border-cyan-200",
  "Onboarding Blocked": "bg-red-50 text-red-700 border-red-200",
  "Payment Pending": "bg-amber-50 text-amber-700 border-amber-200",
  "Contract Pending": "bg-amber-50 text-amber-700 border-amber-200",
  "Kick-off Not Booked": "bg-amber-50 text-amber-700 border-amber-200",
  "Onboarding Completed": "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const riskBadgeClass: Record<string, string> = {
  Low: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Normal: "bg-muted text-muted-foreground border-border",
  Medium: "bg-amber-50 text-amber-700 border-amber-200",
  High: "bg-red-50 text-red-700 border-red-200",
};

const FILTERS = [
  { key: "all", label: "Tous (actifs)" },
  { key: "not_started", label: "Non commencé" },
  { key: "in_progress", label: "En cours" },
  { key: "blocked", label: "Bloqués" },
  { key: "payment_pending", label: "Paiement en attente" },
  { key: "contract_pending", label: "Contrat en attente" },
  { key: "kickoff_pending", label: "Kick-off non booké" },
  { key: "completed", label: "Complétés" },
  { key: "high_risk", label: "Haut risque" },
  { key: "callback_due", label: "À rappeler" },
  { key: "followup_sent", label: "Suivi envoyé" },
  { key: "archived", label: "Archivés" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

const PAGE_SIZE = 20;

const AdminDashboard = () => {
  const { isAuthed, ready, logout } = useAdminAuth();
  const { clients, loading } = useAdminClients();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [runningCheck, setRunningCheck] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [confirmDelete, setConfirmDelete] = useState<{ id?: string | null; code?: string | null; name?: string } | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients.filter((c) => {
      const isArchived = Boolean(c.archived_at);
      if (filter === "archived") {
        if (!isArchived) return false;
      } else if (isArchived) {
        return false;
      }
      const status = globalStatus(c);
      const risk = riskLevel(c);
      if (filter === "not_started" && status !== "Onboarding Not Started" && status !== "Signed - Onboarding Sent") return false;
      if (filter === "in_progress" && status !== "Onboarding In Progress") return false;
      if (filter === "blocked" && status !== "Onboarding Blocked") return false;
      if (filter === "payment_pending" && status !== "Payment Pending") return false;
      if (filter === "contract_pending" && status !== "Contract Pending") return false;
      if (filter === "kickoff_pending" && status !== "Kick-off Not Booked") return false;
      if (filter === "completed" && status !== "Onboarding Completed") return false;
      if (filter === "high_risk" && risk !== "High") return false;
      if (filter === "callback_due" && !c.callback_due_at) return false;
      if (filter === "followup_sent" && !c.followup_sent_at) return false;
      if (!q) return true;
      const hay = [
        c.client_code, c.client_id, c.client_name, c.company_name, c.brand_name,
        c.email, c.phone,
      ].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [clients, search, filter]);

  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [search, filter]);

  const visible = filtered.slice(0, visibleCount);
  const activeFilterLabel = FILTERS.find((f) => f.key === filter)?.label ?? "";

  const chips = [
    ...(filter !== "all" ? [{ key: "filter", label: activeFilterLabel, onRemove: () => setFilter("all") }] : []),
    ...(search.trim() ? [{ key: "search", label: <>Recherche: {search}</>, onRemove: () => setSearch("") }] : []),
  ];

  const onArchive = async (c: any) => {
    try {
      await archiveClient(c.client_id, c.client_code, !c.archived_at);
      toast.success(c.archived_at ? "Client restauré" : "Client archivé");
    } catch (e: any) {
      toast.error(e?.message || "Échec");
    }
  };

  const onDeleteConfirmed = async () => {
    if (!confirmDelete) return;
    try {
      await deleteClient(confirmDelete.id, confirmDelete.code);
      toast.success("Client supprimé");
    } catch (e: any) {
      toast.error(e?.message || "Échec de la suppression");
    } finally {
      setConfirmDelete(null);
    }
  };

  const onResendWelcome = async (c: any) => {
    if (!c.email) { toast.error("Aucun email pour ce client"); return; }
    const t = toast.loading("Envoi de l'email de bienvenue…");
    const { error } = await supabase.functions.invoke("send-client-welcome-email", {
      body: {
        to: c.email,
        client_code: c.client_code,
        company_name: c.company_name || c.brand_name,
        contact_name: c.client_name,
        slack_invite_url: c.slack_invite_url,
        slack_channel_name: c.slack_channel_name,
        payment_url: c.stripe_payment_url,
      },
    });
    toast.dismiss(t);
    if (error) toast.error(error.message || "Échec de l'envoi");
    else toast.success(`Email de bienvenue envoyé à ${c.email}`);
  };

  const onSendFollowUp = async (c: any) => {
    if (!c.email) { toast.error("Aucun email pour ce client"); return; }
    const t = toast.loading("Envoi de l'email de suivi…");
    const { data, error } = await supabase.functions.invoke("follow-up-stuck-clients", {
      body: { client_code: c.client_code },
    });
    toast.dismiss(t);
    if (error) toast.error(error.message || "Échec de l'envoi");
    else if ((data as any)?.sent > 0) toast.success(`Email de suivi envoyé à ${c.email}`);
    else toast.message("Aucun email envoyé (vérifie l'email du client)");
  };

  const counts = useMemo(() => ({
    total: clients.length,
    blocked: clients.filter((c) => globalStatus(c) === "Onboarding Blocked").length,
    completed: clients.filter((c) => globalStatus(c) === "Onboarding Completed").length,
    highRisk: clients.filter((c) => riskLevel(c) === "High").length,
    callbackDue: clients.filter((c) => c.callback_due_at && !c.archived_at).length,
  }), [clients]);

  if (!ready) return <div className="min-h-screen" />;
  if (!isAuthed) return <Navigate to="/admin/login" replace />;

  const runChecks = async () => {
    setRunningCheck(true);
    const { error } = await supabase.functions.invoke("check-onboarding-alerts", { body: {} });
    setRunningCheck(false);
    if (error) toast.error("Erreur lors des vérifications");
    else toast.success("Vérifications terminées");
  };

  return (
    <TwentyPage>
      <PageHeader
        icon={Users}
        title="Admin Onboarding Dashboard"
        description="TDIA — vue centrale équipe interne"
        actions={
          <>
            <NavPill to="/admin/followups" icon={BellRing}>Suivi</NavPill>
            <NavPill to="/admin/deals" icon={Handshake}>Deals</NavPill>
            <NavPill to="/admin/contract-creator" icon={FileSignature}>Contrats</NavPill>
            <NavPill to="/admin/ops" icon={LayoutDashboard}>Ops</NavPill>
            <NavPill to="/admin/gos" icon={LayoutDashboard}>Profit First</NavPill>
            <NavPill to="/admin/crm" icon={LayoutDashboard}>CRM</NavPill>
            <NavDivider />
            <Button variant="ghost" size="sm" onClick={runChecks} disabled={runningCheck} className="h-7 px-2 text-xs hover:bg-muted">
              <RefreshCcw className={`h-3.5 w-3.5 mr-1 ${runningCheck ? "animate-spin" : ""}`} />
              Run checks
            </Button>
            <Button variant="ghost" size="sm" onClick={logout} className="h-7 px-2 text-xs hover:bg-muted">
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </>
        }
      />

      <InsightStrip>
        <StatPill label="Total" value={counts.total} />
        <StatPill label="Bloqués" value={counts.blocked} tone="red" onClick={() => setFilter("blocked")} active={filter === "blocked"} />
        <StatPill label="À rappeler" value={counts.callbackDue} tone="amber" onClick={() => setFilter("callback_due")} active={filter === "callback_due"} />
        <StatPill label="Complétés" value={counts.completed} tone="green" onClick={() => setFilter("completed")} active={filter === "completed"} />
        <StatPill label="Haut risque" value={counts.highRisk} tone="red" onClick={() => setFilter("high_risk")} active={filter === "high_risk"} />
      </InsightStrip>

      <ViewBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Rechercher (code, nom, entreprise, email, tel)…"
        filters={FILTERS}
        activeFilter={filter}
        onFilterChange={(k) => setFilter(k as FilterKey)}
        total={filtered.length}
        grandTotal={clients.length}
      />

      <FilterChipBar
        chips={chips}
        onReset={() => { setFilter("all"); setSearch(""); }}
      />

      <TwentyTableWrap>
        <TwentyTable>
          <TwentyThead>
            <Th className="w-8"></Th>
            <Th>Client</Th>
            <Th>Entreprise</Th>
            <Th>Contact</Th>
            <Th>Closer</Th>
            <Th>Deal</Th>
            <Th>Statut</Th>
            <Th>Étape</Th>
            <Th className="w-[160px]">Progression</Th>
            <Th>Pay.</Th>
            <Th>Ctrt.</Th>
            <Th>K/off</Th>
            <Th>Activité</Th>
            <Th>Suivi</Th>
            <Th>Risque</Th>
            <Th className="w-16"></Th>
          </TwentyThead>
          <tbody>
            {loading ? (
              <LoadingRow colSpan={16} />
            ) : visible.length === 0 ? (
              <EmptyRow colSpan={16} title="Aucun client" hint="Ajuste tes filtres ou clique sur « Réinitialiser »." />
            ) : visible.map((c) => {
              const status = globalStatus(c);
              const risk = riskLevel(c);
              const stepIdx = currentStepIndex(c);
              const stepLabel = ONBOARDING_STEPS[stepIdx]?.label ?? "—";
              const pct = progressPercent(c);
              const done = completedStepsCount(c);
              const detailRef = c.client_id || c.client_code;
              const archived = Boolean(c.archived_at);
              return (
                <TwentyRow key={detailRef} archived={archived}>
                  <Td className="w-8 text-center">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground/30 group-hover:bg-primary/60 transition-colors" />
                  </Td>
                  <Td>
                    <div className="font-medium text-foreground flex items-center gap-1.5">
                      <span className="truncate">{c.client_name || "—"}</span>
                      {archived && <span className="text-[9px] uppercase px-1 py-px rounded bg-muted text-muted-foreground border border-border">arch.</span>}
                    </div>
                    <div className="text-[10px] text-muted-foreground font-mono">{c.client_code}</div>
                  </Td>
                  <Td>{c.company_name || c.brand_name || "—"}</Td>
                  <Td>
                    <div>{c.email || "—"}</div>
                    {c.phone && <div className="text-[10px] text-muted-foreground">{c.phone}</div>}
                  </Td>
                  <Td>{c.closer_name || "—"}</Td>
                  <Td className="tabular-nums">{c.deal_value ? `${c.deal_value} $` : "—"}</Td>
                  <Td><StatusPill className={statusBadgeClass[status]}>{status}</StatusPill></Td>
                  <Td className="truncate max-w-[140px]">{stepLabel}</Td>
                  <Td>
                    <div className="space-y-1">
                      <Progress value={pct} className="h-1" />
                      <div className="text-[10px] text-muted-foreground tabular-nums">{done}/8 · {pct}%</div>
                    </div>
                  </Td>
                  <Td><StepDot done={isStepDone(c, 4)} /></Td>
                  <Td><StepDot done={isStepDone(c, 5)} /></Td>
                  <Td><StepDot done={isStepDone(c, 6)} /></Td>
                  <Td className="text-[10px] text-muted-foreground whitespace-nowrap">{timeAgo(c.last_activity_at)}</Td>
                  <Td><FollowupCell client={c} /></Td>
                  <Td><StatusPill className={riskBadgeClass[risk]}>{risk}</StatusPill></Td>
                  <Td>
                    <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button asChild size="sm" variant="ghost" className="h-6 px-1.5 text-[11px] hover:bg-background">
                        <Link to={`/admin/clients/${encodeURIComponent(detailRef)}`}>
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-6 w-6 hover:bg-background">
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onResendWelcome(c)} disabled={!c.email}>
                            {c.welcome_sent_at ? (
                              <><MailCheck className="h-4 w-4 mr-2" />Renvoyer email de bienvenue</>
                            ) : (
                              <><Mail className="h-4 w-4 mr-2" />Envoyer email de bienvenue</>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onSendFollowUp(c)} disabled={!c.email}>
                            <Send className="h-4 w-4 mr-2" />
                            {c.followup_sent_at ? "Renvoyer email de suivi" : "Envoyer email de suivi"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => onArchive(c)}>
                            {archived ? (
                              <><ArchiveRestore className="h-4 w-4 mr-2" />Restaurer</>
                            ) : (
                              <><Archive className="h-4 w-4 mr-2" />Archiver</>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setConfirmDelete({ id: c.client_id, code: c.client_code, name: c.client_name || c.company_name || c.client_code })}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </Td>
                </TwentyRow>
              );
            })}
            {!loading && filtered.length > visibleCount && (
              <tr>
                <td colSpan={16} className="py-3 text-center">
                  <button
                    onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
                    className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    <Plus className="h-3 w-3" />
                    Voir {Math.min(PAGE_SIZE, filtered.length - visibleCount)} de plus ({filtered.length - visibleCount} restants)
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </TwentyTable>
      </TwentyTableWrap>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce client&nbsp;?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est <strong>irréversible</strong>. Le client {confirmDelete?.name ? <strong>{confirmDelete.name}</strong> : "sélectionné"} ainsi que ses réponses de formulaires, accès plateformes et historique d'activité seront supprimés. Si vous voulez juste le masquer du tableau, utilisez plutôt « Archiver ».
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={onDeleteConfirmed} className="bg-destructive hover:bg-destructive/90">
              Supprimer définitivement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TwentyPage>
  );
};

const FollowupCell = ({ client }: { client: any }) => {
  if (client.callback_due_at) {
    return (
      <div>
        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] border border-amber-200 bg-amber-50 text-amber-700 font-medium">
          À rappeler
        </span>
        <div className="text-[10px] text-muted-foreground mt-0.5">depuis {timeAgo(client.callback_due_at)}</div>
      </div>
    );
  }
  if (client.followup_sent_at) {
    return (
      <div>
        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] border border-sky-200 bg-sky-50 text-sky-700">
          Suivi envoyé
        </span>
        <div className="text-[10px] text-muted-foreground mt-0.5">
          il y a {timeAgo(client.followup_sent_at)}
          {client.followup_count > 1 ? ` · ${client.followup_count}×` : ""}
        </div>
      </div>
    );
  }
  return <span className="text-[10px] text-muted-foreground">—</span>;
};

export default AdminDashboard;
