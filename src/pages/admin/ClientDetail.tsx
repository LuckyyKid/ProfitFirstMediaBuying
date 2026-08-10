import { useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import {
  useActivityLog,
  useClientDetail,
  useFormAnswers,
  usePlatformAccess,
} from "@/hooks/useAdminClients";
import {
  ONBOARDING_STEPS,
  completedStepsCount,
  globalStatus,
  isStepDone,
  progressPercent,
  riskBadgeClass,
  riskLevel,
  statusBadgeClass,
  timeAgo,
} from "@/lib/onboardingHelpers";
import {
  ArrowLeft, Check, Copy, Download, ExternalLink, FileText, RefreshCw, Sparkles, X, CheckCircle2, RotateCcw, Mail, Pencil,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import * as XLSX from "xlsx";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PLATFORMS = [
  "meta_ads", "fb_bm", "fb_page", "instagram", "tiktok_ads",
  "google_ads", "ga4", "gtm", "shopify", "drive",
];
const PLATFORM_LABEL: Record<string, string> = {
  meta_ads: "Meta Ads", fb_bm: "FB Business Manager", fb_page: "Page Facebook",
  instagram: "Instagram", tiktok_ads: "TikTok Ads", google_ads: "Google Ads",
  ga4: "GA4", gtm: "Google Tag Manager", shopify: "Shopify / Site web", drive: "Google Drive assets",
};
const PLATFORM_STATUSES = ["not_requested","requested","received","incomplete","blocked","not_applicable"];

const ClientDetail = () => {
  const { clientCode } = useParams<{ clientCode: string }>();
  const { isAuthed } = useAdminAuth();
  const { client, loading, syncing, refetch } = useClientDetail(clientCode);
  const activityClientCode = client?.client_code ?? (clientCode && !UUID_RE.test(clientCode) ? clientCode : undefined);
  const { welcome, founder } = useFormAnswers(activityClientCode);
  const logs = useActivityLog(activityClientCode);
  const platforms = usePlatformAccess(activityClientCode);
  const [genSummary, setGenSummary] = useState(false);
  const [notes, setNotes] = useState("");
  const [editingEmail, setEditingEmail] = useState(false);
  const [emailDraft, setEmailDraft] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);
  const [togglingComplete, setTogglingComplete] = useState(false);
  const [savingLanguage, setSavingLanguage] = useState(false);
  const [editingInfo, setEditingInfo] = useState(false);
  const [infoDraft, setInfoDraft] = useState<Record<string, any>>({});
  const [savingInfo, setSavingInfo] = useState(false);
  const [regeneratingStripe, setRegeneratingStripe] = useState(false);
  const [exportingXlsx, setExportingXlsx] = useState(false);

  const exportAnswers = async () => {
    const code = client?.client_code;
    if (!code) { toast.error("Client sans client_code — export impossible"); return; }
    setExportingXlsx(true);
    try {
      const { data: voice, error: voiceErr } = await supabase
        .from("voice_answers")
        .select("form_key, question_id, transcript, written_fallback, duration_ms, status, ambient_noise_warning, created_at")
        .eq("client_code", code)
        .order("form_key", { ascending: true })
        .order("created_at", { ascending: true });
      if (voiceErr) throw voiceErr;

      const mapForm = (rows: any[]) => rows.map((r) => ({
        Section: r.section ?? "",
        "Clé question": r.question_key,
        Question: r.question_label ?? "",
        Réponse: r.answer ?? "",
        Date: r.created_at ? new Date(r.created_at).toISOString().slice(0, 19).replace("T", " ") : "",
      }));

      const voiceRows = (voice ?? []).map((r: any) => ({
        Formulaire: r.form_key,
        "ID question": r.question_id,
        Transcription: r.transcript ?? "",
        "Texte écrit (fallback)": r.written_fallback ?? "",
        "Durée (s)": r.duration_ms ? Math.round(r.duration_ms / 1000) : 0,
        Statut: r.status,
        "Bruit ambiant": r.ambient_noise_warning ? "oui" : "non",
        Date: r.created_at ? new Date(r.created_at).toISOString().slice(0, 19).replace("T", " ") : "",
      }));

      if (welcome.length === 0 && founder.length === 0 && voiceRows.length === 0) {
        toast.info("Aucune réponse à exporter pour ce client");
        return;
      }

      const wb = XLSX.utils.book_new();
      const addSheet = (name: string, rows: any[], cols: any[]) => {
        const ws = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ Info: "Aucune réponse" }]);
        ws["!cols"] = cols;
        XLSX.utils.book_append_sheet(wb, ws, name);
      };
      const formCols = [{ wch: 20 }, { wch: 24 }, { wch: 40 }, { wch: 60 }, { wch: 20 }];
      addSheet("Quiz intégration", mapForm(welcome), formCols);
      addSheet("Founder Scan", mapForm(founder), formCols);
      addSheet("Voix", voiceRows, [{ wch: 22 }, { wch: 28 }, { wch: 80 }, { wch: 60 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 20 }]);

      const date = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `reponses_${code}_${date}.xlsx`);
      toast.success(`Export généré (${welcome.length} quiz · ${founder.length} founder · ${voiceRows.length} voix)`);
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur lors de l'export");
    } finally {
      setExportingXlsx(false);
    }
  };

  const saveLanguage = async (next: "fr" | "en") => {
    if (!client?.client_code) return;
    setSavingLanguage(true);
    try {
      const { error } = await (supabase as any)
        .from("client_progress")
        .update({ client_language: next })
        .eq("client_code", client.client_code);
      if (error) throw error;
      toast.success(next === "en" ? "Langue mise à jour : Anglais" : "Langue mise à jour : Français");
      refetch?.();
    } catch (err: any) {
      toast.error(err?.message || "Échec de la mise à jour");
    } finally {
      setSavingLanguage(false);
    }
  };

  const toggleOnboardingComplete = async () => {
    if (!client?.client_code) return;
    const isComplete = Boolean(client.completed_at);
    const confirmMsg = isComplete
      ? "Rouvrir l'onboarding ? Les suivis automatiques pourront reprendre."
      : "Marquer l'onboarding comme complété ? Ceci arrête l'envoi des relances automatiques.";
    if (!window.confirm(confirmMsg)) return;
    setTogglingComplete(true);
    try {
      const now = new Date().toISOString();
      const updates: Record<string, any> = isComplete
        ? { completed_at: null, last_activity_at: now, updated_at: now }
        : {
            completed_at: now,
            last_activity_at: now,
            updated_at: now,
            followup_sent_at: null,
            followup_step: null,
            callback_due_at: null,
            callback_notified_at: null,
            stuck_alert_at: null,
          };
      const { error } = await (supabase as any)
        .from("client_progress")
        .update(updates)
        .eq("client_code", client.client_code);
      if (error) throw error;
      await supabase.from("client_activity_log").insert({
        client_code: client.client_code,
        event_type: isComplete ? "onboarding_reopened" : "onboarding_marked_complete",
        status: "ok",
        details: { source: "admin_manual" },
      });
      toast.success(isComplete ? "Onboarding rouvert — suivis réactivés" : "Onboarding complété — suivis arrêtés");
      refetch?.();
    } catch (err: any) {
      toast.error(err?.message || "Échec");
    } finally {
      setTogglingComplete(false);
    }
  };

  const saveEmail = async () => {
    const next = emailDraft.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next)) {
      toast.error("Adresse email invalide");
      return;
    }
    if (!client?.client_code) return;
    setSavingEmail(true);
    try {
      const { error: e1 } = await (supabase as any)
        .from("client_progress")
        .update({ email: next })
        .eq("client_code", client.client_code);
      if (e1) throw e1;
      await (supabase as any)
        .from("closed_deals")
        .update({ owner_email: next })
        .eq("client_code", client.client_code);
      toast.success("Email mis à jour");
      setEditingEmail(false);
      refetch?.();
    } catch (err: any) {
      toast.error(err?.message || "Échec de la mise à jour");
    } finally {
      setSavingEmail(false);
    }
  };

  const INFO_FIELDS: Array<{
    key: string;
    label: string;
    type?: "text" | "number" | "date" | "textarea" | "select";
    options?: Array<{ value: string; label: string }>;
  }> = [
    { key: "client_name", label: "Nom du contact" },
    { key: "company_name", label: "Entreprise" },
    { key: "brand_name", label: "Marque / brand" },
    { key: "phone", label: "Téléphone" },
    {
      key: "client_language",
      label: "Langue (emails + Slack + onboarding)",
      type: "select",
      options: [{ value: "fr", label: "Français" }, { value: "en", label: "English" }],
    },
    {
      key: "business_type",
      label: "Type de business",
      type: "select",
      options: [
        { value: "ecommerce", label: "E-commerce" },
        { value: "local_service", label: "Local Service" },
        { value: "saas", label: "SaaS" },
      ],
    },
    { key: "lead_source", label: "Source du lead" },
    { key: "closer_name", label: "Closer" },
    { key: "sales_supervisor", label: "Superviseur sales" },
    { key: "deal_value", label: "Deal value", type: "number" },
    { key: "ad_budget", label: "Budget publicitaire mensuel", type: "number" },
    { key: "closing_date", label: "Closing date", type: "date" },
    {
      key: "already_runs_ads",
      label: "Fait déjà des ads ?",
      type: "select",
      options: [{ value: "true", label: "Oui" }, { value: "false", label: "Non" }, { value: "", label: "Inconnu" }],
    },
    { key: "contract_start_date", label: "Contrat — début", type: "date" },
    { key: "contract_end_date", label: "Contrat — fin", type: "date" },
    { key: "churned_at", label: "Churné le", type: "date" },
    { key: "churn_reason", label: "Raison churn", type: "textarea" },
    { key: "owner_pain_point", label: "Pain point", type: "textarea" },
  ];

  const startInfoEdit = () => {
    const draft: Record<string, any> = {};
    for (const f of INFO_FIELDS) {
      const raw = client?.[f.key];
      if (f.type === "date" && raw) {
        draft[f.key] = String(raw).slice(0, 10);
      } else if (f.key === "already_runs_ads") {
        draft[f.key] = raw === true ? "true" : raw === false ? "false" : "";
      } else {
        draft[f.key] = raw ?? "";
      }
    }
    setInfoDraft(draft);
    setEditingInfo(true);
  };

  const cancelInfoEdit = () => {
    setEditingInfo(false);
    setInfoDraft({});
  };

  const saveInfoDraft = async () => {
    if (!client?.client_code) return;
    setSavingInfo(true);
    try {
      const patch: Record<string, any> = {};
      for (const f of INFO_FIELDS) {
        let v = infoDraft[f.key];
        if (f.type === "number") v = v === "" || v == null ? null : Number(v);
        else if (f.key === "already_runs_ads") v = v === "true" ? true : v === "false" ? false : null;
        else if (v === "") v = null;
        patch[f.key] = v;
      }

      const previousDealValue = Number(client.deal_value ?? 0);
      const nextDealValue = Number(patch.deal_value ?? previousDealValue);
      const dealValueChanged =
        Number.isFinite(nextDealValue) &&
        nextDealValue > 0 &&
        nextDealValue !== previousDealValue;

      // If the deal amount changes and we already handed the client a Stripe
      // link, that link is now stale and locked on the old amount. Clear it
      // in the same patch so the client can never see or reuse it.
      const shouldRegenerateStripe =
        dealValueChanged && !client.paid && Boolean(client.stripe_link);
      if (shouldRegenerateStripe) {
        patch.stripe_link = null;
        patch.stripe_amount_expected = nextDealValue;
      }

      const { error } = await (supabase as any)
        .from("client_progress")
        .update(patch)
        .eq("client_code", client.client_code);
      if (error) throw error;

      if (shouldRegenerateStripe) {
        try {
          const { data: linkData, error: linkErr } = await supabase.functions.invoke(
            "create-stripe-payment-link",
            {
              body: {
                deal_value: nextDealValue,
                client_name: client.client_name || client.company_name || client.name,
                client_code: client.client_code,
                client_id: client.client_id ?? undefined,
                currency: "cad",
              },
            }
          );
          if (linkErr) throw linkErr;
          if (!linkData?.url) throw new Error("stripe_link_regeneration_no_url");
          toast.success("Nouveau lien Stripe généré (l'ancien est désactivé).");
        } catch (regenErr: any) {
          console.error("Stripe link regeneration failed:", regenErr);
          toast.error(
            "Infos enregistrées, mais impossible de régénérer le lien Stripe. Réessayez depuis l'onglet Paiement ou contactez le support."
          );
        }
      } else {
        toast.success("Infos client mises à jour");
      }

      setEditingInfo(false);
      refetch?.();
    } catch (err: any) {
      console.error("saveInfoDraft error:", err);
      toast.error("Impossible d'enregistrer les modifications. Réessayez dans un instant.");
    } finally {
      setSavingInfo(false);
    }
  };

  const regenerateStripeLink = async () => {
    if (!client?.client_code) return;
    if (client.paid) {
      toast.info("Le client a déjà payé — aucun nouveau lien n'est nécessaire.");
      return;
    }
    const amount = Number(client.deal_value ?? 0);
    if (!amount || amount <= 0) {
      toast.error("Renseignez d'abord un deal_value valide avant de générer un lien Stripe.");
      return;
    }
    setRegeneratingStripe(true);
    try {
      await (supabase as any)
        .from("client_progress")
        .update({ stripe_link: null, stripe_amount_expected: amount })
        .eq("client_code", client.client_code);

      const { data: linkData, error: linkErr } = await supabase.functions.invoke(
        "create-stripe-payment-link",
        {
          body: {
            deal_value: amount,
            client_name: client.client_name || client.company_name || client.name,
            client_code: client.client_code,
            client_id: client.client_id ?? undefined,
            currency: "cad",
          },
        }
      );
      if (linkErr) throw linkErr;
      if (!linkData?.url) throw new Error("stripe_link_regeneration_no_url");
      toast.success("Nouveau lien Stripe généré (l'ancien est désactivé).");
      refetch?.();
    } catch (err: any) {
      console.error("Manual Stripe regen failed:", err);
      toast.error(
        "Impossible de régénérer le lien Stripe. Réessayez dans un instant."
      );
    } finally {
      setRegeneratingStripe(false);
    }
  };

  if (!isAuthed) return <Navigate to="/admin/login" replace />;
  if (loading) return <div className="p-8 text-center text-muted-foreground">Chargement…</div>;
  if (!client) return <div className="p-8 text-center text-muted-foreground">Client introuvable</div>;

  const status = globalStatus(client);
  const risk = riskLevel(client);
  const pct = progressPercent(client);
  const done = completedStepsCount(client);
  const externalClient = client.external_snapshot?.client ?? null;
  const crmEmail = externalClient?.contact_email ?? externalClient?.email ?? null;
  const crmPhone = externalClient?.contact_phone ?? externalClient?.phone ?? null;
  const crmHasRunAds = typeof externalClient?.has_run_ads === "boolean"
    ? externalClient.has_run_ads
    : typeof externalClient?.already_runs_ads === "boolean"
      ? externalClient.already_runs_ads
      : null;
  const emailBlockedByConflict = Boolean(crmEmail && !client.email);
  const stepVisibility = {
    welcome: Boolean(client.welcome_completed_at),
    platforms: Boolean(client.platforms_completed_at || client.video_watched),
    form: Boolean(client.form_completed_at || client.welcome_form_submitted),
    founder: Boolean(client.founder_scan_completed_at || client.founder_scan_submitted),
    payment: Boolean(client.payment_completed_at || client.paid),
    contract: Boolean(client.contract_completed_at || client.contract_signed),
    kickoff: Boolean(client.kickoff_completed_at || client.kickoff_scheduled || client.kickoff_scheduled_at),
  };

  const copyId = () => {
    navigator.clipboard.writeText(client.client_id || client.client_code);
    toast.success(client.client_id ? "Client ID copié" : "Client code copié");
  };

  const markStep = async (flag: string) => {
    const now = new Date().toISOString();
    const stepIndex = ONBOARDING_STEPS.findIndex((step) => step.flag === flag);
    const updates: Record<string, any> = {
      [flag]: now,
      last_activity_at: now,
      updated_at: now,
    };
    if (stepIndex >= 0) {
      updates.current_step = Math.min(stepIndex + 2, ONBOARDING_STEPS.length);
      if (flag === "kickoff_completed_at") {
        updates.kickoff_scheduled = true;
        updates.kickoff_scheduled_at = client.kickoff_scheduled_at ?? now;
      }
      if (flag === "platforms_completed_at") {
        updates.video_watched = true;
      }
    }

    const { error } = await supabase
      .from("client_progress")
      .update(updates)
      .eq("client_code", client.client_code);
    if (error) toast.error("Erreur"); else toast.success("Étape marquée");
    await supabase.from("client_activity_log").insert({
      client_code: client.client_code,
      event_type: "manual_step_completion",
      status: "ok",
      details: { flag },
    });
  };

  const saveNotes = async () => {
    const { error } = await supabase
      .from("client_progress")
      .update({ internal_notes: notes || client.internal_notes })
      .eq("client_code", client.client_code);
    if (error) toast.error("Erreur"); else toast.success("Note enregistrée");
  };

  const updatePlatform = async (platform: string, newStatus: string) => {
    const { error } = await supabase
      .from("client_platform_access")
      .upsert({ client_code: client.client_code, platform, status: newStatus, updated_at: new Date().toISOString() }, { onConflict: "client_code,platform" });
    if (error) toast.error("Erreur"); else toast.success("Accès mis à jour");
  };

  const generateSummary = async () => {
    setGenSummary(true);
    const { data, error } = await supabase.functions.invoke("generate-founder-summary", {
      body: { client_code: client.client_code },
    });
    setGenSummary(false);
    if (error || !data?.success) toast.error("Erreur génération résumé");
    else toast.success("Résumé généré");
  };

  return (
    <div className="premium-shell min-h-screen px-4 md:px-8 py-8">
      <div className="max-w-[1400px] mx-auto space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link to="/admin"><ArrowLeft className="h-4 w-4 mr-1" /> Retour</Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{client.client_name || client.company_name || client.client_code}</h1>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="font-mono">{client.client_id || client.client_code}</span>
                <button onClick={copyId} className="hover:text-primary"><Copy className="h-3 w-3" /></button>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={refetch}
              disabled={syncing}
              title={client.external_synced_at ? `Dernière synchro : ${timeAgo(client.external_synced_at)}` : "Jamais synchronisé"}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Synchro…" : "Resynchroniser"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportAnswers}
              disabled={exportingXlsx}
              title="Télécharger un XLSX avec les réponses du Quiz d'intégration, du Founder Scan et de l'onboarding vocal"
            >
              <Download className="h-4 w-4 mr-1" />
              {exportingXlsx ? "Export…" : "Télécharger XLSX"}
            </Button>
            <Button
              variant={client.completed_at ? "outline" : "default"}
              size="sm"
              onClick={toggleOnboardingComplete}
              disabled={togglingComplete}
              title={client.completed_at ? "Rouvrir l'onboarding et réactiver les relances" : "Marquer comme complété et arrêter les relances"}
            >
              {client.completed_at ? (
                <><RotateCcw className="h-4 w-4 mr-1" /> Rouvrir l'onboarding</>
              ) : (
                <><CheckCircle2 className="h-4 w-4 mr-1" /> Marquer complété (stop relances)</>
              )}
            </Button>
            <span className={`px-2 py-1 rounded-md text-xs border ${statusBadgeClass[status]}`}>{status}</span>
            <span className={`px-2 py-1 rounded-md text-xs border ${riskBadgeClass[risk]}`}>Risque {risk}</span>
          </div>
        </header>

        <Card className="p-4 glass-card">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex justify-between text-sm mb-1">
                <span>Progression onboarding</span>
                <span className="text-muted-foreground">{done}/8 — {pct}%</span>
              </div>
              <Progress value={pct} />
            </div>
            <div className="text-xs text-muted-foreground">Dernière activité : {timeAgo(client.last_activity_at)}</div>
          </div>
        </Card>

        <Card className="p-4 glass-card">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary shrink-0">
              <Mail className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                Email de contact — utilisé pour tous les envois (emails, Slack invite)
              </div>
              {editingEmail ? (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="email"
                    value={emailDraft}
                    onChange={(e) => setEmailDraft(e.target.value)}
                    className="flex-1 min-w-[240px] rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                    autoFocus
                  />
                  <Button size="sm" onClick={saveEmail} disabled={savingEmail}>Enregistrer</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingEmail(false)} disabled={savingEmail}>Annuler</Button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-base font-medium break-all">
                    {emailBlockedByConflict ? `${crmEmail} (bloqué par doublon local)` : (client.email || "—")}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => { setEmailDraft(client.email || ""); setEditingEmail(true); }}
                  >
                    <Pencil className="h-3.5 w-3.5 mr-1" />
                    Modifier
                  </Button>
                </div>
              )}
              <div className="text-xs text-muted-foreground mt-1.5">
                Modifier ici met à jour <code className="font-mono">client_progress.email</code> + <code className="font-mono">closed_deals.owner_email</code>. Les prochains emails (bienvenue, relance) partiront à cette adresse.
              </div>
            </div>
          </div>
        </Card>

        <Tabs defaultValue="info" className="space-y-4">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="info" className="text-xs sm:text-sm">Infos</TabsTrigger>
            <TabsTrigger value="progress" className="text-xs sm:text-sm">Progression</TabsTrigger>
            <TabsTrigger value="platforms" className="text-xs sm:text-sm">Plateformes</TabsTrigger>
            <TabsTrigger value="quiz" className="text-xs sm:text-sm">Quiz intégration</TabsTrigger>
            <TabsTrigger value="founder" className="text-xs sm:text-sm">Founder Scan</TabsTrigger>
            <TabsTrigger value="payment" className="text-xs sm:text-sm">Paiement</TabsTrigger>
            <TabsTrigger value="contract" className="text-xs sm:text-sm">Contrat</TabsTrigger>
            <TabsTrigger value="kickoff" className="text-xs sm:text-sm">Kick-off</TabsTrigger>
            <TabsTrigger value="logs" className="text-xs sm:text-sm">Logs</TabsTrigger>
          </TabsList>

          <TabsContent value="info">
            <Card className="p-6 glass-card space-y-6 text-sm">
              <section className="space-y-3">
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Diagnostic synchro CRM</div>
                  <div className="text-sm text-muted-foreground">On sépare ici la donnée brute du CRM de la donnée réellement enregistrée localement.</div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Dernière synchro CRM" value={client.external_synced_at} />
                  <Field label="Dernière mise à jour côté CRM" value={externalClient?.updated_at} />
                  <Field label="Email CRM brut" value={crmEmail} />
                  <Field
                    label="Email enregistré localement"
                    value={emailBlockedByConflict ? `${crmEmail} (bloqué par doublon local)` : (client.email || "—")}
                  />
                  <Field label="Téléphone CRM brut" value={crmPhone} />
                  <Field label="Téléphone enregistré localement" value={client.phone} />
                  <Field
                    label="Ads dans le CRM"
                    value={crmHasRunAds === null ? "Inconnu — le CRM renvoie vide" : crmHasRunAds ? "Oui" : "Non"}
                  />
                  <Field
                    label="Ads enregistrées localement"
                    value={client.already_runs_ads === null ? "Inconnu" : client.already_runs_ads ? "Oui" : "Non"}
                  />
                  <Field label="Bienvenue enregistrée" value={stepVisibility.welcome ? "Oui" : "Non"} />
                  <Field label="Accès plateformes enregistrés" value={stepVisibility.platforms ? "Oui" : "Non"} />
                  <Field label="Formulaire onboarding enregistré" value={stepVisibility.form ? "Oui" : "Non"} />
                  <Field label="Founder Scan enregistré" value={stepVisibility.founder ? "Oui" : "Non"} />
                </div>
                {emailBlockedByConflict && (
                  <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                    L’email existe bien dans le CRM, mais il n’est pas écrit localement parce qu’un autre client possède déjà cette adresse dans la base.
                  </div>
                )}
                {crmHasRunAds === null && (
                  <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                    Le champ “fait déjà des ads” n’est pas masqué : il est simplement absent de la réponse CRM pour ce client.
                  </div>
                )}
              </section>

              <div className="h-px bg-border/60" />

              <section className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">Fiche client</div>
                    <div className="text-sm text-muted-foreground">Toutes les infos utilisées pour les envois (emails, Slack, contrats).</div>
                  </div>
                  {editingInfo ? (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={saveInfoDraft} disabled={savingInfo}>Enregistrer</Button>
                      <Button size="sm" variant="ghost" onClick={cancelInfoEdit} disabled={savingInfo}>Annuler</Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" onClick={startInfoEdit}>
                      <Pencil className="h-3.5 w-3.5 mr-1" />
                      Modifier
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Client ID" value={client.client_id} />
                  <Field label="Client Code" value={client.client_code} />
                  {INFO_FIELDS.map((f) => {
                    if (!editingInfo) {
                      const raw = client[f.key];
                      let display: any = raw;
                      if (f.key === "already_runs_ads") {
                        display = raw === true ? "Oui" : raw === false ? "Non" : "Inconnu";
                      } else if (f.type === "date" && raw) {
                        display = String(raw).slice(0, 10);
                      }
                      return <Field key={f.key} label={f.label} value={display} />;
                    }
                    const val = infoDraft[f.key] ?? "";
                    const setVal = (v: any) => setInfoDraft((p) => ({ ...p, [f.key]: v }));
                    return (
                      <div key={f.key} className={f.type === "textarea" ? "md:col-span-2" : ""}>
                        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">{f.label}</div>
                        {f.type === "textarea" ? (
                          <Textarea
                            rows={2}
                            value={val}
                            onChange={(e) => setVal(e.target.value)}
                            className="text-sm"
                          />
                        ) : f.type === "select" ? (
                          <select
                            value={val}
                            onChange={(e) => setVal(e.target.value)}
                            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                          >
                            {f.options?.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type={f.type || "text"}
                            value={val}
                            onChange={(e) => setVal(e.target.value)}
                            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                          />
                        )}
                      </div>
                    );
                  })}
                  <Field label="Onboarding envoyé" value={client.onboarding_sent_at} />
                  <Field label="Statut CRM" value={client.external_status} />
                  <Field label="Lead ID" value={client.lead_id} />
                </div>
              </section>

              <div className="h-px bg-border/60" />

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Notes internes</label>
                <Textarea
                  defaultValue={client.internal_notes ?? ""}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
                <Button size="sm" onClick={saveNotes}>Enregistrer la note</Button>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="progress">
            <Card className="p-6 glass-card space-y-3">
              {ONBOARDING_STEPS.map((s, i) => {
                const done = isStepDone(client, i);
                const ts = client[s.flag];
                return (
                  <div key={s.key} className="flex items-center gap-3 py-2 border-b border-border/30 last:border-0">
                    <span className={`h-6 w-6 rounded-full flex items-center justify-center border ${done ? "border-[rgba(122,232,180,0.25)] bg-[rgba(122,232,180,0.08)] text-[hsl(var(--good))]" : "border-[rgba(148,170,215,0.12)] bg-[rgba(255,255,255,0.02)] text-[#5f6b82]"}`}>
                      {done ? <Check className="h-4 w-4" /> : <X className="h-3 w-3" />}
                    </span>
                    <div className="flex-1">
                      <div className="font-medium">{i + 1}. {s.label}</div>
                      <div className="text-xs text-muted-foreground">{ts ? new Date(ts).toLocaleString("fr-FR") : "Non complété"}</div>
                    </div>
                    {!done && (
                      <Button size="sm" variant="outline" onClick={() => markStep(s.flag)}>
                        Marquer complété
                      </Button>
                    )}
                  </div>
                );
              })}
            </Card>
          </TabsContent>

          <TabsContent value="platforms">
            <Card className="p-6 glass-card grid grid-cols-1 md:grid-cols-2 gap-3">
              {PLATFORMS.map((p) => {
                const cur = platforms.find((x) => x.platform === p);
                const st = cur?.status ?? "not_requested";
                return (
                  <div key={p} className="flex items-center justify-between gap-2 py-2 border-b border-border/30 last:border-0">
                    <div className="text-sm font-medium">{PLATFORM_LABEL[p]}</div>
                    <select
                      defaultValue={st}
                      onChange={(e) => updatePlatform(p, e.target.value)}
                      className="bg-background/60 border border-border/60 rounded-md px-2 py-1 text-xs"
                    >
                      {PLATFORM_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                );
              })}
            </Card>
          </TabsContent>

          <TabsContent value="quiz">
            <AnswersList answers={welcome} emptyText="Quiz d'intégration pas encore soumis." />
          </TabsContent>

          <TabsContent value="founder">
            <div className="space-y-4">
              <Card className="p-4 glass-card flex items-center justify-between">
                <div>
                  <div className="font-medium flex items-center gap-2"><Sparkles className="h-4 w-4" /> Résumé profil fondateur</div>
                  <div className="text-xs text-muted-foreground">Généré via Lovable AI</div>
                </div>
                <Button size="sm" onClick={generateSummary} disabled={genSummary || founder.length === 0}>
                  {genSummary ? "Génération…" : (client.founder_summary ? "Régénérer" : "Générer")}
                </Button>
              </Card>
              {client.founder_summary && (
                <Card className="p-6 glass-card grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  {Object.entries(client.founder_summary).map(([k, v]) => (
                    <Field key={k} label={k.replace(/_/g, " ")} value={String(v)} />
                  ))}
                </Card>
              )}
              <AnswersList answers={founder} emptyText="Founder Scan pas encore soumis." />
            </div>
          </TabsContent>

          <TabsContent value="payment">
            <Card className="p-6 glass-card grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <Field label="Montant attendu" value={client.stripe_amount_expected ?? client.deal_value} />
              <Field label="Montant payé" value={client.stripe_amount_paid} />
              <Field label="Customer Stripe ID" value={client.stripe_customer_id} />
              <Field label="Date paiement" value={client.payment_completed_at} />
              <Field label="Statut" value={client.paid ? "Payé" : "En attente"} />
              <Field label="Lien Stripe" value={client.stripe_link} />
              <div className="md:col-span-2 flex flex-wrap gap-2">
                {client.stripe_link && (
                  <Button asChild size="sm" variant="outline">
                    <a href={client.stripe_link} target="_blank" rel="noreferrer">Ouvrir Stripe <ExternalLink className="h-3 w-3 ml-1" /></a>
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={regenerateStripeLink}
                  disabled={regeneratingStripe || client.paid}
                  title={client.paid ? "Le client a déjà payé" : "Désactive l'ancien lien et en génère un nouveau au montant actuel"}
                >
                  <RefreshCw className={`h-3 w-3 mr-1 ${regeneratingStripe ? "animate-spin" : ""}`} />
                  {regeneratingStripe ? "Régénération…" : (client.stripe_link ? "Régénérer le lien" : "Générer un lien")}
                </Button>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="contract">
            <Card className="p-6 glass-card grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <Field label="Statut" value={client.contract_signed ? "Signé" : (client.docusign_sent_at ? "Envoyé" : "Pas encore envoyé")} />
              <Field label="Envoyé" value={client.docusign_sent_at} />
              <Field label="Vu" value={client.docusign_viewed_at} />
              <Field label="Signé" value={client.docusign_signed_at} />
              <Field label="Envelope ID" value={client.docusign_envelope_id} />
              <Field label="PDF signé" value={client.docusign_pdf_url} />
              {client.docusign_pdf_url && (
                <div className="md:col-span-2">
                  <Button asChild size="sm" variant="outline">
                    <a href={client.docusign_pdf_url} target="_blank" rel="noreferrer">
                      <FileText className="h-3 w-3 mr-1" /> Ouvrir le PDF
                    </a>
                  </Button>
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="kickoff">
            <Card className="p-6 glass-card grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <Field label="Statut" value={client.kickoff_scheduled ? "Booké" : "Non booké"} />
              <Field label="Date / heure" value={client.kickoff_scheduled_at} />
              <Field label="Lien meeting" value={client.kickoff_meeting_link} />
              <Field label="Lien calendrier" value={client.kickoff_calendar_link} />
            </Card>
          </TabsContent>

          <TabsContent value="logs">
            <Card className="p-6 glass-card space-y-2">
              {logs.length === 0 ? (
                <div className="text-sm text-muted-foreground">Aucun événement.</div>
              ) : logs.map((l) => (
                <div key={l.id} className="flex items-start gap-3 py-2 border-b border-border/30 last:border-0 text-sm">
                  <div className="text-xs text-muted-foreground w-32 shrink-0">
                    {new Date(l.created_at).toLocaleString("fr-FR")}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{l.event_type} {l.status && <span className="text-xs text-muted-foreground">— {l.status}</span>}</div>
                    {l.details && <pre className="text-xs text-muted-foreground whitespace-pre-wrap">{JSON.stringify(l.details, null, 0)}</pre>}
                    {l.error && <div className="text-xs text-[hsl(var(--bad))]">{l.error}</div>}
                  </div>
                </div>
              ))}
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

const Field = ({ label, value }: { label: string; value: any }) => (
  <div>
    <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
    <div className="text-sm break-words mt-0.5">{value === null || value === undefined || value === "" ? "—" : String(value)}</div>
  </div>
);

const AnswersList = ({ answers, emptyText }: { answers: any[]; emptyText: string }) => {
  if (answers.length === 0) return <Card className="p-6 glass-card text-sm text-muted-foreground">{emptyText}</Card>;
  return (
    <Card className="p-6 glass-card space-y-4">
      {answers.map((a) => (
        <div key={a.id} className="border-b border-border/30 last:border-0 pb-3">
          <div className="text-xs text-muted-foreground">{a.question_key}</div>
          <div className="font-medium text-sm">{a.question_label}</div>
          <div className="text-sm mt-1 whitespace-pre-wrap">{a.answer || "—"}</div>
        </div>
      ))}
    </Card>
  );
};

export default ClientDetail;
