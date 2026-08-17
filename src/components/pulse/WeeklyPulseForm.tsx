import { useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

type Lang = "fr" | "en";

export interface WeeklyPrefill {
  weekly_pace_score?: number | null;
  verbatim?: string | null;
  weekly_blocker?: string | null;
  weekly_next_priority?: string | null;
}

interface Props {
  lang: Lang;
  clientCode: string;
  surveyId: string;
  prefill?: WeeklyPrefill;
  onDone: () => void;
}

const TOTAL_STEPS = 4;

const COPY = {
  fr: {
    tag: "Pulse hebdo",
    of: (n: number) => `${n} sur ${TOTAL_STEPS}`,
    back: "Retour",
    continue: "Continuer",
    skip: "Passer",
    submit: "Envoyer",
    submitting: "Envoi…",
    thanks_title: "Merci pour ton feedback",
    thanks_sub: "On l'a bien reçu — on prépare le meeting avec ça en tête.",
    scale_low: "Pas du tout",
    scale_high: "Complètement",
    err_generic: "Impossible d'enregistrer — réessaie dans un instant.",
    err_required: "Cette question est obligatoire pour continuer.",
    q1: {
      title: "Cette semaine, à quel point les choses ont avancé rapidement et clairement ?",
      note: "Sur 5 — 1 = pas du tout, 5 = complètement.",
    },
    q2: {
      title: "En une phrase, pourquoi cette note ?",
      note: "Ce qui explique ton ressenti.",
      placeholder: "Ce qui explique ta note…",
    },
    q3: {
      title: "Un blocker ou une inquiétude qu'on doit adresser tout de suite ?",
      note: "Si oui, explique. Sinon passe.",
      placeholder: "Décris le blocker (ou passe)…",
    },
    q4: {
      title: "Pour la semaine prochaine, c'est quoi ta priorité #1 ?",
      note: "Une seule — la chose qui compte le plus.",
      placeholder: "Ta priorité #1…",
    },
  },
  en: {
    tag: "Weekly pulse",
    of: (n: number) => `${n} of ${TOTAL_STEPS}`,
    back: "Back",
    continue: "Continue",
    skip: "Skip",
    submit: "Submit",
    submitting: "Sending…",
    thanks_title: "Thanks for your feedback",
    thanks_sub: "Got it — we'll prep the meeting with this in mind.",
    scale_low: "Not at all",
    scale_high: "Completely",
    err_generic: "Couldn't save — try again in a moment.",
    err_required: "This question is required to continue.",
    q1: {
      title: "This week, to what extent did things move forward quickly and clearly?",
      note: "Out of 5 — 1 = not at all, 5 = completely.",
    },
    q2: {
      title: "In one sentence, why did you give that score?",
      note: "What explains how you feel.",
      placeholder: "What explains your score…",
    },
    q3: {
      title: "Any blocker or concern we need to address right now?",
      note: "If yes, please explain. Otherwise skip.",
      placeholder: "Describe the blocker (or skip)…",
    },
    q4: {
      title: "For next week, what is your #1 priority?",
      note: "Just one — the thing that matters most.",
      placeholder: "Your #1 priority…",
    },
  },
};

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

export function WeeklyPulseForm({ lang, clientCode, surveyId, prefill, onDone }: Props) {
  const t = COPY[lang];

  const initialStep = useMemo(() => {
    if (prefill?.weekly_pace_score == null) return 1;
    if (!prefill?.verbatim) return 2;
    // Q3 (blocker) est optionnel — on n'auto-skip pas, on continue à Q4 si Q3 a été passée
    if (prefill?.weekly_blocker === undefined) return 3;
    if (!prefill?.weekly_next_priority) return 4;
    return 4;
  }, [prefill]);

  const [step, setStep] = useState<number>(initialStep);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pace, setPace] = useState<number | null>(prefill?.weekly_pace_score ?? null);
  const [reason, setReason] = useState<string>(prefill?.verbatim ?? "");
  const [blocker, setBlocker] = useState<string>(prefill?.weekly_blocker ?? "");
  const [nextPrio, setNextPrio] = useState<string>(prefill?.weekly_next_priority ?? "");

  const save = async (patch: Record<string, unknown>, finalize = false): Promise<boolean> => {
    setSaving(true);
    setError(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("pulse-frontend", {
        body: { action: "weekly_answers", client_code: clientCode, survey_id: surveyId, ...patch, finalize },
      });
      if (fnErr || !(data as { ok?: boolean } | null)?.ok) {
        setError(t.err_generic);
        return false;
      }
      return true;
    } catch (e) {
      console.error("[weekly-form] save failed", e);
      setError(t.err_generic);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const goBack = () => setStep((s) => Math.max(1, s - 1));
  const advance = () => setStep((s) => s + 1);
  const progressPct = (step / TOTAL_STEPS) * 100;

  const shell = (n: number, title: string, note: string, body: ReactNode, opts: { canSkip?: boolean; onNext: () => void | Promise<void>; nextDisabled?: boolean; }) => (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.18em] font-bold">
        <span className="text-primary">{t.tag}</span>
        <span className="text-muted-foreground">{t.of(n)}</span>
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
        <Button variant="ghost" size="sm" onClick={goBack} disabled={saving || n === 1} className="text-muted-foreground">
          <ArrowLeft className="h-4 w-4 mr-1" /> {t.back}
        </Button>
        <div className="flex gap-2">
          {opts.canSkip && (
            <Button variant="ghost" size="sm" onClick={opts.onNext} disabled={saving} className="text-muted-foreground">
              {t.skip}
            </Button>
          )}
          <Button onClick={opts.onNext} disabled={saving || opts.nextDisabled}>
            {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> {t.submitting}</> : (n === TOTAL_STEPS ? <><Send className="h-4 w-4 mr-2" /> {t.submit}</> : <>{t.continue} <ArrowRight className="h-4 w-4 ml-1" /></>)}
          </Button>
        </div>
      </div>
    </div>
  );

  if (step === 1) {
    return shell(1, t.q1.title, t.q1.note, (
      <div className="space-y-2">
        <ScorePicker1to5 value={pace} onChange={setPace} disabled={saving} />
        <div className="flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground px-1">
          <span>1 = {t.scale_low.toLowerCase()}</span>
          <span>5 = {t.scale_high.toLowerCase()}</span>
        </div>
      </div>
    ), {
      nextDisabled: pace == null,
      onNext: async () => {
        if (pace == null) return setError(t.err_required);
        if (await save({ weekly_pace_score: pace })) advance();
      },
    });
  }

  if (step === 2) {
    return shell(2, t.q2.title, t.q2.note, (
      <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={1000} placeholder={t.q2.placeholder} className="resize-none" />
    ), {
      nextDisabled: !reason.trim(),
      onNext: async () => {
        if (!reason.trim()) return setError(t.err_required);
        if (await save({ verbatim: reason.trim() })) advance();
      },
    });
  }

  if (step === 3) {
    return shell(3, t.q3.title, t.q3.note, (
      <Textarea value={blocker} onChange={(e) => setBlocker(e.target.value)} rows={5} maxLength={2000} placeholder={t.q3.placeholder} className="resize-none" />
    ), {
      canSkip: true,
      onNext: async () => { if (await save({ weekly_blocker: blocker })) advance(); },
    });
  }

  if (step === 4) {
    return shell(4, t.q4.title, t.q4.note, (
      <Textarea value={nextPrio} onChange={(e) => setNextPrio(e.target.value)} rows={2} maxLength={500} placeholder={t.q4.placeholder} className="resize-none" />
    ), {
      nextDisabled: !nextPrio.trim(),
      onNext: async () => {
        if (!nextPrio.trim()) return setError(t.err_required);
        if (await save({ weekly_next_priority: nextPrio.trim() }, true)) {
          toast.success(lang === "en" ? "Feedback received. Thanks!" : "Feedback reçu. Merci !");
          onDone();
        }
      },
    });
  }

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
