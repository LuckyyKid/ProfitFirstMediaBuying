import { useMemo, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { useAdminClients, archiveClient, deleteClient } from "@/hooks/useAdminClients";
import {
  ONBOARDING_STEPS,
  completedStepsCount,
  currentStepIndex,
  globalStatus,
  isStepDone,
  progressPercent,
  riskBadgeClass,
  riskLevel,
  statusBadgeClass,
  timeAgo,
} from "@/lib/onboardingHelpers";
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
import { Archive, ArchiveRestore, BellRing, ExternalLink, FileSignature, Handshake, LayoutDashboard, LogOut, Mail, MailCheck, MoreHorizontal, RefreshCcw, Search, Send, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

  // Reset pagination when filter/search changes
  useMemo(() => { setVisibleCount(PAGE_SIZE); }, [search, filter]);

  const visible = filtered.slice(0, visibleCount);

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
    <div className="premium-shell min-h-screen px-4 md:px-8 py-8">
      <div className="max-w-[1600px] mx-auto space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Admin Onboarding Dashboard</h1>
            <p className="text-sm text-muted-foreground">TDIA — vue centrale équipe interne</p>
          </div>
          <div className="flex gap-2">
            <Button asChild size="sm" variant="hero">
              <Link to="/admin/followups">
                <BellRing className="h-4 w-4 mr-2" />
                Suivi clients
              </Link>
            </Button>
            <Button asChild size="sm" variant="hero">
              <Link to="/admin/deals">
                <Handshake className="h-4 w-4 mr-2" />
                Deals closés
              </Link>
            </Button>
            <Button asChild size="sm" variant="hero">
              <Link to="/admin/contract-creator">
                <FileSignature className="h-4 w-4 mr-2" />
                Générateur de contrats
              </Link>
            </Button>
            <Button asChild size="sm" variant="hero">
              <Link to="/admin/ops">
                <LayoutDashboard className="h-4 w-4 mr-2" />
                Agent Ops Dashboard
              </Link>
            </Button>


            <Button asChild size="sm" variant="hero">
              <Link to="/admin/gos">
                <LayoutDashboard className="h-4 w-4 mr-2" />
                Profit First Media Buying
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={runChecks} disabled={runningCheck}>
              <RefreshCcw className={`h-4 w-4 mr-2 ${runningCheck ? "animate-spin" : ""}`} />
              Run checks
            </Button>
            <Button variant="ghost" size="sm" onClick={logout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </header>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard label="Total clients" value={counts.total} />
          <StatCard label="Bloqués" value={counts.blocked} tone="red" />
          <StatCard label="À rappeler" value={counts.callbackDue} tone="amber" onClick={() => setFilter("callback_due")} />
          <StatCard label="Complétés" value={counts.completed} tone="green" />
          <StatCard label="Haut risque" value={counts.highRisk} tone="red" />
        </div>

        <Card className="p-4 space-y-4 glass-card">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher (code, nom, entreprise, email, tel)…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filter} onValueChange={(v) => setFilter(v as FilterKey)}>
              <SelectTrigger className="w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FILTERS.map((f) => (
                  <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="text-xs text-muted-foreground">
              {filtered.length} / {clients.length}
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Entreprise</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Closer</TableHead>
                  <TableHead>Deal</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Étape</TableHead>
                  <TableHead className="w-[160px]">Progression</TableHead>
                  <TableHead>Paiement</TableHead>
                  <TableHead>Contrat</TableHead>
                  <TableHead>Kick-off</TableHead>
                  <TableHead>Activité</TableHead>
                  <TableHead>Suivi</TableHead>
                  <TableHead>Risque</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={15} className="text-center py-8 text-muted-foreground">Chargement…</TableCell></TableRow>
                ) : visible.length === 0 ? (
                  <TableRow><TableCell colSpan={15} className="text-center py-8 text-muted-foreground">Aucun client</TableCell></TableRow>
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
                    <TableRow key={detailRef} className={archived ? "opacity-60" : ""}>
                      <TableCell>
                        <div className="font-medium flex items-center gap-2">
                          {c.client_name || "—"}
                          {archived && <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-muted text-muted-foreground">archivé</span>}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono">{c.client_code}</div>
                      </TableCell>
                      <TableCell>{c.company_name || c.brand_name || "—"}</TableCell>
                      <TableCell>
                        <div className="text-sm">{c.email || "—"}</div>
                        <div className="text-xs text-muted-foreground">{c.phone || ""}</div>
                      </TableCell>
                      <TableCell className="text-sm">{c.closer_name || "—"}</TableCell>
                      <TableCell className="text-sm">{c.deal_value ? `${c.deal_value} $` : "—"}</TableCell>
                      <TableCell>
                        <span className={`inline-block px-2 py-0.5 rounded-md text-xs border ${statusBadgeClass[status]}`}>
                          {status}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">{stepLabel}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Progress value={pct} className="h-2" />
                          <div className="text-xs text-muted-foreground">{done}/8 — {pct}%</div>
                        </div>
                      </TableCell>
                      <TableCell><StepDot done={isStepDone(c, 4)} /></TableCell>
                      <TableCell><StepDot done={isStepDone(c, 5)} /></TableCell>
                      <TableCell><StepDot done={isStepDone(c, 6)} /></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{timeAgo(c.last_activity_at)}</TableCell>
                      <TableCell><FollowupCell client={c} /></TableCell>
                      <TableCell>
                        <span className={`inline-block px-2 py-0.5 rounded-md text-xs border ${riskBadgeClass[risk]}`}>
                          {risk}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button asChild size="sm" variant="outline">
                            <Link to={`/admin/clients/${encodeURIComponent(detailRef)}`}>
                              Ouvrir <ExternalLink className="h-3 w-3 ml-1" />
                            </Link>
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
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
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {!loading && filtered.length > visibleCount && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" size="sm" onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}>
                Voir plus ({filtered.length - visibleCount} restants)
              </Button>
            </div>
          )}
        </Card>
      </div>

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
    </div>
  );
};


const StatCard = ({ label, value, tone, onClick }: { label: string; value: number; tone?: "red" | "green" | "amber"; onClick?: () => void }) => (
  <Card
    className={`p-4 glass-card ${onClick ? "cursor-pointer hover:ring-1 hover:ring-primary/40 transition" : ""}`}
    onClick={onClick}
  >
    <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
    <div className={`text-2xl font-bold mt-1 ${tone === "red" ? "text-red-400" : tone === "green" ? "text-emerald-400" : tone === "amber" ? "text-amber-400" : ""}`}>
      {value}
    </div>
  </Card>
);

const StepDot = ({ done }: { done: boolean }) => (
  <span className={`inline-block h-2.5 w-2.5 rounded-full ${done ? "bg-emerald-400" : "bg-zinc-600"}`} />
);

const FollowupCell = ({ client }: { client: any }) => {
  if (client.callback_due_at) {
    return (
      <div className="space-y-0.5">
        <span className="inline-block px-2 py-0.5 rounded-md text-xs border border-amber-500/40 bg-amber-500/10 text-amber-300 font-medium">
          📞 À rappeler
        </span>
        <div className="text-[11px] text-muted-foreground">depuis {timeAgo(client.callback_due_at)}</div>
      </div>
    );
  }
  if (client.followup_sent_at) {
    return (
      <div className="space-y-0.5">
        <span className="inline-block px-2 py-0.5 rounded-md text-xs border border-sky-500/40 bg-sky-500/10 text-sky-300">
          ✉️ Suivi envoyé
        </span>
        <div className="text-[11px] text-muted-foreground">
          il y a {timeAgo(client.followup_sent_at)}
          {client.followup_count > 1 ? ` · ${client.followup_count}×` : ""}
        </div>
      </div>
    );
  }
  return <span className="text-xs text-muted-foreground">—</span>;
};

export default AdminDashboard;
