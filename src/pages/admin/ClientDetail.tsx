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
  ArrowLeft, Check, Copy, ExternalLink, FileText, RefreshCw, Sparkles, X, CheckCircle2, RotateCcw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

        <Tabs defaultValue="info" className="space-y-4">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="info">Infos</TabsTrigger>
            <TabsTrigger value="progress">Progression</TabsTrigger>
            <TabsTrigger value="platforms">Plateformes</TabsTrigger>
            <TabsTrigger value="quiz">Quiz intégration</TabsTrigger>
            <TabsTrigger value="founder">Founder Scan</TabsTrigger>
            <TabsTrigger value="payment">Paiement</TabsTrigger>
            <TabsTrigger value="contract">Contrat</TabsTrigger>
            <TabsTrigger value="kickoff">Kick-off</TabsTrigger>
            <TabsTrigger value="logs">Logs</TabsTrigger>
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
                  <div>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Email enregistré localement</div>
                    {editingEmail ? (
                      <div className="flex gap-2">
                        <input
                          type="email"
                          value={emailDraft}
                          onChange={(e) => setEmailDraft(e.target.value)}
                          className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm"
                          autoFocus
                        />
                        <Button size="sm" onClick={saveEmail} disabled={savingEmail}>Enregistrer</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingEmail(false)} disabled={savingEmail}>Annuler</Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm">
                          {emailBlockedByConflict ? `${crmEmail} (bloqué par doublon local)` : (client.email || "—")}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { setEmailDraft(client.email || ""); setEditingEmail(true); }}
                        >
                          Modifier
                        </Button>
                      </div>
                    )}
                  </div>
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

              <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Client ID" value={client.client_id} />
                <Field label="Client Code" value={client.client_code} />
                <Field label="Nom client" value={client.client_name} />
                <Field label="Entreprise" value={client.company_name || client.brand_name} />
                <Field label="Source du lead" value={client.lead_source} />
                <Field label="Deal value" value={client.deal_value} />
                <Field label="Closing date" value={client.closing_date} />
                <Field label="Budget publicitaire" value={client.ad_budget} />
                <Field label="Closer" value={client.closer_name} />
                <Field label="Superviseur sales" value={client.sales_supervisor} />
                <Field label="Onboarding envoyé" value={client.onboarding_sent_at} />
                <Field label="Statut CRM" value={client.external_status} />
                <Field label="Contrat — début" value={client.contract_start_date} />
                <Field label="Contrat — fin" value={client.contract_end_date} />
                <Field label="Churné le" value={client.churned_at} />
                <Field label="Raison churn" value={client.churn_reason} />
                <Field label="Pain point" value={client.owner_pain_point} />
                <Field label="Lead ID" value={client.lead_id} />
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
                    <span className={`h-6 w-6 rounded-full flex items-center justify-center ${done ? "bg-emerald-500/20 text-emerald-400" : "bg-zinc-600/30 text-zinc-400"}`}>
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
              <div className="md:col-span-2 flex gap-2">
                {client.stripe_link && (
                  <Button asChild size="sm" variant="outline">
                    <a href={client.stripe_link} target="_blank" rel="noreferrer">Ouvrir Stripe <ExternalLink className="h-3 w-3 ml-1" /></a>
                  </Button>
                )}
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
                    {l.error && <div className="text-xs text-red-400">{l.error}</div>}
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
