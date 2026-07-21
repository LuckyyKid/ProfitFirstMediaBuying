import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Check, SkipForward } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { WEBHOOK_URLS, type Question, type FormKey } from "@/data/quizQuestions";
import { cn } from "@/lib/utils";

interface QuizSlideshowProps {
  questions: Question[];
  formKey: FormKey;
  clientCode: string | null;
  email?: string | null;
  brandName?: string | null;
  clientInfo?: Record<string, any> | null;
  onComplete: () => void;
}

type CompositeValue = Record<string, string>;
type AnswerValue = string | string[] | CompositeValue;

export const QuizSlideshow = ({
  questions,
  formKey,
  clientCode,
  email,
  brandName,
  clientInfo,
  onComplete,
}: QuizSlideshowProps) => {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [otherValues, setOtherValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const current = questions[index];
  const isLast = index === questions.length - 1;
  const value = answers[current.id];
  const progress = ((index + 1) / questions.length) * 100;

  const isAnswered = useMemo(() => {
    if (current.type === "multi_choice") {
      return Array.isArray(value) && value.length > 0;
    }
    if (current.type === "single_choice") {
      return typeof value === "string" && value.length > 0;
    }
    if (current.type === "scale") {
      return typeof value === "string" && value.length > 0;
    }
    if (current.type === "composite") {
      if (!value || typeof value !== "object" || Array.isArray(value)) return false;
      // At least one sub-field filled
      return Object.values(value as CompositeValue).some((v) => (v ?? "").trim().length > 0);
    }
    return typeof value === "string" && value.trim().length > 0;
  }, [value, current.type]);

  const canProceed = isAnswered || !!current.optional;

  const setAnswer = (val: AnswerValue) => {
    setAnswers((a) => ({ ...a, [current.id]: val }));
  };

  const setCompositeField = (key: string, val: string) => {
    const existing = (typeof value === "object" && !Array.isArray(value) ? (value as CompositeValue) : {}) ?? {};
    setAnswer({ ...existing, [key]: val });
  };

  const toggleMulti = (option: string) => {
    const arr = Array.isArray(value) ? [...value] : [];
    const i = arr.indexOf(option);
    if (i >= 0) arr.splice(i, 1);
    else arr.push(option);
    setAnswer(arr);
  };

  const next = () => {
    if (!canProceed) {
      toast.error("Veuillez répondre avant de continuer");
      return;
    }
    setDirection(1);
    setIndex((i) => Math.min(i + 1, questions.length - 1));
  };

  const skip = () => {
    setDirection(1);
    setIndex((i) => Math.min(i + 1, questions.length - 1));
  };

  const prev = () => {
    setDirection(-1);
    setIndex((i) => Math.max(i - 1, 0));
  };

  const serializeAnswer = (q: Question): string => {
    const v = answers[q.id];
    const other = otherValues[q.id]?.trim();
    if (Array.isArray(v)) {
      const list = [...v];
      if (other) list.push(`Other: ${other}`);
      return list.join(", ");
    }
    if (v && typeof v === "object") {
      const obj = v as CompositeValue;
      const parts = (q.fields ?? []).map((f) => {
        const val = (obj[f.key] ?? "").trim();
        return val ? `${f.label}: ${val}` : null;
      }).filter(Boolean) as string[];
      return parts.join(" | ");
    }
    if (typeof v === "string") {
      if (v === "__other__" && other) return `Other: ${other}`;
      return v;
    }
    return "";
  };


  const handleSubmit = async () => {
    if (!canProceed) {
      toast.error("Veuillez répondre à la dernière question");
      return;
    }
    setSubmitting(true);
    try {
      const flatAnswers: Record<string, string> = {};
      questions.forEach((q) => {
        flatAnswers[q.id] = serializeAnswer(q);
      });

      const payload = {
        form: formKey,
        client_code: clientCode,
        email,
        brand_name: brandName,
        submitted_at: new Date().toISOString(),
        client: clientInfo?.client ?? null,
        lead: clientInfo?.lead ?? null,
        caller_name: clientInfo?.caller_name ?? null,
        answers: questions.map((q) => ({
          id: q.id,
          question: q.label,
          answer: serializeAnswer(q),
        })),
        ...flatAnswers,
      };

      await fetch(WEBHOOK_URLS[formKey], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).catch((err) => console.error("Webhook error:", err));

      if (clientCode) {
        const { error } = await supabase.functions.invoke("mark-form-submitted", {
          body: {
            client_code: clientCode,
            form: formKey,
            answers: questions.map((q) => ({
              id: q.id,
              question: q.label,
              answer: serializeAnswer(q),
            })),
          },
        });
        if (error) console.error("mark-form-submitted error:", error);
      }

      toast.success("Réponses enregistrées !");
      onComplete();
    } catch (e) {
      console.error(e);
      toast.error("Une erreur est survenue. Réessayez.");
    } finally {
      setSubmitting(false);
    }
  };

  const variants = {
    enter: (dir: number) => ({ x: dir > 0 ? 80 : -80, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -80 : 80, opacity: 0 }),
  };

  const renderInput = () => {
    const inputClass =
      "text-base md:text-lg h-14 rounded-2xl border-2 border-border/60 bg-background/40 backdrop-blur-sm px-5 shadow-sm transition-all duration-200 focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/20 focus-visible:ring-offset-0 placeholder:text-muted-foreground/60";

    switch (current.type) {
      case "long":
        return (
          <Textarea
            value={(value as string) ?? ""}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder={current.placeholder ?? "Votre réponse..."}
            rows={5}
            className="text-base md:text-lg leading-relaxed rounded-2xl border-2 border-border/60 bg-background/40 backdrop-blur-sm px-5 py-4 shadow-sm transition-all duration-200 focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/20 focus-visible:ring-offset-0 placeholder:text-muted-foreground/60 resize-none"
            autoFocus
          />
        );

      case "single_choice": {
        const sel = (value as string) ?? "";
        return (
          <div className="space-y-2.5">
            {current.options?.map((opt) => {
              const active = sel === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setAnswer(opt)}
                  className={cn(
                    "w-full text-left px-5 py-4 rounded-2xl border-2 transition-all duration-200 flex items-center gap-3",
                    active
                      ? "border-primary bg-primary/10 shadow-sm"
                      : "border-border/60 bg-background/40 hover:border-primary/50 hover:bg-background/60"
                  )}
                >
                  <span
                    className={cn(
                      "h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
                      active ? "border-primary bg-primary" : "border-border"
                    )}
                  >
                    {active && <span className="h-2 w-2 rounded-full bg-primary-foreground" />}
                  </span>
                  <span className="text-base md:text-lg text-foreground">{opt}</span>
                </button>
              );
            })}
            {current.allowOther && (
              <OtherRow
                active={sel === "__other__"}
                onSelect={() => setAnswer("__other__")}
                value={otherValues[current.id] ?? ""}
                onChange={(v) =>
                  setOtherValues((o) => ({ ...o, [current.id]: v }))
                }
              />
            )}
          </div>
        );
      }

      case "multi_choice": {
        const sel = Array.isArray(value) ? value : [];
        return (
          <div className="space-y-2.5">
            {current.options?.map((opt) => {
              const active = sel.includes(opt);
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => toggleMulti(opt)}
                  className={cn(
                    "w-full text-left px-5 py-4 rounded-2xl border-2 transition-all duration-200 flex items-center gap-3",
                    active
                      ? "border-primary bg-primary/10 shadow-sm"
                      : "border-border/60 bg-background/40 hover:border-primary/50 hover:bg-background/60"
                  )}
                >
                  <span
                    className={cn(
                      "h-5 w-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all",
                      active ? "border-primary bg-primary" : "border-border"
                    )}
                  >
                    {active && <Check className="h-3.5 w-3.5 text-primary-foreground" strokeWidth={3} />}
                  </span>
                  <span className="text-base md:text-lg text-foreground">{opt}</span>
                </button>
              );
            })}
            {current.allowOther && (
              <div
                className={cn(
                  "rounded-2xl border-2 transition-all px-5 py-4 space-y-3",
                  otherValues[current.id]
                    ? "border-primary bg-primary/10"
                    : "border-border/60 bg-background/40"
                )}
              >
                <label className="flex items-center gap-3 cursor-text text-base md:text-lg text-foreground">
                  <span className="h-5 w-5 rounded-md border-2 border-border flex items-center justify-center shrink-0">
                    {!!otherValues[current.id] && (
                      <Check className="h-3.5 w-3.5 text-primary" strokeWidth={3} />
                    )}
                  </span>
                  Autre :
                </label>
                <Input
                  value={otherValues[current.id] ?? ""}
                  onChange={(e) =>
                    setOtherValues((o) => ({ ...o, [current.id]: e.target.value }))
                  }
                  placeholder="Précisez..."
                  className="bg-background/60"
                />
              </div>
            )}
          </div>
        );
      }

      case "scale": {
        const min = current.scaleMin ?? 1;
        const max = current.scaleMax ?? 5;
        const sel = (value as string) ?? "";
        const ticks = Array.from({ length: max - min + 1 }, (_, i) => min + i);
        return (
          <div className="space-y-5 px-2">
            <div className="flex items-center justify-between gap-4 text-sm md:text-base text-muted-foreground">
              <span className="text-right max-w-[35%]">{current.scaleMinLabel}</span>
              <span className="text-left max-w-[35%] text-right">{current.scaleMaxLabel}</span>
            </div>
            <div className="flex items-center justify-between gap-2 md:gap-4">
              {ticks.map((n) => {
                const active = sel === String(n);
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setAnswer(String(n))}
                    className={cn(
                      "flex-1 h-16 md:h-20 rounded-2xl border-2 text-xl md:text-2xl font-bold transition-all duration-200",
                      active
                        ? "border-primary bg-primary text-primary-foreground shadow-md scale-105"
                        : "border-border/60 bg-background/40 text-foreground hover:border-primary/50"
                    )}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          </div>
        );
      }

      case "composite": {
        const obj = (typeof value === "object" && !Array.isArray(value) ? (value as CompositeValue) : {}) ?? {};
        return (
          <div className="space-y-3">
            {(current.fields ?? []).map((f) => (
              <div key={f.key} className="space-y-1.5">
                <label className="text-sm font-medium text-foreground/80 px-1">{f.label}</label>
                {f.type === "long" ? (
                  <Textarea
                    value={obj[f.key] ?? ""}
                    onChange={(e) => setCompositeField(f.key, e.target.value)}
                    placeholder={f.placeholder ?? ""}
                    rows={3}
                    className="text-base rounded-2xl border-2 border-border/60 bg-background/40 backdrop-blur-sm px-4 py-3"
                  />
                ) : (
                  <Input
                    type={f.type === "url" ? "url" : "text"}
                    value={obj[f.key] ?? ""}
                    onChange={(e) => setCompositeField(f.key, e.target.value)}
                    placeholder={f.placeholder ?? ""}
                    className="text-base h-12 rounded-2xl border-2 border-border/60 bg-background/40 backdrop-blur-sm px-4"
                  />
                )}
              </div>
            ))}
          </div>
        );
      }

      case "url":
      case "short":
      default:
        return (
          <Input
            type={current.type === "url" ? "url" : "text"}
            value={(value as string) ?? ""}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder={current.placeholder ?? "Votre réponse..."}
            className={inputClass}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                isLast ? handleSubmit() : next();
              }
            }}
          />
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-foreground/70">
          <span>Question {index + 1} / {questions.length}</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <motion.div
            className="h-full bg-primary"
            initial={false}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
        </div>
      </div>

      <div className="relative min-h-[320px] overflow-hidden">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={current.id}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.35, ease: "easeInOut" }}
            className="space-y-5"
          >
            <h3 className="text-2xl md:text-3xl font-bold text-foreground leading-tight">
              {current.label}
              {current.optional && (
                <span className="ml-2 text-xs font-normal uppercase tracking-wider text-muted-foreground align-middle">
                  (optionnel)
                </span>
              )}
            </h3>
            {current.hint && (
              <p className="text-sm text-muted-foreground italic">{current.hint}</p>
            )}
            {renderInput()}
          </motion.div>
        </AnimatePresence>
      </div>


      <div className="flex flex-col sm:flex-row gap-3 justify-between items-center pt-2">
        <Button
          variant="outline"
          size="lg"
          onClick={prev}
          disabled={index === 0 || submitting}
          className="w-full sm:w-auto"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Précédent
        </Button>

        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          {current.optional && !isAnswered && !isLast && (
            <Button
              variant="ghost"
              size="lg"
              onClick={skip}
              disabled={submitting}
              className="w-full sm:w-auto text-muted-foreground"
            >
              <SkipForward className="mr-2 h-4 w-4" />
              Passer
            </Button>
          )}
          {isLast ? (
            <Button
              variant="hero"
              size="lg"
              onClick={handleSubmit}
              disabled={submitting || !canProceed}
              className="w-full sm:w-auto"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Envoi...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Envoyer mes réponses
                </>
              )}
            </Button>
          ) : (
            <Button
              variant="hero"
              size="lg"
              onClick={next}
              disabled={!canProceed}
              className="w-full sm:w-auto"
            >
              Suivant
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

    </div>
  );
};

const OtherRow = ({
  active,
  onSelect,
  value,
  onChange,
}: {
  active: boolean;
  onSelect: () => void;
  value: string;
  onChange: (v: string) => void;
}) => (
  <div
    className={cn(
      "rounded-2xl border-2 transition-all px-5 py-4 space-y-3",
      active ? "border-primary bg-primary/10" : "border-border/60 bg-background/40"
    )}
  >
    <button
      type="button"
      onClick={onSelect}
      className="flex items-center gap-3 text-base md:text-lg text-foreground"
    >
      <span
        className={cn(
          "h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0",
          active ? "border-primary bg-primary" : "border-border"
        )}
      >
        {active && <span className="h-2 w-2 rounded-full bg-primary-foreground" />}
      </span>
      Autre :
    </button>
    <Input
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
        if (!active) onSelect();
      }}
      placeholder="Précisez..."
      className="bg-background/60"
    />
  </div>
);
