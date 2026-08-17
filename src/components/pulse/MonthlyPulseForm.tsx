import { useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

type Lang = "fr" | "en";
type CollabHealth = "very_healthy" | "good" | "fragile" | "at_risk";
type Priority = "volume" | "profitability" | "test_angles" | "creatives" | "foundation" | "stabilize" | "other";
type Difficulty = "communication" | "creative_quality" | "creative_volume" | "strategy"
                | "timelines" | "reporting" | "brand_understanding" | "other";

export interface MonthlyPrefill {
  nps_score?: number | null;
  confidence_next_month?: number | null;
  collab_health?: CollabHealth | null;
  verbatim?: string | null;
  improvement_one_thing?: string | null;
  keep_doing?: string | null;
  difficulties?: Difficulty[] | null;
  difficulties_other?: string | null;
  business_impact?: number | null;
  next_month_priority?: Priority | null;
  next_month_priority_other?: string | null;
}

interface Props {
  lang: Lang;
  clientCode: string;
  surveyId: string;
  satisfactionScore: number;    // Q1 déjà capturé via pulse-frontend "capture"
  prefill?: MonthlyPrefill;
  onDone: () => void;
}

const TOTAL_STEPS = 10;

// ─── Copies FR / EN ─────────────────────────────────────────────────────────
const COPY = {
  fr: {
    of: (n: number) => `${n} sur ${TOTAL_STEPS}`,
    back: "Retour",
    continue: "Continuer",
    skip: "Passer",
    submit: "Envoyer",
    submitting: "Envoi…",
    thanks_title: "Merci pour ton feedback",
    thanks_sub: "On l'a bien reçu — l'équipe TDIA regarde ça de près.",
    scale_low: "Pas du tout",
    scale_high: "Beaucoup",
    scale5_low: "Très peu",
    scale5_high: "Beaucoup",
    err_generic: "Impossible d'enregistrer — réessaie dans un instant.",
    err_required: "Cette question est obligatoire pour continuer.",
    q2: { title: "Sur 10, à quel point recommanderais-tu TDIA à un autre entrepreneur ?", note: "C'est le NPS — ta note pèse fort." },
    q3: { title: "Ton niveau de confiance pour le mois prochain ?", note: "Sur 5 — 1 = peu confiant, 5 = très confiant." },
    q4: { title: "À date, comment décrirais-tu l'état actuel de notre collaboration ?", note: "Choisis la formulation la plus juste." },
    q5: { title: "Quelle est la raison principale derrière ton score ?", note: "Prends 30 secondes — ça nous aide vraiment.", placeholder: "Ce qui explique ta note…" },
    q6: { title: "Si on devait améliorer UNE chose le mois prochain pour gagner +1 auprès de toi, ce serait quoi ?", note: "Une phrase suffit.", placeholder: "Une seule idée…" },
    q7: { title: "Qu'est-ce qu'on devrait absolument continuer à faire ?", note: "Ce qui marche bien pour toi — on veut le protéger.", placeholder: "Ce qu'on doit garder…" },
    q8: { title: "Si tu as vécu des difficultés ce mois-ci, elles étaient principalement liées à quoi ?", note: "Plusieurs réponses possibles — laisse vide si tout roule.", other_placeholder: "Précise…" },
    q9: { title: "Le mois dernier, nos actions ont-elles fait avancer ton business (ventes, leads, rentabilité, croissance) ?", note: "Sur 5 — évalue l'impact réel." },
    q10: { title: "Pour le mois prochain, quelle est ta priorité #1 avec TDIA ?", note: "Une seule — celle qui compte vraiment.", other_placeholder: "Précise ta priorité…" },
    collab: {
      very_healthy: "Très sain (aucune inquiétude)",
      good: "Bon (quelques ajustements nécessaires)",
      fragile: "Fragile (nécessite une action rapide)",
      at_risk: "À risque (préoccupations sérieuses)",
    } as Record<CollabHealth, string>,
    priority: {
      volume: "Augmenter le volume (plus de ventes / plus de leads)",
      profitability: "Améliorer la rentabilité (ROAS / CPA / marge)",
      test_angles: "Tester de nouveaux angles / messages / offres",
      creatives: "Produire plus (ou de meilleures) créas",
      foundation: "Améliorer les fondations (landing page, tracking, attribution, data)",
      stabilize: "Stabiliser et sécuriser la performance",
      other: "Autre",
    } as Record<Priority, string>,
    difficulty: {
      communication: "Communication et/ou réactivité",
      creative_quality: "Qualité créative",
      creative_volume: "Volume de créas livrées",
      strategy: "Stratégie (angles, messages, offres)",
      timelines: "Délais et rapidité d'exécution",
      reporting: "Reporting et clarté des résultats",
      brand_understanding: "Compréhension de la marque et des clients cibles",
      other: "Autre",
    } as Record<Difficulty, string>,
  },
  en: {
    of: (n: number) => `${n} of ${TOTAL_STEPS}`,
    back: "Back",
    continue: "Continue",
    skip: "Skip",
    submit: "Submit",
    submitting: "Sending…",
    thanks_title: "Thanks for your feedback",
    thanks_sub: "Got it — the TDIA team is looking at this closely.",
    scale_low: "Not at all",
    scale_high: "A lot",
    scale5_low: "Very little",
    scale5_high: "A lot",
    err_generic: "Couldn't save — try again in a moment.",
    err_required: "This question is required to continue.",
    q2: { title: "Out of 10, how likely are you to recommend TDIA to a fellow entrepreneur?", note: "This is the NPS — your rating carries weight." },
    q3: { title: "What is your level of confidence for next month?", note: "Out of 5 — 1 = low confidence, 5 = very confident." },
    q4: { title: "As of today, how would you describe the current state of our collaboration?", note: "Pick the most accurate wording." },
    q5: { title: "What is the main reason behind your score?", note: "Take 30 seconds — it really helps.", placeholder: "What explains your score…" },
    q6: { title: "If we had to improve ONE thing next month to earn a +1 from you, what would it be?", note: "One sentence is enough.", placeholder: "Just one idea…" },
    q7: { title: "What should we absolutely keep doing?", note: "What's working well for you — we want to protect it.", placeholder: "What we should keep…" },
    q8: { title: "If you experienced any difficulties this month, what were they mainly related to?", note: "Select multiple — leave empty if all's well.", other_placeholder: "Please specify…" },
    q9: { title: "Over the past month, to what extent did our actions help move your business goals forward (sales, leads, profitability, growth)?", note: "Out of 5 — rate the real impact." },
    q10: { title: "For next month, what is your #1 priority with TDIA?", note: "Just one — the one that really matters.", other_placeholder: "Specify your priority…" },
    collab: {
      very_healthy: "Very healthy (no concerns)",
      good: "Good (a few adjustments needed)",
      fragile: "Fragile (needs quick action)",
      at_risk: "At risk (serious concerns)",
    } as Record<CollabHealth, string>,
    priority: {
      volume: "Increase volume (more sales / more leads)",
      profitability: "Improve profitability (ROAS / CPA / margin)",
      test_angles: "Test new angles / messaging / offers",
      creatives: "Produce more (or better) creatives",
      foundation: "Improve the foundation (landing page, tracking, attribution, data)",
      stabilize: "Stabilize and secure performance",
      other: "Other",
    } as Record<Priority, string>,
    difficulty: {
      communication: "Communication and/or responsiveness",
      creative_quality: "Creative quality",
      creative_volume: "Volume of creatives delivered",
      strategy: "Strategy (angles, messaging, offers)",
      timelines: "Timelines and execution speed",
      reporting: "Reporting and clarity of results",
      brand_understanding: "Understanding of the brand and target customers",
      other: "Other",
    } as Record<Difficulty, string>,
  },
};

// Composant échelle 0-10 en 11 boutons compacts
function ScorePicker0to10({ value, onChange, disabled }: { value: number | null; onChange: (n: number) => void; disabled?: boolean; }) {
  return (
    <div className="grid grid-cols-6 gap-2">
      {Array.from({ length: 11 }, (_, n) => n).map((n) => {
        const selected = value === n;
        const tone = n <= 6
          ? "border-red-500/40 text-red-500 bg-red-500/10 hover:bg-red-500/20"
          : n <= 8
          ? "border-yellow-500/40 text-yellow-500 bg-yellow-500/10 hover:bg-yellow-500/20"
          : "border-emerald-500/40 text-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20";
        return (
          <button
            key={n}
            type="button"
            disabled={disabled}
            onClick={() => onChange(n)}
            className={`h-14 rounded-xl border-2 font-bold text-base transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${tone} ${selected ? "shadow-lg scale-[1.03] ring-2 ring-offset-1 ring-offset-background" : "hover:scale-[1.02]"}`}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}

// Composant échelle 1-5
function ScorePicker1to5({ value, onChange, disabled }: { value: number | null; onChange: (n: number) => void; disabled?: boolean; }) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {[1, 2, 3, 4, 5].map((n) => {
        const selected = value === n;
        const tone = n <= 2
          ? "border-red-500/40 text-red-500 bg-red-500/10 hover:bg-red-500/20"
          : n === 3
          ? "border-yellow-500/40 text-yellow-500 bg-yellow-500/10 hover:bg-yellow-500/20"
          : "border-emerald-500/40 text-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20";
        return (
          <button
            key={n}
            type="button"
            disabled={disabled}
            onClick={() => onChange(n)}
            className={`h-16 rounded-xl border-2 font-bold text-lg transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${tone} ${selected ? "shadow-lg scale-[1.03] ring-2 ring-offset-1 ring-offset-background" : "hover:scale-[1.02]"}`}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}

// Composant boutons radio verticaux
function RadioButtons<T extends string>({
  options,
  value,
  onChange,
  disabled,
  getLabel,
}: {
  options: T[];
  value: T | null;
  onChange: (v: T) => void;
  disabled?: boolean;
  getLabel: (v: T) => string;
}) {
  return (
    <div className="space-y-2">
      {options.map((opt) => {
        const selected = value === opt;
        return (
          <button
            key={opt}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt)}
            className={`w-full text-left rounded-lg border-2 px-4 py-3 text-sm transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              selected
                ? "border-primary bg-primary/10 text-foreground font-medium"
                : "border-border/60 bg-background/40 text-foreground/80 hover:border-border hover:bg-background/60"
            }`}
          >
            <span className="inline-flex items-center gap-2">
              <span className={`inline-block h-4 w-4 rounded-full border-2 ${selected ? "border-primary bg-primary" : "border-muted-foreground"}`}>
                {selected && <span className="block h-2 w-2 rounded-full bg-white m-0.5" />}
              </span>
              {getLabel(opt)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

const COLLAB_OPTIONS: CollabHealth[] = ["very_healthy", "good", "fragile", "at_risk"];
const PRIORITY_OPTIONS: Priority[] = ["volume", "profitability", "test_angles", "creatives", "foundation", "stabilize", "other"];
const DIFFICULTY_OPTIONS: Difficulty[] = ["communication", "creative_quality", "creative_volume", "strategy", "timelines", "reporting", "brand_understanding", "other"];

export function MonthlyPulseForm({ lang, clientCode, surveyId, satisfactionScore, prefill, onDone }: Props) {
  const t = COPY[lang];

  // Déterminer l'étape de reprise : premier champ obligatoire vide
  const initialStep = useMemo(() => {
    if (prefill?.nps_score == null) return 1;                    // Q2
    if (prefill?.confidence_next_month == null) return 2;        // Q3
    if (!prefill?.collab_health) return 3;                       // Q4
    // Q5-Q7 sont optionnels — on ne saute pas si vides, on montre dans l'ordre
    if (!prefill?.verbatim) return 4;                            // Q5
    if (!prefill?.improvement_one_thing) return 5;               // Q6
    if (!prefill?.keep_doing) return 6;                          // Q7
    if (prefill?.difficulties == null) return 7;                 // Q8 (skip = null)
    if (prefill?.business_impact == null) return 8;              // Q9
    if (!prefill?.next_month_priority) return 9;                 // Q10
    return 10;
  }, [prefill]);

  const [step, setStep] = useState<number>(initialStep);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [nps, setNps] = useState<number | null>(prefill?.nps_score ?? null);
  const [confidence, setConfidence] = useState<number | null>(prefill?.confidence_next_month ?? null);
  const [collab, setCollab] = useState<CollabHealth | null>(prefill?.collab_health ?? null);
  const [reason, setReason] = useState<string>(prefill?.verbatim ?? "");
  const [improvement, setImprovement] = useState<string>(prefill?.improvement_one_thing ?? "");
  const [keep, setKeep] = useState<string>(prefill?.keep_doing ?? "");
  const [difficulties, setDifficulties] = useState<Difficulty[]>(prefill?.difficulties ?? []);
  const [diffOther, setDiffOther] = useState<string>(prefill?.difficulties_other ?? "");
  const [impact, setImpact] = useState<number | null>(prefill?.business_impact ?? null);
  const [priority, setPriority] = useState<Priority | null>(prefill?.next_month_priority ?? null);
  const [priorityOther, setPriorityOther] = useState<string>(prefill?.next_month_priority_other ?? "");

  // Appel unifié — chaque "next" persiste le patch et avance
  const save = async (patch: Record<string, unknown>, finalize = false): Promise<boolean> => {
    setSaving(true);
    setError(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("pulse-frontend", {
        body: { action: "monthly_answers", client_code: clientCode, survey_id: surveyId, ...patch, finalize },
      });
      if (fnErr || !(data as any)?.ok) {
        setError(t.err_generic);
        return false;
      }
      return true;
    } catch (e) {
      console.error("[monthly-form] save failed", e);
      setError(t.err_generic);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const toggleDifficulty = (d: Difficulty) => {
    setDifficulties((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  };

  const goBack = () => setStep((s) => Math.max(1, s - 1));

  const advance = () => setStep((s) => s + 1);

  const progressPct = (step / TOTAL_STEPS) * 100;

  const showQuestion = (n: number, title: string, note: string, body: ReactNode, opts?: { canSkip?: boolean; onNext?: () => void | Promise<void>; nextDisabled?: boolean; }) => (
    <>
      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.18em] font-bold">
        <span className="text-primary">Pulse mensuel</span>
        <span className="text-muted-foreground">{t.of(n + 1)}</span>
      </div>
      <Progress value={progressPct} className="h-1" />
      <div className="space-y-1 pt-1">
        <h1 className="text-lg font-bold text-foreground tracking-tight leading-snug">{title}</h1>
        <p className="text-xs text-muted-foreground">{note}</p>
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div>{body}</div>
      <div className="flex items-center justify-between gap-2 pt-2">
        <Button variant="ghost" size="sm" onClick={goBack} disabled={saving || n === 0} className="text-muted-foreground">
          <ArrowLeft className="h-4 w-4 mr-1" /> {t.back}
        </Button>
        <div className="flex gap-2">
          {opts?.canSkip && (
            <Button variant="ghost" size="sm" onClick={opts.onNext} disabled={saving} className="text-muted-foreground">
              {t.skip}
            </Button>
          )}
          <Button onClick={opts?.onNext} disabled={saving || opts?.nextDisabled}>
            {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> {t.submitting}</> : (<>{t.continue} <ArrowRight className="h-4 w-4 ml-1" /></>)}
          </Button>
        </div>
      </div>
    </>
  );

  // ─── ÉTAPES ────────────────────────────────────────────────────────────────
  if (step === 1) {
    return <div className="space-y-4">{showQuestion(0, t.q2.title, t.q2.note, (
      <div className="space-y-2">
        <ScorePicker0to10 value={nps} onChange={setNps} disabled={saving} />
        <div className="flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground px-1">
          <span>0 = {t.scale_low.toLowerCase()}</span>
          <span>10 = {t.scale_high.toLowerCase()}</span>
        </div>
      </div>
    ), {
      nextDisabled: nps == null,
      onNext: async () => { if (nps == null) return setError(t.err_required); if (await save({ nps_score: nps })) advance(); },
    })}</div>;
  }

  if (step === 2) {
    return <div className="space-y-4">{showQuestion(1, t.q3.title, t.q3.note, (
      <div className="space-y-2">
        <ScorePicker1to5 value={confidence} onChange={setConfidence} disabled={saving} />
        <div className="flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground px-1">
          <span>1 = {t.scale_low.toLowerCase()}</span>
          <span>5 = {t.scale_high.toLowerCase()}</span>
        </div>
      </div>
    ), {
      nextDisabled: confidence == null,
      onNext: async () => { if (confidence == null) return setError(t.err_required); if (await save({ confidence_next_month: confidence })) advance(); },
    })}</div>;
  }

  if (step === 3) {
    return <div className="space-y-4">{showQuestion(2, t.q4.title, t.q4.note, (
      <RadioButtons options={COLLAB_OPTIONS} value={collab} onChange={setCollab} disabled={saving} getLabel={(o) => t.collab[o]} />
    ), {
      nextDisabled: !collab,
      onNext: async () => { if (!collab) return setError(t.err_required); if (await save({ collab_health: collab })) advance(); },
    })}</div>;
  }

  if (step === 4) {
    return <div className="space-y-4">{showQuestion(3, t.q5.title, t.q5.note, (
      <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={4} maxLength={2000} placeholder={t.q5.placeholder} className="resize-none" />
    ), {
      canSkip: true,
      onNext: async () => { if (await save({ verbatim: reason })) advance(); },
    })}</div>;
  }

  if (step === 5) {
    return <div className="space-y-4">{showQuestion(4, t.q6.title, t.q6.note, (
      <Textarea value={improvement} onChange={(e) => setImprovement(e.target.value)} rows={2} maxLength={500} placeholder={t.q6.placeholder} className="resize-none" />
    ), {
      canSkip: true,
      onNext: async () => { if (await save({ improvement_one_thing: improvement })) advance(); },
    })}</div>;
  }

  if (step === 6) {
    return <div className="space-y-4">{showQuestion(5, t.q7.title, t.q7.note, (
      <Textarea value={keep} onChange={(e) => setKeep(e.target.value)} rows={4} maxLength={1000} placeholder={t.q7.placeholder} className="resize-none" />
    ), {
      canSkip: true,
      onNext: async () => { if (await save({ keep_doing: keep })) advance(); },
    })}</div>;
  }

  if (step === 7) {
    const hasOther = difficulties.includes("other");
    return <div className="space-y-4">{showQuestion(6, t.q8.title, t.q8.note, (
      <div className="space-y-2">
        {DIFFICULTY_OPTIONS.map((d) => {
          const checked = difficulties.includes(d);
          return (
            <label key={d} className={`flex items-center gap-3 rounded-lg border-2 px-3 py-2.5 cursor-pointer text-sm transition-all ${checked ? "border-primary bg-primary/10" : "border-border/60 bg-background/40 hover:border-border"}`}>
              <Checkbox checked={checked} onCheckedChange={() => toggleDifficulty(d)} disabled={saving} />
              <span className="text-foreground/90">{t.difficulty[d]}</span>
            </label>
          );
        })}
        {hasOther && (
          <Input value={diffOther} onChange={(e) => setDiffOther(e.target.value)} placeholder={t.q8.other_placeholder} maxLength={500} className="mt-2" />
        )}
      </div>
    ), {
      canSkip: true,
      onNext: async () => {
        const payload: Record<string, unknown> = { difficulties };
        if (hasOther) payload.difficulties_other = diffOther;
        else payload.difficulties_other = null;
        if (await save(payload)) advance();
      },
    })}</div>;
  }

  if (step === 8) {
    return <div className="space-y-4">{showQuestion(7, t.q9.title, t.q9.note, (
      <div className="space-y-2">
        <ScorePicker1to5 value={impact} onChange={setImpact} disabled={saving} />
        <div className="flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground px-1">
          <span>1 = {t.scale5_low.toLowerCase()}</span>
          <span>5 = {t.scale5_high.toLowerCase()}</span>
        </div>
      </div>
    ), {
      nextDisabled: impact == null,
      onNext: async () => { if (impact == null) return setError(t.err_required); if (await save({ business_impact: impact })) advance(); },
    })}</div>;
  }

  if (step === 9) {
    const isOther = priority === "other";
    return <div className="space-y-4">{showQuestion(8, t.q10.title, t.q10.note, (
      <div className="space-y-2">
        <RadioButtons options={PRIORITY_OPTIONS} value={priority} onChange={setPriority} disabled={saving} getLabel={(o) => t.priority[o]} />
        {isOther && (
          <Input value={priorityOther} onChange={(e) => setPriorityOther(e.target.value)} placeholder={t.q10.other_placeholder} maxLength={500} className="mt-2" />
        )}
      </div>
    ), {
      nextDisabled: !priority || (isOther && !priorityOther.trim()),
      onNext: async () => {
        if (!priority) return setError(t.err_required);
        if (isOther && !priorityOther.trim()) return setError(t.err_required);
        const payload: Record<string, unknown> = { next_month_priority: priority };
        payload.next_month_priority_other = isOther ? priorityOther : null;
        if (await save(payload, true)) {
          toast.success(lang === "en" ? "Feedback received. Thanks!" : "Feedback reçu. Merci !");
          onDone();
        }
      },
    })}</div>;
  }

  // step === 10 → écran de confirmation (au cas où on arrive ici sans finalize)
  return (
    <div className="text-center space-y-3 py-4">
      <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
        <CheckCircle2 className="h-8 w-8" />
      </div>
      <h1 className="text-xl font-bold text-foreground tracking-tight">{t.thanks_title}</h1>
      <p className="text-sm text-muted-foreground max-w-xs mx-auto">{t.thanks_sub}</p>
      <Button size="sm" onClick={onDone} className="mt-2">
        <Send className="h-4 w-4 mr-2" /> OK
      </Button>
    </div>
  );
}
