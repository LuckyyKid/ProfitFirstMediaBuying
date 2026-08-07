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
import { Archive, ArchiveRestore, BellRing, ExternalLink, FileSignature, Handshake, Hash, LayoutDashboard, LogOut, Mail, MailCheck, MessageSquare, MoreHorizontal, RefreshCcw, Search, Send, Trash2 } from "lucide-react";
import { NotificationBell } from "@/components/admin/NotificationBell";
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
      body: { client_code: c.client_code, channel: "email" },
    });
    toast.dismiss(t);
    if (error) toast.error(error.message || "Échec de l'envoi");
    else if ((data as any)?.sent > 0) toast.success(`Email de suivi envoyé à ${c.email}`);
    else toast.message("Aucun email envoyé (vérifie l'email du client)");
  };

  const onSendSmsFollowUp = async (c: any) => {
    if (!c.phone) { toast.error("Aucun téléphone pour ce client"); return; }
    const t = toast.loading("Envoi du SMS de suivi…");
    const { data, error } = await supabase.functions.invoke("follow-up-stuck-clients", {
      body: { client_code: c.client_code, channel: "sms" },
    });
    toast.dismiss(t);
    if (error) toast.error(error.message || "Échec de l'envoi");
    else if ((data as any)?.smsSent > 0) toast.success(`SMS de suivi envoyé à ${c.phone}`);
    else toast.message("Aucun SMS envoyé (vérifie le téléphone du client ou les credentials Twilio)");
  };

  const onSendContractEmail = async (c: any) => {
    if (!c.email) { toast.error("Aucun email pour ce client"); return; }
    if (!c.manual_contract_pdf_url) {
      toast.error("Aucun contrat trouvé. Génère-le d'abord dans admin/contract-creator.");
      return;
    }
    const signerName = c.client_name || c.company_name || c.brand_name || c.client_code;
    const t = toast.loading("Préparation du contrat DocuSign…");
    try {
      // The bucket is private, so the stored public URL returns 400 in the
      // browser. Extract the object path and download it via the storage SDK,
      // which uses the admin's authenticated session.
      const url = String(c.manual_contract_pdf_url);
      const pathMatch = url.match(
        /\/storage\/v1\/object\/(?:public|sign|authenticated)\/closed-deals-contracts\/([^?]+)/i,
      );
      const objectPath = pathMatch?.[1] ? decodeURIComponent(pathMatch[1]) : null;
      if (!objectPath) {
        throw new Error("URL du contrat non reconnue (chemin storage introuvable)");
      }
      const { data: blob, error: dlErr } = await supabase.storage
        .from("closed-deals-contracts")
        .download(objectPath);
      if (dlErr || !blob) {
        throw new Error(dlErr?.message || "Téléchargement du PDF échoué");
      }
      const pdfBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(((reader.result as string) || "").split(",")[1] ?? "");
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
      const { data, error } = await supabase.functions.invoke("send-docusign-contract-email", {
        body: {
          email: c.email,
          name: signerName,
          client_code: c.client_code,
          contract_pdf_base64: pdfBase64,
        },
      });
      toast.dismiss(t);
      if (error) throw error;
      if ((data as any)?.envelopeId) {
        toast.success(`Contrat DocuSign envoyé à ${c.email}`);
      } else {
        toast.error("Envoi DocuSign : réponse sans envelope ID");
      }
    } catch (e: any) {
      toast.dismiss(t);
      console.error("[send-docusign-contract-email]", e);
      toast.error(e?.message || "Échec de l'envoi du contrat par email");
    }
  };

  const onResendSlackInvite = async (c: any) => {
    if (!c.email) { toast.error("Aucun email pour ce client"); return; }
    if (!c.company_name && !c.brand_name) { toast.error("Aucun nom de compagnie"); return; }
    const t = toast.loading("Envoi de l'invitation Slack…");
    const { data, error } = await supabase.functions.invoke("setup-slack-onboarding", {
      body: {
        email: c.email,
        companyName: c.company_name || c.brand_name,
        clientId: c.client_id,
        clientCode: c.client_code,
        // Explicit channelId lets the function skip the lookup/creation step
        // and go straight to invite (fixes case where bot was removed from channel).
        channelId: c.slack_channel_id ?? undefined,
      },
    });
    toast.dismiss(t);
    // Always log the full response so we can debug from the console.
    console.log("[setup-slack-onboarding response]", { data, error });
    if (error) {
      toast.error(error.message || "Échec de l'appel");
      return;
    }
    const r = data as { channelId?: string | null; slackUserId?: string | null; inviteUrl?: string | null; errors?: string[] };
    if (r.errors && r.errors.length > 0) {
      toast.error(`Slack errors: ${r.errors.join(" | ")}`, { duration: 15000 });
    } else if (r.inviteUrl) {
      toast.success(`Invitation Slack envoyée à ${c.email}`);
    } else if (r.slackUserId) {
      toast.success(`Client déjà membre du workspace, ajouté au canal`);
    } else {
      toast.message("Appel exécuté sans erreur, mais aucun inviteUrl ni slackUserId retourné — vérifier logs edge function", { duration: 15000 });
    }
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
    <div className="premium-shell min-h-screen px-3 sm:px-4 md:px-8 py-6 sm:py-8">
      <div className="w-full mx-auto space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Admin Onboarding Dashboard</h1>
            <p className="text-sm text-muted-foreground">TDIA — vue centrale équipe interne</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <NotificationBell />
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
              <SelectTrigger className="w-full sm:w-[220px]">
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

          <div className="admin-clients-scroll">
            <Table className="min-w-[1800px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 z-30 bg-background whitespace-nowrap w-[220px] shadow-[8px_0_16px_-8px_rgba(0,0,0,0.4)]">Client</TableHead>
                  <TableHead className="whitespace-nowrap">Entreprise</TableHead>
                  <TableHead className="whitespace-nowrap">Contact</TableHead>
                  <TableHead className="whitespace-nowrap">Closer</TableHead>
                  <TableHead className="whitespace-nowrap">Deal</TableHead>
                  <TableHead className="whitespace-nowrap">Statut</TableHead>
                  <TableHead className="whitespace-nowrap">Étape</TableHead>
                  <TableHead className="w-[160px] whitespace-nowrap">Progression</TableHead>
                  <TableHead className="whitespace-nowrap">Paiement</TableHead>
                  <TableHead className="whitespace-nowrap">Contrat</TableHead>
                  <TableHead className="whitespace-nowrap">Kick-off</TableHead>
                  <TableHead className="whitespace-nowrap">Activité</TableHead>
                  <TableHead className="whitespace-nowrap">Suivi</TableHead>
                  <TableHead className="whitespace-nowrap">Risque</TableHead>
                  <TableHead className="sticky right-0 z-30 bg-background whitespace-nowrap w-[160px] shadow-[-8px_0_16px_-8px_rgba(0,0,0,0.4)]">Actions</TableHead>
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
                      <TableCell className="sticky left-0 z-20 bg-background w-[220px] shadow-[8px_0_16px_-8px_rgba(0,0,0,0.4)]">
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
                      <TableCell className="sticky right-0 z-20 bg-background w-[160px] shadow-[-8px_0_16px_-8px_rgba(0,0,0,0.4)]">
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
                              <DropdownMenuItem onClick={() => onSendSmsFollowUp(c)} disabled={!c.phone}>
                                <MessageSquare className="h-4 w-4 mr-2" />
                                {c.followup_sent_at ? "Renvoyer SMS de suivi" : "Envoyer SMS de suivi"}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => onResendSlackInvite(c)} disabled={!c.email || (!c.company_name && !c.brand_name)}>
                                <Hash className="h-4 w-4 mr-2" />
                                Renvoyer invitation Slack
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => onSendContractEmail(c)}
                                disabled={!c.email || !c.manual_contract_pdf_url}
                                title={!c.manual_contract_pdf_url ? "Génère d'abord le contrat dans admin/contract-creator" : undefined}
                              >
                                <FileSignature className="h-4 w-4 mr-2" />
                                Envoyer contrat par email
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
    <div className={`text-2xl font-mono font-medium mt-1 ${tone === "red" ? "text-[hsl(var(--bad))]" : tone === "green" ? "text-[hsl(var(--good))]" : tone === "amber" ? "text-[hsl(var(--watch))]" : "text-foreground"}`}>
      {value}
    </div>
  </Card>
);

const StepDot = ({ done }: { done: boolean }) => (
  <span className={`inline-block h-2.5 w-2.5 rounded-full ${done ? "bg-[hsl(var(--good))] shadow-[0_0_6px_rgba(122,232,180,0.5)]" : "bg-[rgba(148,170,215,0.15)]"}`} />
);

const FollowupCell = ({ client }: { client: any }) => {
  if (client.callback_due_at) {
    return (
      <div className="space-y-0.5">
        <span className="inline-block px-2 py-0.5 rounded-[6px] font-mono text-[9px] uppercase tracking-[0.16em] border border-[rgba(255,184,77,0.3)] bg-[rgba(255,184,77,0.06)] text-[hsl(var(--watch))]">
          À rappeler
        </span>
        <div className="text-[11px] text-muted-foreground">depuis {timeAgo(client.callback_due_at)}</div>
      </div>
    );
  }
  if (client.followup_sent_at) {
    return (
      <div className="space-y-0.5">
        <span className="inline-block px-2 py-0.5 rounded-[6px] font-mono text-[9px] uppercase tracking-[0.16em] border border-[rgba(77,159,255,0.3)] bg-[rgba(77,159,255,0.06)] text-[#9ec8ff]">
          Suivi envoyé
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
