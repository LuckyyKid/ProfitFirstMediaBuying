// Wizard admin 3 étapes : Contexte → Preview → Publier.
// Utilise report-payload-build (Lovable) puis buildNarrative() (local, pur TS).
// Publie via report-save + report-publish (Lovable).

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  ChevronRight,
  ChevronLeft,
  Send,
  Loader2,
  AlertCircle,
  Plus,
  X,
} from "lucide-react";
import { ClientReportView } from "./ClientReportView";
import {
  buildNarrative,
  publishBlocker,
  type PayloadSysteme,
  type InputsAm,
  type AnswerToQuestion,
  type ProposedAction,
  type ActionCategory,
  type CreativeStatus,
  type CreativeStatusValue,
  type AdSetNote,
  type CreativeRow,
  type AdSetRow,
  type Narrative,
  type NarrativeAnswer,
  type CheckedCause,
  type Certainty,
  type PreviousActionStatus,
} from "@/lib/reportNarrative";
import { resolveCreativeImageUrl } from "@/lib/creativeThumbnail";

interface Props {
  clientCode: string | null;
  clientLabel?: string | null;
}

type Step = 1 | 2 | 3;

const CONTEXTE_FLAGS = [
  { id: "promo", label: "Promo en cours" },
  { id: "rupture_stock", label: "Rupture de stock" },
  { id: "saisonnalite", label: "Saisonnalité" },
  { id: "evenement", label: "Événement client" },
  { id: "changement_compte", label: "Changement compte pub" },
] as const;

const ACTION_CATEGORIES: Array<{ id: ActionCategory; label: string }> = [
  { id: "creative", label: "Créative" },
  { id: "budget", label: "Budget" },
  { id: "audience", label: "Audience" },
  { id: "landing", label: "Landing page" },
  { id: "offre", label: "Offre" },
  { id: "mesure", label: "Mesure" },
  { id: "attente", label: "Attente / surveillance" },
];

const CREATIVE_STATUS_OPTIONS: Array<{
  value: CreativeStatusValue;
  label: string;
  dot: string;
  active: string;
}> = [
  { value: "keep", label: "On garde", dot: "#3ddc97", active: "border-emerald-500/60 bg-emerald-500/15 text-emerald-500" },
  { value: "cut", label: "Coupée", dot: "#ff6b6b", active: "border-red-500/60 bg-red-500/15 text-red-500" },
  { value: "test", label: "En test", dot: "#f5b74e", active: "border-yellow-500/60 bg-yellow-500/15 text-yellow-500" },
];

const CERTAINTY_OPTIONS: Array<{ value: Certainty; label: string; active: string }> = [
  { value: "confirmed", label: "Confirmé", active: "border-emerald-500/60 bg-emerald-500/15 text-emerald-500" },
  { value: "probable", label: "Probable", active: "border-blue-500/60 bg-blue-500/15 text-blue-500" },
  { value: "hypothesis", label: "Hypothèse", active: "border-yellow-500/60 bg-yellow-500/15 text-yellow-500" },
];

const FUNNEL_STAGE_LABEL: Record<Narrative["funnel_stage"], string> = {
  creative: "Créative",
  post_click: "Post-clic",
  conversion: "Conversion",
  aov: "Panier moyen",
  cost: "Coût / enchère",
  scaling: "Scaling",
};

const PREVIOUS_ACTION_STATUS_OPTIONS: Array<{
  value: PreviousActionStatus["status"];
  label: string;
  active: string;
}> = [
  { value: "done", label: "Faite", active: "border-emerald-500/60 bg-emerald-500/15 text-emerald-500" },
  { value: "in_progress", label: "En cours", active: "border-blue-500/60 bg-blue-500/15 text-blue-500" },
  { value: "blocked", label: "Bloquée", active: "border-red-500/60 bg-red-500/15 text-red-500" },
];

// Clés stables utilisées pour retrouver un statut créative / une note ad set
// dans les inputs AM. Priorité à l'id Meta quand présent, sinon fallback nom.
function creativeKey(c: CreativeRow): string {
  return c.id ?? c.ad_name ?? "";
}
function adSetKey(a: AdSetRow): string {
  return a.id ?? a.name ?? "";
}

function lastMondayToSunday(from = new Date()): { debut: string; fin: string } {
  const d = new Date(from);
  const day = d.getDay(); // 0 = dim
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(d);
  monday.setDate(d.getDate() - diff - 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const iso = (x: Date) => x.toISOString().slice(0, 10);
  return { debut: iso(monday), fin: iso(sunday) };
}

function isFunctionMissing(err: unknown): boolean {
  const msg = ((err as Error)?.message ?? "").toLowerCase();
  return (
    msg.includes("not found") ||
    msg.includes("404") ||
    msg.includes("failed to send a request")
  );
}

export function GenerateReportWizard({ clientCode, clientLabel }: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>(1);

  const defaultPeriode = useMemo(() => lastMondayToSunday(), []);
  const [debut, setDebut] = useState(defaultPeriode.debut);
  const [fin, setFin] = useState(defaultPeriode.fin);

  const [payload, setPayload] = useState<PayloadSysteme | null>(null);
  const [payloadLoading, setPayloadLoading] = useState(false);
  const [payloadErr, setPayloadErr] = useState<string | null>(null);
  const [backendMissing, setBackendMissing] = useState(false);

  const [contexteFlags, setContexteFlags] = useState<string[]>([]);
  const [contexteBusiness, setContexteBusiness] = useState("");
  const [aVenir, setAVenir] = useState("");
  const [answers, setAnswers] = useState<Record<string, AnswerToQuestion>>({});
  // Nouveau chemin : réponses AM aux narratives (chips + certitude + note).
  // Indexé par narrative_id pour rester stable entre les recharges de payload.
  const [narrativeAnswers, setNarrativeAnswers] = useState<Record<string, NarrativeAnswer>>({});
  const [actions, setActions] = useState<ProposedAction[]>([]);
  // Statut de chaque créative — indexé par creativeKey pour survivre à un
  // rechargement du payload qui préserverait ids et noms.
  const [creativeStatuses, setCreativeStatuses] = useState<Record<string, CreativeStatus>>({});
  const [adSetNotes, setAdSetNotes] = useState<Record<string, AdSetNote>>({});
  // Suivi des actions du rapport précédent — indexé par action_id (l'id est
  // stable et fourni par le snapshot backend).
  const [previousActionsStatus, setPreviousActionsStatus] = useState<Record<string, PreviousActionStatus>>({});

  const [reportId, setReportId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const reset = useCallback(() => {
    setStep(1);
    setPayload(null);
    setPayloadErr(null);
    setBackendMissing(false);
    setContexteFlags([]);
    setContexteBusiness("");
    setAVenir("");
    setAnswers({});
    setNarrativeAnswers({});
    setActions([]);
    setCreativeStatuses({});
    setAdSetNotes({});
    setPreviousActionsStatus({});
    setReportId(null);
  }, []);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const loadPayload = async () => {
    if (!clientCode) return;
    setPayloadLoading(true);
    setPayloadErr(null);
    try {
      const { data, error } = await supabase.functions.invoke("report-payload-build", {
        body: { client_code: clientCode, periode_debut: debut, periode_fin: fin },
      });
      if (error) throw error;
      const p = (data?.payload_systeme ?? null) as PayloadSysteme | null;
      if (!p) throw new Error("Le backend a retourné un payload vide.");
      setPayload(p);
      setBackendMissing(false);
    } catch (e) {
      if (isFunctionMissing(e)) {
        setBackendMissing(true);
        setPayloadErr(
          "L'edge function report-payload-build n'est pas déployée.",
        );
      } else {
        setPayloadErr(
          (e as Error).message ||
            "Impossible de charger les données de la période.",
        );
      }
    } finally {
      setPayloadLoading(false);
    }
  };

  const inputsAm: InputsAm = useMemo(() => {
    const statuses = Object.values(creativeStatuses).filter((s) => s.status);
    const notes = Object.values(adSetNotes).filter((n) => n.note?.trim());
    const narrAnswers = Object.values(narrativeAnswers).filter(
      (a) => a.checked_causes.length > 0 || a.note?.trim() || a.certainty,
    );
    const prevStatuses = Object.values(previousActionsStatus).filter((s) => s.status);
    return {
      contexte_flags: contexteFlags,
      contexte_business: contexteBusiness,
      a_venir: aVenir,
      answers: Object.values(answers),
      narrative_answers: narrAnswers.length > 0 ? narrAnswers : undefined,
      actions,
      creative_statuses: statuses.length > 0 ? statuses : undefined,
      ad_set_notes: notes.length > 0 ? notes : undefined,
      previous_actions_status: prevStatuses.length > 0 ? prevStatuses : undefined,
    };
  }, [contexteFlags, contexteBusiness, aVenir, answers, narrativeAnswers, actions, creativeStatuses, adSetNotes, previousActionsStatus]);

  const narrative = useMemo(() => {
    if (!payload) return null;
    return buildNarrative(payload, inputsAm);
  }, [payload, inputsAm]);

  const goToStep = async (target: Step) => {
    if (target === 2 && !payload) {
      await loadPayload();
      if (payloadErr || !payload) return;
    }
    setStep(target);
  };

  const saveDraft = async () => {
    if (!clientCode || !payload || !narrative) return;
    setSaving(true);
    const t = toast.loading("Sauvegarde du brouillon…");
    try {
      const { data, error } = await supabase.functions.invoke("report-save", {
        body: {
          client_code: clientCode,
          periode_debut: debut,
          periode_fin: fin,
          inputs_am: inputsAm,
          rapport: narrative,
          payload_systeme: payload,
        },
      });
      if (error) throw error;
      toast.dismiss(t);
      const report = data?.report as { id?: string } | undefined;
      if (report?.id) setReportId(report.id);
      toast.success("Brouillon sauvegardé.");
    } catch (e) {
      toast.dismiss(t);
      toast.error((e as Error).message || "Sauvegarde impossible.");
    } finally {
      setSaving(false);
    }
  };

  const publish = async () => {
    if (!payload) return;
    const blocker = publishBlocker(payload, inputsAm);
    if (blocker) {
      toast.error(blocker);
      return;
    }
    if (!reportId) {
      await saveDraft();
    }
    // saveDraft peut être async d'un state — on relit
    const id = reportId;
    if (!id) {
      toast.error("Il faut d'abord sauvegarder un brouillon.");
      return;
    }
    setPublishing(true);
    const t = toast.loading("Publication en cours…");
    try {
      const { data, error } = await supabase.functions.invoke("report-publish", {
        body: { id },
      });
      if (error) throw error;
      toast.dismiss(t);
      const notifs = data?.notifications as
        | { email?: { sent: boolean; error?: string }; slack?: { sent: boolean; error?: string } }
        | undefined;
      const emailOk = notifs?.email?.sent;
      const slackOk = notifs?.slack?.sent;
      toast.success(
        `Rapport publié. Notifications : ${emailOk ? "email ✓" : "email ✗"} · ${slackOk ? "Slack ✓" : "Slack ✗"}`,
      );
      setOpen(false);
    } catch (e) {
      toast.dismiss(t);
      toast.error((e as Error).message || "Publication impossible.");
    } finally {
      setPublishing(false);
    }
  };

  const addAction = () => {
    setActions((prev) => [
      ...prev,
      { action: "", pourquoi_chiffre: "", resultat_attendu: "", responsible: "agence", horizon: "cette_semaine" },
    ]);
  };
  const updateAction = (idx: number, patch: Partial<ProposedAction>) => {
    setActions((prev) => prev.map((a, i) => (i === idx ? { ...a, ...patch } : a)));
  };
  const removeAction = (idx: number) => {
    setActions((prev) => prev.filter((_, i) => i !== idx));
  };

  const toggleFlag = (id: string) => {
    setContexteFlags((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const setAnswer = (questionId: string, patch: Partial<AnswerToQuestion>) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: {
        question_id: questionId,
        confirm: prev[questionId]?.confirm ?? "other",
        explanation: prev[questionId]?.explanation ?? "",
        ...patch,
      },
    }));
  };

  const setCreativeStatus = (c: CreativeRow, status: CreativeStatusValue) => {
    const key = creativeKey(c);
    if (!key) return;
    setCreativeStatuses((prev) => {
      // Toggle : re-cliquer sur la même valeur retire le statut.
      if (prev[key]?.status === status) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return {
        ...prev,
        [key]: {
          creative_id: c.id,
          creative_name: c.ad_name,
          status,
        },
      };
    });
  };

  const setAdSetNote = (a: AdSetRow, note: string) => {
    const key = adSetKey(a);
    if (!key) return;
    setAdSetNotes((prev) => ({
      ...prev,
      [key]: { ad_set_id: a.id, ad_set_name: a.name, note },
    }));
  };

  // Statut d'une action du rapport précédent. Toggle : recliquer sur la même
  // valeur supprime l'entrée (rien envoyé au backend = « pas encore statué »).
  const setPreviousActionStatus = (
    actionId: string,
    status: PreviousActionStatus["status"],
  ) => {
    setPreviousActionsStatus((prev) => {
      if (prev[actionId]?.status === status) {
        const next = { ...prev };
        delete next[actionId];
        return next;
      }
      return {
        ...prev,
        [actionId]: {
          action_id: actionId,
          status,
          blocker: prev[actionId]?.blocker,
        },
      };
    });
  };

  const setPreviousActionBlocker = (actionId: string, blocker: string) => {
    setPreviousActionsStatus((prev) => {
      const current = prev[actionId];
      if (!current) return prev;
      return {
        ...prev,
        [actionId]: { ...current, blocker },
      };
    });
  };

  // Retourne l'entrée narrativeAnswers courante pour cet id, ou un shape vide.
  const getNarrativeAnswer = (id: string): NarrativeAnswer =>
    narrativeAnswers[id] ?? { narrative_id: id, checked_causes: [] };

  const toggleNarrativeCause = (narrativeId: string, causeId: string) => {
    setNarrativeAnswers((prev) => {
      const current: NarrativeAnswer = prev[narrativeId] ?? {
        narrative_id: narrativeId,
        checked_causes: [],
      };
      const idx = current.checked_causes.findIndex((c) => c.cause_id === causeId);
      const nextCauses =
        idx >= 0
          ? current.checked_causes.filter((_, i) => i !== idx)
          : [...current.checked_causes, { cause_id: causeId }];
      return {
        ...prev,
        [narrativeId]: { ...current, checked_causes: nextCauses },
      };
    });
  };

  const updateNarrativeCauseDetail = (
    narrativeId: string,
    causeId: string,
    patch: Partial<Pick<CheckedCause, "details" | "linked_ad_ids">>,
  ) => {
    setNarrativeAnswers((prev) => {
      const current: NarrativeAnswer = prev[narrativeId] ?? {
        narrative_id: narrativeId,
        checked_causes: [],
      };
      return {
        ...prev,
        [narrativeId]: {
          ...current,
          checked_causes: current.checked_causes.map((c) =>
            c.cause_id === causeId ? { ...c, ...patch } : c,
          ),
        },
      };
    });
  };

  const setNarrativeCertainty = (narrativeId: string, certainty: Certainty | undefined) => {
    setNarrativeAnswers((prev) => ({
      ...prev,
      [narrativeId]: {
        ...(prev[narrativeId] ?? { narrative_id: narrativeId, checked_causes: [] }),
        certainty,
      },
    }));
  };

  const setNarrativeNote = (narrativeId: string, note: string) => {
    setNarrativeAnswers((prev) => ({
      ...prev,
      [narrativeId]: {
        ...(prev[narrativeId] ?? { narrative_id: narrativeId, checked_causes: [] }),
        note,
      },
    }));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {clientCode && (
        <DialogTrigger asChild>
          <Button size="sm" variant="outline" className="gap-1.5">
            <FileText className="h-4 w-4" />
            Rédiger le rapport hebdo
          </Button>
        </DialogTrigger>
      )}

      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Rédiger le rapport hebdomadaire
            <span className="text-xs text-muted-foreground ml-2 font-normal">
              étape {step} / 3
            </span>
          </DialogTitle>
          <DialogDescription>
            {step === 1 && "Choisis la période, charge les données Meta et remplis le contexte que les chiffres ne racontent pas."}
            {step === 2 && "Vérifie le rendu exact que le client verra dans son portail avant de publier."}
            {step === 3 && "Confirme la publication. Le client recevra une notification par email et l'agence dans Slack."}
          </DialogDescription>
        </DialogHeader>

        {/* ── STEP 1 : contexte ─────────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Début de période</Label>
                <Input type="date" value={debut} onChange={(e) => setDebut(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Fin de période</Label>
                <Input type="date" value={fin} onChange={(e) => setFin(e.target.value)} />
              </div>
            </div>

            <div>
              <Button onClick={loadPayload} disabled={payloadLoading || !clientCode} size="sm">
                {payloadLoading ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}
                Charger les données Meta pour cette période
              </Button>
            </div>

            {backendMissing && (
              <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3 text-xs">
                Le backend rapport n'est pas encore déployé.
              </div>
            )}
            {payloadErr && !backendMissing && (
              <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-500">
                {payloadErr}
              </div>
            )}

            {payload && (
              <>
                <div className="rounded-lg border border-border/50 bg-background/40 p-3 text-xs space-y-1">
                  <div><b>{payload.variations.length}</b> variation(s) détectée(s) au-delà du seuil</div>
                  <div><b>{payload.questions_ouvertes.length}</b> question(s) ouverte(s) à trancher</div>
                  <div><b>{payload.am_activity_log.length}</b> événement(s) journalisé(s) dans la période</div>
                  <div><b>{payload.flags.length}</b> flag(s) techniques</div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Contexte business de la semaine</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {CONTEXTE_FLAGS.map((f) => {
                      const active = contexteFlags.includes(f.id);
                      return (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => toggleFlag(f.id)}
                          className={`px-2.5 py-1 rounded-full text-[11px] border transition ${
                            active
                              ? "border-primary/60 bg-primary/15 text-primary"
                              : "border-border/50 bg-background/40 text-muted-foreground hover:bg-muted/20"
                          }`}
                        >
                          {f.label}
                        </button>
                      );
                    })}
                  </div>
                  <Textarea
                    rows={2}
                    placeholder="Précisions libres (facultatif)"
                    value={contexteBusiness}
                    onChange={(e) => setContexteBusiness(e.target.value)}
                  />
                </div>

                {payload.previous_report_snapshot &&
                  payload.previous_report_snapshot.actions.length > 0 && (
                    <div className="space-y-2">
                      <div>
                        <Label className="text-xs">
                          Suivi des actions du rapport précédent (
                          {payload.previous_report_snapshot.actions.length})
                        </Label>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Période N-1 : {payload.previous_report_snapshot.periode_debut} →{" "}
                          {payload.previous_report_snapshot.periode_fin}. Ton statut
                          apparaît dans le rapport client à côté de l'action.
                        </p>
                      </div>
                      <div className="space-y-1.5">
                        {payload.previous_report_snapshot.actions.map((a) => {
                          const current = previousActionsStatus[a.id];
                          return (
                            <div
                              key={a.id}
                              className="rounded-md border border-border/50 bg-background/40 p-2.5 space-y-1.5"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="text-xs flex-1">{a.action}</div>
                                <div className="flex gap-1 flex-shrink-0">
                                  {PREVIOUS_ACTION_STATUS_OPTIONS.map((opt) => {
                                    const active = current?.status === opt.value;
                                    return (
                                      <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() =>
                                          setPreviousActionStatus(a.id, opt.value)
                                        }
                                        className={`px-2 py-1 rounded-full text-[10px] border transition ${
                                          active
                                            ? opt.active
                                            : "border-border/50 bg-background/40 text-muted-foreground hover:bg-muted/20"
                                        }`}
                                      >
                                        {opt.label}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                              {current?.status === "blocked" && (
                                <Textarea
                                  rows={2}
                                  placeholder="Qu'est-ce qui bloque ? (rendu tel quel au client)"
                                  value={current.blocker ?? ""}
                                  onChange={(e) =>
                                    setPreviousActionBlocker(a.id, e.target.value)
                                  }
                                  className="text-xs"
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                {payload.narratives && payload.narratives.length > 0 ? (
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs">
                        Notre lecture de la semaine ({payload.narratives.length})
                      </Label>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Ta réponse devient la section « Notre lecture » du rapport client. Coche les causes plausibles, l'IA ne tranche jamais à ta place.
                      </p>
                    </div>
                    {payload.narratives.map((n) => (
                      <NarrativeCard
                        key={n.id}
                        narrative={n}
                        answer={getNarrativeAnswer(n.id)}
                        onToggleCause={(causeId) => toggleNarrativeCause(n.id, causeId)}
                        onCauseDetail={(causeId, patch) =>
                          updateNarrativeCauseDetail(n.id, causeId, patch)
                        }
                        onCertainty={(c) => setNarrativeCertainty(n.id, c)}
                        onNote={(v) => setNarrativeNote(n.id, v)}
                      />
                    ))}
                  </div>
                ) : (
                  payload.questions_ouvertes.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-xs">Questions ouvertes ({payload.questions_ouvertes.length})</Label>
                      {payload.questions_ouvertes.map((q) => {
                        const a = answers[q.id];
                        return (
                          <div key={q.id} className="rounded-md border border-border/50 bg-background/40 p-3 space-y-2 text-xs">
                            <div className="font-medium">{q.context}</div>
                            <div className="flex gap-1">
                              {(["yes", "no", "other"] as const).map((v) => (
                                <Button
                                  key={v}
                                  type="button"
                                  variant={a?.confirm === v ? "default" : "outline"}
                                  size="sm"
                                  className="h-7 text-[11px]"
                                  onClick={() => setAnswer(q.id, { confirm: v })}
                                >
                                  {v === "yes" ? "Oui, c'est la cause" : v === "no" ? "Non, autre chose" : "Je ne sais pas"}
                                </Button>
                              ))}
                            </div>
                            <Textarea
                              rows={2}
                              placeholder="Explication (facultatif)"
                              value={a?.explanation ?? ""}
                              onChange={(e) => setAnswer(q.id, { explanation: e.target.value })}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )
                )}

                {payload.creatives_highlight?.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs">
                      Statut des créatives ({payload.creatives_highlight.length})
                    </Label>
                    <p className="text-[11px] text-muted-foreground -mt-1">
                      Ton choix atterrit en pastille à côté de chaque vignette dans le rapport client.
                    </p>
                    <div className="space-y-1.5">
                      {payload.creatives_highlight.map((c, idx) => {
                        const key = creativeKey(c) || `_${idx}`;
                        const current = creativeStatuses[key]?.status;
                        return (
                          <div
                            key={key}
                            className="rounded-md border border-border/50 bg-background/40 p-2.5 flex items-center gap-3"
                          >
                            {(() => {
                              const thumb = resolveCreativeImageUrl(c as Record<string, unknown>);
                              return thumb ? (
                                <img
                                  src={thumb}
                                  alt=""
                                  className="h-10 w-10 rounded object-cover flex-shrink-0 border border-border/50"
                                  loading="lazy"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <div className="h-10 w-10 rounded bg-muted/30 flex-shrink-0 flex items-center justify-center text-[9px] text-muted-foreground">
                                  —
                                </div>
                              );
                            })()}
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium truncate">
                                {c.ad_name ?? "Créative sans nom"}
                              </div>
                              <div className="text-[10px] text-muted-foreground truncate">
                                {c.ad_set_name ?? "—"}
                                {typeof c.spend === "number" && ` · ${Math.round(c.spend)} $ dépensés`}
                                {typeof c.ctr === "number" && ` · CTR ${c.ctr.toFixed(2)} %`}
                              </div>
                            </div>
                            <div className="flex gap-1 flex-shrink-0">
                              {CREATIVE_STATUS_OPTIONS.map((opt) => {
                                const active = current === opt.value;
                                return (
                                  <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => setCreativeStatus(c, opt.value)}
                                    className={`px-2 py-1 rounded-full text-[10px] border transition flex items-center gap-1 ${
                                      active
                                        ? opt.active
                                        : "border-border/50 bg-background/40 text-muted-foreground hover:bg-muted/20"
                                    }`}
                                  >
                                    <span
                                      className="inline-block h-1.5 w-1.5 rounded-full"
                                      style={{ background: opt.dot }}
                                    />
                                    {opt.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {payload.breakdown_ad_sets?.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs">
                      Notes narratives par ad set ({payload.breakdown_ad_sets.length}) — facultatif
                    </Label>
                    <p className="text-[11px] text-muted-foreground -mt-1">
                      Une phrase pour raconter une décision qui ne se voit pas dans les chiffres. Rendu tel quel sous les cartes créatives.
                    </p>
                    <div className="space-y-1.5">
                      {payload.breakdown_ad_sets.map((a, idx) => {
                        const key = adSetKey(a) || `_${idx}`;
                        const note = adSetNotes[key]?.note ?? "";
                        return (
                          <div
                            key={key}
                            className="rounded-md border border-border/50 bg-background/40 p-2.5 space-y-1.5"
                          >
                            <div className="flex items-baseline justify-between gap-2">
                              <div className="text-xs font-medium truncate">
                                {a.name ?? "Ad set sans nom"}
                              </div>
                              <div className="text-[10px] text-muted-foreground flex-shrink-0">
                                {typeof a.spend === "number" && `${Math.round(a.spend)} $`}
                                {typeof a.roas === "number" && ` · ROAS ${a.roas.toFixed(2)}×`}
                              </div>
                            </div>
                            <Textarea
                              rows={2}
                              placeholder="Ex. On a coupé les 3 statiques sous 1 % de CTR, on garde les 2 UGC."
                              value={note}
                              onChange={(e) => setAdSetNote(a, e.target.value)}
                              className="text-xs"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-xs">Ce qui s'en vient (facultatif)</Label>
                  <Textarea
                    rows={2}
                    placeholder="Ex. nouvelles UGC reçues la semaine prochaine"
                    value={aVenir}
                    onChange={(e) => setAVenir(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Plan d'action pour la semaine prochaine</Label>
                    <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={addAction}>
                      <Plus className="h-3 w-3 mr-1" /> Ajouter
                    </Button>
                  </div>
                  {actions.length === 0 && (
                    <div className="text-[11px] text-muted-foreground py-2">
                      Aucune action décidée. Si tout est dans les cibles, le statu quo est une action valide et sera proposé automatiquement.
                    </div>
                  )}
                  {actions.map((a, idx) => (
                    <div key={idx} className="rounded-md border border-border/50 bg-background/40 p-3 space-y-2 text-xs">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 space-y-2">
                          <Input
                            placeholder="Action à mener"
                            value={a.action}
                            onChange={(e) => updateAction(idx, { action: e.target.value })}
                          />
                          <Input
                            placeholder="Parce que… (donnée chiffrée)"
                            value={a.pourquoi_chiffre ?? ""}
                            onChange={(e) => updateAction(idx, { pourquoi_chiffre: e.target.value })}
                          />
                          <Input
                            placeholder="Résultat attendu"
                            value={a.resultat_attendu ?? ""}
                            onChange={(e) => updateAction(idx, { resultat_attendu: e.target.value })}
                          />
                          <div className="grid grid-cols-3 gap-2">
                            <Select
                              value={a.category ?? ""}
                              onValueChange={(v) => updateAction(idx, { category: v as ActionCategory })}
                            >
                              <SelectTrigger className="h-8 text-[11px]"><SelectValue placeholder="Catégorie" /></SelectTrigger>
                              <SelectContent>
                                {ACTION_CATEGORIES.map((c) => (
                                  <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Select
                              value={a.responsible ?? "agence"}
                              onValueChange={(v) => updateAction(idx, { responsible: v as "agence" | "client" })}
                            >
                              <SelectTrigger className="h-8 text-[11px]"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="agence">Agence</SelectItem>
                                <SelectItem value="client">Client</SelectItem>
                              </SelectContent>
                            </Select>
                            <Select
                              value={a.horizon ?? "cette_semaine"}
                              onValueChange={(v) => updateAction(idx, { horizon: v as ProposedAction["horizon"] })}
                            >
                              <SelectTrigger className="h-8 text-[11px]"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="cette_semaine">Cette semaine</SelectItem>
                                <SelectItem value="prochaine">Semaine prochaine</SelectItem>
                                <SelectItem value="mois">Ce mois</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-red-500"
                          onClick={() => removeAction(idx)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── STEP 2 : preview ──────────────────────────────────────── */}
        {step === 2 && payload && narrative && (
          <ClientReportView
            narrative={narrative}
            clientLabel={clientLabel ?? clientCode ?? "Client"}
            periode={payload.periode}
            fraicheur={payload.fraicheur}
            payloadSysteme={payload}
            mode="preview"
          />
        )}

        {/* ── STEP 3 : confirmation ─────────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-3">
            <div className="rounded-lg border border-border/50 bg-background/40 p-4 text-sm space-y-2">
              <div className="flex items-center gap-2 text-emerald-500">
                <AlertCircle className="h-4 w-4" />
                <span className="font-medium">Prêt à publier</span>
              </div>
              <div className="text-xs text-muted-foreground">
                Le rapport sera figé en BDD (snapshot), visible pour le client dans son portail, et
                les notifications suivantes seront déclenchées :
              </div>
              <ul className="text-xs space-y-1 pl-4 list-disc">
                <li>Courriel au client (adresse dans <code>client_progress</code>)</li>
                <li>Message Slack #client-nps</li>
              </ul>
              <div className="text-[11px] text-muted-foreground pt-2 border-t border-border/40">
                Si l'envoi email ou Slack échoue, la publication reste effective — tu verras l'état par canal après l'action.
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="flex justify-between gap-2">
          <div>
            {step > 1 && (
              <Button variant="outline" onClick={() => setStep((step - 1) as Step)}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Retour
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {step === 1 && (
              <Button onClick={() => goToStep(2)} disabled={!payload}>
                Preview <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
            {step === 2 && (
              <>
                <Button variant="outline" onClick={saveDraft} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}
                  Sauvegarder brouillon
                </Button>
                <Button onClick={() => setStep(3)}>
                  Passer à la publication <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </>
            )}
            {step === 3 && (
              <Button onClick={publish} disabled={publishing}>
                {publishing ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Send className="h-4 w-4 mr-1.5" />}
                Publier
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Sous-composants ─────────────────────────────────────────────────

interface NarrativeCardProps {
  narrative: Narrative;
  answer: NarrativeAnswer;
  onToggleCause: (causeId: string) => void;
  onCauseDetail: (
    causeId: string,
    patch: Partial<Pick<CheckedCause, "details" | "linked_ad_ids">>,
  ) => void;
  onCertainty: (c: Certainty | undefined) => void;
  onNote: (v: string) => void;
}

function NarrativeCard({
  narrative,
  answer,
  onToggleCause,
  onCauseDetail,
  onCertainty,
  onNote,
}: NarrativeCardProps) {
  const checkedById = new Map(answer.checked_causes.map((c) => [c.cause_id, c]));

  // Cas auto-résolu : le backend prouve la cause depuis les données. L'AM
  // ne coche rien et le certainty est verrouillé sur Confirmé — on affiche
  // juste la lecture, un champ note facultatif, et on informe que rien n'est
  // demandé.
  if (narrative.auto_resolved) {
    return (
      <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-2 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider border border-emerald-500/60 bg-emerald-500/15 text-emerald-500">
            Confirmé — auto
          </span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {FUNNEL_STAGE_LABEL[narrative.funnel_stage]}
          </span>
        </div>
        <div className="font-medium text-sm">{narrative.title}</div>
        <div className="text-muted-foreground leading-relaxed">{narrative.human_description}</div>
        {narrative.auto_resolution && (
          <div className="text-emerald-500 leading-relaxed">{narrative.auto_resolution}</div>
        )}
        {narrative.verified_facts.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {narrative.verified_facts.map((f, i) => (
              <span
                key={i}
                className="px-2 py-0.5 rounded-md text-[10px] bg-background/60 border border-border/50 text-muted-foreground"
              >
                {f}
              </span>
            ))}
          </div>
        )}
        <Textarea
          rows={2}
          placeholder="Note facultative (rendu tel quel dans le rapport)"
          value={answer.note ?? ""}
          onChange={(e) => onNote(e.target.value)}
          className="text-xs"
        />
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border/50 bg-background/40 p-3 space-y-2.5 text-xs">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {FUNNEL_STAGE_LABEL[narrative.funnel_stage]}
        </span>
      </div>
      <div className="font-medium text-sm">{narrative.title}</div>
      <div className="text-muted-foreground leading-relaxed">{narrative.human_description}</div>

      {narrative.verified_facts.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {narrative.verified_facts.map((f, i) => (
            <span
              key={i}
              className="px-2 py-0.5 rounded-md text-[10px] bg-background/60 border border-border/50 text-muted-foreground"
            >
              {f}
            </span>
          ))}
        </div>
      )}

      <div className="pt-1">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
          Causes plausibles — coche celles qui s'appliquent
        </div>
        <div className="flex flex-wrap gap-1.5">
          {narrative.available_causes.map((c) => {
            const active = checkedById.has(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onToggleCause(c.id)}
                className={`px-2.5 py-1 rounded-full text-[11px] border transition ${
                  active
                    ? "border-primary/60 bg-primary/15 text-primary"
                    : "border-border/50 bg-background/40 text-muted-foreground hover:bg-muted/20"
                }`}
              >
                {c.label}
              </button>
            );
          })}
        </div>

        {narrative.available_causes
          .filter((c) => checkedById.has(c.id) && c.needs_detail)
          .map((c) => (
            <Input
              key={`detail_${c.id}`}
              className="mt-2 text-xs"
              placeholder={`Précision pour « ${c.label} »`}
              value={checkedById.get(c.id)?.details ?? ""}
              onChange={(e) => onCauseDetail(c.id, { details: e.target.value })}
            />
          ))}
      </div>

      <Textarea
        rows={2}
        placeholder="Autre chose à ajouter ? (rendu tel quel — facultatif)"
        value={answer.note ?? ""}
        onChange={(e) => onNote(e.target.value)}
        className="text-xs"
      />

      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
          Ton verdict — c'est ce que le client verra en badge
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {CERTAINTY_OPTIONS.map((opt) => {
            const active = answer.certainty === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onCertainty(active ? undefined : opt.value)}
                className={`px-2.5 py-1 rounded-full text-[11px] border transition ${
                  active
                    ? opt.active
                    : "border-border/50 bg-background/40 text-muted-foreground hover:bg-muted/20"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
