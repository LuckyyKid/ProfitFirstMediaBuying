import { useEffect, useMemo, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import { Archive, ArchiveRestore, Bell, ChevronDown, ExternalLink, FileSignature, Hash, Heart, LogOut, Mail, MailCheck, MessageSquare, MoreHorizontal, RefreshCcw, Search, Send, Trash2, Zap } from "lucide-react";
import { LogNpsDialog } from "@/components/admin/LogNpsDialog";
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
const NOTIF_STORAGE_KEY = "admin_notifications_last_seen";
const NOTIF_LOOKBACK_DAYS = 30;

const AdminDashboard = () => {
  const { isAuthed, ready, logout } = useAdminAuth();
  const { clients, loading } = useAdminClients();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [runningCheck, setRunningCheck] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [confirmDelete, setConfirmDelete] = useState<{ id?: string | null; code?: string | null; name?: string } | null>(null);
  const [npsDialogClient, setNpsDialogClient] = useState<{ client_code: string; client_name?: string | null; company_name?: string | null } | null>(null);
  const [unreadNotifs, setUnreadNotifs] = useState(0);

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

  // Compte les erreurs récentes non-lues pour le badge cloche (auparavant dans
  // <NotificationBell/> — remonté ici pour intégrer visuellement à la topbar).
  useEffect(() => {
    let cancelled = false;
    const fetchCount = async () => {
      const since = new Date(Date.now() - NOTIF_LOOKBACK_DAYS * 24 * 3600 * 1000).toISOString();
      const { data } = await supabase
        .from("client_activity_log")
        .select("created_at")
        .eq("status", "error")
        .gte("created_at", since)
        .order("created_at", { ascending: false });
      if (cancelled) return;
      const lastSeenRaw = localStorage.getItem(NOTIF_STORAGE_KEY);
      const lastSeen = lastSeenRaw ? new Date(lastSeenRaw).getTime() : 0;
      const count = (data ?? []).filter((r: any) => new Date(r.created_at).getTime() > lastSeen).length;
      setUnreadNotifs(count);
    };
    fetchCount();
    const channel = supabase
      .channel("admin-topbar-notif")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "client_activity_log", filter: "status=eq.error" },
        () => fetchCount(),
      )
      .subscribe();
    const onFocus = () => fetchCount();
    window.addEventListener("focus", onFocus);
    const onStorage = (e: StorageEvent) => { if (e.key === NOTIF_STORAGE_KEY) fetchCount(); };
    window.addEventListener("storage", onStorage);
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

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

  const onSendPulse = async (c: any, type: "onboarding" | "monthly") => {
    if (!c.email && !c.phone) {
      toast.error("Aucun email ni téléphone pour ce client");
      return;
    }
    const label = type === "onboarding" ? "onboarding" : "mensuel";
    const t = toast.loading(`Envoi du pulse ${label}…`);
    const { data, error } = await supabase.functions.invoke("pulse-send", {
      body: { client_code: c.client_code, type, manual: true, created_by: "admin_manual" },
    });
    toast.dismiss(t);
    if (error || (data as any)?.error) {
      toast.error(error?.message || (data as any)?.error || "Échec de l'envoi");
      return;
    }
    const sent = (data as any)?.sent ?? 0;
    if (sent > 0) toast.success(`Pulse ${label} envoyé à ${c.email || c.phone}`);
    else toast.message(`Aucun envoi (vérifie email/téléphone/logs)`);
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
      const fileBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(((reader.result as string) || "").split(",")[1] ?? "");
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
      const isDocx = /\.docx$/i.test(objectPath);
      const contractField = isDocx ? "contract_docx_base64" : "contract_pdf_base64";
      console.log("[send-docusign-contract-email] invoking", {
        objectPath,
        contractField,
        base64_length: fileBase64.length,
        base64_mod4: fileBase64.length % 4,
      });
      const { data, error } = await supabase.functions.invoke("send-docusign-contract-email", {
        body: {
          email: c.email,
          name: signerName,
          client_code: c.client_code,
          [contractField]: fileBase64,
        },
      });
      toast.dismiss(t);
      if (error) {
        const ctx: any = (error as any)?.context;
        let detail = "";
        try {
          if (ctx?.clone && ctx?.text) detail = (await ctx.clone().text())?.slice(0, 400) || "";
        } catch { /* ignore */ }
        console.error("[send-docusign-contract-email] non-2xx", {
          message: (error as any)?.message,
          status: ctx?.status,
          body: detail,
        });
        throw new Error(`[${ctx?.status ?? "??"}] ${detail || (error as any)?.message}`);
      }
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
        channelId: c.slack_channel_id ?? undefined,
      },
    });
    toast.dismiss(t);
    console.log("[setup-slack-onboarding response]", { data, error });
    if (error) {
      toast.error(error.message || "Échec de l'appel");
      return;
    }
    const r = data as { channelId?: string | null; slackUserId?: string | null; inviteUrl?: string | null; errors?: string[] };
    const hasErrors = !!(r.errors && r.errors.length > 0);
    const errorNote = hasErrors ? ` (avertissements: ${r.errors!.join(" | ")})` : "";
    if (r.inviteUrl) {
      toast.success(`Invitation Slack envoyée à ${c.email}${errorNote}`, {
        duration: hasErrors ? 10000 : 4000,
      });
    } else if (r.slackUserId) {
      toast.success(`Client déjà membre du workspace, ajouté au canal${errorNote}`, {
        duration: hasErrors ? 10000 : 4000,
      });
    } else if (hasErrors) {
      toast.error(`Slack errors: ${r.errors!.join(" | ")}`, { duration: 15000 });
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
    <TooltipProvider delayDuration={200}>
      <div className="premium-shell min-h-screen">
        {/* ============ HEADER (2 rangées) ============ */}
        <div className="px-3 sm:px-4 md:px-8 pt-4">
          {/* Rangée 1 — identité + utilitaires */}
          <div className="flex items-center justify-between gap-4 py-3">
            {/* Gauche : logo + titre */}
            <div className="flex items-center gap-4 min-w-0">
              <Link to="/admin" className="flex items-center gap-2.5 shrink-0">
                <span className="h-7 w-7 rounded-[7px] bg-[linear-gradient(135deg,#4d9fff,#2f6bff)] shadow-[0_0_20px_rgba(77,159,255,0.35),inset_0_1px_0_rgba(255,255,255,0.25)]" />
                <span className="font-bold text-[18px] tracking-tight leading-none">TDIA</span>
              </Link>
              <span className="h-6 w-px bg-[rgba(148,170,215,0.15)] shrink-0" />
              <div className="min-w-0">
                <div className="text-[14px] font-semibold leading-tight">Onboarding</div>
                <div className="text-[11px] text-muted-foreground leading-tight">vue centrale équipe interne</div>
              </div>
            </div>

            {/* Droite : utilitaires (34px, hairline) */}
            <div className="flex items-center gap-2 shrink-0">
              <TopSearch value={search} onChange={setSearch} />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    to="/admin/notifications"
                    className="relative h-[34px] w-[34px] rounded-[9px] border border-[rgba(148,170,215,0.18)] bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.04)] flex items-center justify-center transition"
                  >
                    <Bell className="h-4 w-4 text-[#c8d2e4]" />
                    {unreadNotifs > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-[#ff6b6b] text-white font-mono text-[9px] font-medium flex items-center justify-center shadow-[0_0_10px_rgba(255,107,107,0.6)]">
                        {unreadNotifs > 99 ? "99+" : unreadNotifs}
                      </span>
                    )}
                  </Link>
                </TooltipTrigger>
                <TooltipContent>Notifications</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={runChecks}
                    disabled={runningCheck}
                    className="h-[34px] w-[34px] rounded-[9px] border border-[rgba(148,170,215,0.18)] bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.04)] flex items-center justify-center transition disabled:opacity-60"
                  >
                    <RefreshCcw className={`h-4 w-4 text-[#c8d2e4] ${runningCheck ? "animate-spin" : ""}`} />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Lancer les vérifications d'alertes</TooltipContent>
              </Tooltip>
              <AvatarPill onLogout={logout} />
            </div>
          </div>

          {/* Rangée 2 — nav + menu outils, border-bottom hairline */}
          <div className="flex items-center justify-between gap-4 border-b border-[rgba(148,170,215,0.12)]">
            <nav className="flex items-center gap-6 -mb-px">
              <NavTab to="/admin" label="Suivi clients" active count={counts.total} />
              <NavTab to="/admin/sales" label="Sales pipeline" />
              <NavTab to="/admin/deals" label="Deals closés" />
              <NavTab to="/admin/meta-ads" label="Performances" />
              <NavTab to="/admin/pulse" label="Pulse" />
            </nav>
            <div className="pb-2">
              <ToolsMenu onLogout={logout} />
            </div>
          </div>
        </div>

        {/* ============ CORPS ============ */}
        <div className="px-3 sm:px-4 md:px-8 py-6 space-y-5">
          {/* KPI hairline row */}
          <div className="grid grid-cols-2 md:grid-cols-5 border-t border-b border-[rgba(148,170,215,0.12)]">
            <KpiCell label="TOTAL CLIENTS" value={counts.total} />
            <KpiCell label="BLOQUÉS" value={counts.blocked} tone={counts.blocked > 0 ? "bad" : undefined} />
            <KpiCell
              label="À RAPPELER"
              value={counts.callbackDue}
              tone="watch"
              showDot={counts.callbackDue > 0}
              onClick={() => setFilter("callback_due")}
            />
            <KpiCell label="COMPLÉTÉS" value={counts.completed} tone={counts.completed > 0 ? "good" : undefined} />
            <KpiCell
              label="HAUT RISQUE"
              value={counts.highRisk}
              tone="bad"
              showDot={counts.highRisk > 0}
              onClick={() => setFilter("high_risk")}
            />
          </div>

          {/* Recherche + filtre + compteur */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher (code, nom, entreprise, email, tel)…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-10 bg-[rgba(255,255,255,0.02)] border-[rgba(148,170,215,0.18)]"
              />
            </div>
            <Select value={filter} onValueChange={(v) => setFilter(v as FilterKey)}>
              <SelectTrigger className="w-full sm:w-[220px] h-10 bg-[rgba(255,255,255,0.02)] border-[rgba(148,170,215,0.18)]">
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

          {/* Table clients (colonnes consolidées) */}
          <div className="card-premium overflow-hidden">
            <div className="admin-clients-scroll">
              <Table className="min-w-[1200px]">
                <TableHeader>
                  <TableRow className="border-b border-[rgba(148,170,215,0.12)] hover:bg-transparent">
                    <ColHead className="sticky left-0 z-30 bg-background w-[240px] shadow-[8px_0_16px_-8px_rgba(0,0,0,0.4)]">Client</ColHead>
                    <ColHead>Contact</ColHead>
                    <ColHead>Closer · Deal</ColHead>
                    <ColHead>Étape</ColHead>
                    <ColHead className="w-[180px]">Progression</ColHead>
                    <ColHead className="w-[80px] text-center">Jalons</ColHead>
                    <ColHead>Suivi</ColHead>
                    <ColHead className="w-[100px]">Risque</ColHead>
                    <ColHead className="sticky right-0 z-30 bg-background w-[130px] text-right shadow-[-8px_0_16px_-8px_rgba(0,0,0,0.4)]">Actions</ColHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Chargement…</TableCell></TableRow>
                  ) : visible.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Aucun client</TableCell></TableRow>
                  ) : visible.map((c) => {
                    const risk = riskLevel(c);
                    const stepIdx = currentStepIndex(c);
                    const stepLabel = ONBOARDING_STEPS[stepIdx]?.label ?? "—";
                    const pct = progressPercent(c);
                    const done = completedStepsCount(c);
                    const detailRef = c.client_id || c.client_code;
                    const archived = Boolean(c.archived_at);
                    const highRisk = risk === "High";
                    const rowClass = [
                      "border-b border-[rgba(148,170,215,0.06)] hover:bg-[rgba(255,255,255,0.015)] transition",
                      archived ? "opacity-60" : "",
                      highRisk ? "bg-[linear-gradient(90deg,rgba(255,107,107,0.04),transparent_60%)]" : "",
                    ].join(" ").trim();
                    // Les cellules sticky doivent avoir un fond pour masquer le
                    // contenu qui défile derrière — sur les lignes haut risque,
                    // on rejoue le gradient rouge dessus (le fond du row ne
                    // transparaît pas à travers les sticky).
                    const stickyBg = highRisk
                      ? "bg-[linear-gradient(90deg,rgba(255,107,107,0.04),hsl(var(--background))_60%)]"
                      : "bg-background";
                    return (
                      <TableRow key={detailRef} className={rowClass}>
                        <TableCell className={`sticky left-0 z-20 w-[240px] shadow-[8px_0_16px_-8px_rgba(0,0,0,0.4)] ${stickyBg}`}>
                          <div className="font-medium text-[13.5px] flex items-center gap-2">
                            {c.client_name || "—"}
                            {archived && (
                              <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                archivé
                              </span>
                            )}
                          </div>
                          <div className="text-xs font-mono text-muted-foreground mt-0.5">
                            {c.client_code}
                            {(c.company_name || c.brand_name) && (
                              <> · <span className="opacity-90 font-sans">{c.company_name || c.brand_name}</span></>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{c.email || "—"}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">{c.phone || ""}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{c.closer_name || "—"}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {c.deal_value ? `${c.deal_value} $` : "—"}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{stepLabel}</TableCell>
                        <TableCell className="w-[180px]">
                          <ProgressCell pct={pct} done={done} />
                        </TableCell>
                        <TableCell className="w-[80px]">
                          <MilestoneDots c={c} />
                        </TableCell>
                        <TableCell><FollowupCell client={c} /></TableCell>
                        <TableCell className="w-[100px]">
                          <RiskChip risk={risk} />
                        </TableCell>
                        <TableCell className={`sticky right-0 z-20 w-[130px] shadow-[-8px_0_16px_-8px_rgba(0,0,0,0.4)] ${stickyBg}`}>
                          <div className="flex items-center gap-1 justify-end">
                            <Button asChild size="sm" variant="ghost" className="h-8 text-[#9ec8ff] hover:text-[#9ec8ff] hover:bg-[rgba(77,159,255,0.08)]">
                              <Link to={`/admin/clients/${encodeURIComponent(detailRef)}`}>
                                Ouvrir
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
                                <DropdownMenuItem
                                  onClick={() => onSendPulse(c, "onboarding")}
                                  disabled={!c.email && !c.phone}
                                >
                                  <Zap className="h-4 w-4 mr-2" />
                                  Envoyer pulse onboarding
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => onSendPulse(c, "monthly")}
                                  disabled={!c.email && !c.phone}
                                >
                                  <Zap className="h-4 w-4 mr-2" />
                                  Envoyer pulse mensuel
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => setNpsDialogClient({
                                    client_code: c.client_code,
                                    client_name: c.client_name,
                                    company_name: c.company_name || c.brand_name,
                                  })}
                                >
                                  <Heart className="h-4 w-4 mr-2" />
                                  Logger NPS relationnel
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
              <div className="flex justify-center py-3 border-t border-[rgba(148,170,215,0.12)]">
                <Button variant="ghost" size="sm" onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}>
                  Voir plus ({filtered.length - visibleCount} restants)
                </Button>
              </div>
            )}
          </div>
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

        <LogNpsDialog
          open={!!npsDialogClient}
          onOpenChange={(o) => !o && setNpsDialogClient(null)}
          client={npsDialogClient}
        />
      </div>
    </TooltipProvider>
  );
};

// ============ Sub-components ============

const TopSearch = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
  <div className="relative hidden md:block">
    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
    <Input
      placeholder="Rechercher…"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-[34px] w-[240px] pl-8 pr-14 text-[12.5px] bg-[rgba(255,255,255,0.02)] border-[rgba(148,170,215,0.18)] rounded-[9px]"
    />
    <span className="absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[10px] px-1.5 py-0.5 rounded border border-[rgba(148,170,215,0.2)] text-muted-foreground pointer-events-none">
      ⌘K
    </span>
  </div>
);

const AvatarPill = ({ onLogout }: { onLogout: () => void }) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <button className="h-[34px] flex items-center gap-2 pl-2 pr-1 rounded-[9px] border border-[rgba(148,170,215,0.18)] bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.04)] transition">
        <span className="text-xs text-[#c8d2e4]">Isaac</span>
        <span className="h-[26px] w-[26px] rounded-[6px] bg-[linear-gradient(135deg,rgba(77,159,255,0.4),rgba(47,107,255,0.15))] border border-[rgba(77,159,255,0.25)] flex items-center justify-center font-mono text-[11px] text-[#9ec8ff] font-medium">
          IM
        </span>
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-[180px]">
      <DropdownMenuItem disabled className="opacity-60">Profil</DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={onLogout}>
        <LogOut className="h-4 w-4 mr-2" />
        Se déconnecter
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);

const NavTab = ({ to, label, active, count, hasAlert }: { to: string; label: string; active?: boolean; count?: number; hasAlert?: boolean }) => (
  <Link
    to={to}
    className={`relative flex items-center gap-1.5 py-3 text-sm transition ${
      active
        ? "text-[#9ec8ff] border-b-2 border-[#4d9fff]"
        : "text-[#8b97ad] border-b-2 border-transparent hover:text-[#c8d2e4]"
    }`}
  >
    <span>{label}</span>
    {typeof count === "number" && (
      <span className="text-xs font-mono opacity-70">{count}</span>
    )}
    {hasAlert && <span className="status-dot watch" />}
  </Link>
);

const ToolsMenu = ({ onLogout }: { onLogout: () => void }) => {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="h-8 flex items-center gap-1.5 px-3 rounded-[8px] active-blue text-xs hover:brightness-110 transition">
          Outils &amp; liens
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-[280px] p-0 border-0 bg-transparent shadow-none">
        <div className="card-highlight">
          <div className="p-3 space-y-3">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-1">Pages publiques</div>
              <ToolLink to="/pulse" label="Page /pulse" external onClick={() => setOpen(false)} />
              <ToolLink to="/admin/contract-creator" label="Générateur de contrats" external onClick={() => setOpen(false)} />
            </div>
            <div className="hairline-gradient" />
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-1">Autres systèmes</div>
              <ToolLink to="/admin/ops" label="Agent Ops Dashboard" liveBadge onClick={() => setOpen(false)} />
              <ToolLink to="/admin/gos" label="Profit First Media Buying" external onClick={() => setOpen(false)} />
            </div>
            <div className="hairline-gradient" />
            <button
              onClick={() => { setOpen(false); onLogout(); }}
              className="w-full text-left px-2 py-2 rounded-[7px] text-xs text-muted-foreground hover:bg-[rgba(77,159,255,0.08)] transition flex items-center gap-2"
            >
              <LogOut className="h-3.5 w-3.5" />
              Se déconnecter
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

const ToolLink = ({ to, label, external, liveBadge, onClick }: { to: string; label: string; external?: boolean; liveBadge?: boolean; onClick?: () => void }) => (
  <Link
    to={to}
    target={external ? "_blank" : undefined}
    onClick={onClick}
    className="flex items-center justify-between px-2 py-2 rounded-[7px] text-sm text-[#c8d2e4] hover:bg-[rgba(77,159,255,0.08)] transition"
  >
    <span>{label}</span>
    {liveBadge ? (
      <span className="flex items-center gap-1.5">
        <span className="status-dot info" />
        <span className="text-[10px] font-mono uppercase tracking-wider text-[#9ec8ff]">1 RUN</span>
      </span>
    ) : external ? (
      <ExternalLink className="h-3.5 w-3.5 opacity-60" />
    ) : null}
  </Link>
);

const KpiCell = ({ label, value, tone, showDot, onClick }: {
  label: string;
  value: number;
  tone?: "good" | "watch" | "bad";
  showDot?: boolean;
  onClick?: () => void;
}) => {
  const toneClass = tone === "bad"
    ? "text-[#ff6b6b]"
    : tone === "watch"
      ? "text-[#f5b74e]"
      : tone === "good"
        ? "text-[#3ddc97]"
        : "text-foreground";
  return (
    <div
      className={`px-5 py-4 border-l border-[rgba(148,170,215,0.12)] first:border-l-0 ${onClick ? "cursor-pointer hover:bg-[rgba(255,255,255,0.02)] transition" : ""}`}
      onClick={onClick}
    >
      <div className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
        {showDot && <span className={`status-dot ${tone === "bad" ? "bad" : tone === "watch" ? "watch" : "info"}`} />}
        {label}
      </div>
      <div className={`text-2xl font-mono font-medium mt-1 ${toneClass}`}>{value}</div>
    </div>
  );
};

const ColHead = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <TableHead className={`whitespace-nowrap ${className}`}>{children}</TableHead>
);

const ProgressCell = ({ pct, done }: { pct: number; done: number }) => (
  <div className="space-y-1.5">
    <div className="flex items-baseline gap-2">
      <span className="text-xs font-mono">{done}/8</span>
      <span className="text-xs font-mono text-muted-foreground">{pct}%</span>
    </div>
    <div className="h-[3px] rounded-full bg-[rgba(148,170,215,0.1)] overflow-hidden">
      <div
        className="h-full rounded-full bg-[linear-gradient(90deg,#4d9fff,#3ddc97)] shadow-[0_0_8px_rgba(77,159,255,0.4)]"
        style={{ width: `${pct}%` }}
      />
    </div>
  </div>
);

const MilestoneDots = ({ c }: { c: any }) => {
  const items = [
    { done: isStepDone(c, 4), label: "Paiement" },
    { done: isStepDone(c, 5), label: "Contrat" },
    { done: isStepDone(c, 6), label: "Kick-off" },
  ];
  return (
    <div className="flex items-center gap-2 justify-center">
      {items.map((it, i) => (
        <Tooltip key={i}>
          <TooltipTrigger asChild>
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${
                it.done
                  ? "bg-[#3ddc97] shadow-[0_0_6px_rgba(61,220,151,0.7)]"
                  : "bg-[rgba(148,170,215,0.18)]"
              }`}
            />
          </TooltipTrigger>
          <TooltipContent>{it.label} {it.done ? "✓" : "—"}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
};

const RiskChip = ({ risk }: { risk: "Low" | "Medium" | "High" }) => {
  const dot = risk === "High" ? "bad" : risk === "Medium" ? "watch" : "good";
  const color = risk === "High" ? "text-[#ff6b6b]" : risk === "Medium" ? "text-[#f5b74e]" : "text-[#3ddc97]";
  const label = risk === "High" ? "HIGH" : risk === "Medium" ? "MED" : "LOW";
  return (
    <span className="flex items-center gap-1.5">
      <span className={`status-dot ${dot}`} />
      <span className={`text-[11px] font-mono ${color}`}>{label}</span>
    </span>
  );
};

const FollowupCell = ({ client }: { client: any }) => {
  if (client.callback_due_at) {
    return (
      <div className="text-[11px] font-mono text-[#f5b74e]">
        À rappeler · {timeAgo(client.callback_due_at)}
      </div>
    );
  }
  if (client.followup_sent_at) {
    const suffix = client.followup_count > 1 ? ` · ${client.followup_count}×` : "";
    return (
      <div className="text-[11px] font-mono text-[#9ec8ff]">
        Suivi envoyé{suffix}
      </div>
    );
  }
  return <span className="text-xs text-muted-foreground">—</span>;
};

export default AdminDashboard;
