import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  WEBHOOK_URLS,
  type Question,
  type QuizBlock,
} from "@/data/quizQuestions";
import { cn } from "@/lib/utils";

interface QuizBlocksProps {
  questions: Question[];
  blocks: QuizBlock[];
  formKey: "welcome" | "founder_scan";
  clientCode: string | null;
  email?: string | null;
  brandName?: string | null;
  clientInfo?: Record<string, any> | null;
  onComplete: () => void;
}

type AnswerValue = string | string[];

export const QuizBlocks = ({
  questions,
  blocks,
  formKey,
  clientCode,
  email,
  brandName,
  clientInfo,
  onComplete,
}: QuizBlocksProps) => {
  const [blockIndex, setBlockIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [otherValues, setOtherValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const questionsById = useMemo(() => {
    const map: Record<string, Question> = {};
    questions.forEach((q) => (map[q.id] = q));
    return map;
  }, [questions]);

  const currentBlock = blocks[blockIndex];
  const currentQuestions = currentBlock.questionIds
    .map((id) => questionsById[id])
    .filter(Boolean);
  const isLastBlock = blockIndex === blocks.length - 1;
  const progress = ((blockIndex + 1) / blocks.length) * 100;

  const setAnswer = (id: string, val: AnswerValue) => {
    setAnswers((a) => ({ ...a, [id]: val }));
  };

  const toggleMulti = (id: string, option: string) => {
    const cur = answers[id];
    const arr = Array.isArray(cur) ? [...cur] : [];
    const i = arr.indexOf(option);
    if (i >= 0) arr.splice(i, 1);
    else arr.push(option);
    setAnswer(id, arr);
  };

  const isQuestionAnswered = (q: Question): boolean => {
    const v = answers[q.id];
    if (q.type === "multi_choice") return Array.isArray(v) && v.length > 0;
    if (q.type === "single_choice" || q.type === "scale")
      return typeof v === "string" && v.length > 0;
    return typeof v === "string" && v.trim().length > 0;
  };

  const blockComplete = currentQuestions.every(isQuestionAnswered);

  const next = () => {
    if (!blockComplete) {
      toast.error("Veuillez répondre à toutes les questions de ce bloc");
      return;
    }
    setDirection(1);
    setBlockIndex((i) => Math.min(i + 1, blocks.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const prev = () => {
    setDirection(-1);
    setBlockIndex((i) => Math.max(i - 1, 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const serializeAnswer = (q: Question): string => {
    const v = answers[q.id];
    const other = otherValues[q.id]?.trim();
    if (Array.isArray(v)) {
      const list = [...v];
      if (other) list.push(`Other: ${other}`);
      return list.join(", ");
    }
    if (typeof v === "string") {
      if (v === "__other__" && other) return `Other: ${other}`;
      return v;
    }
    return "";
  };

  const handleSubmit = async () => {
    if (!blockComplete) {
      toast.error("Veuillez compléter le dernier bloc");
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
        const { error } = await supabase.functions.invoke(
          "mark-form-submitted",
          {
            body: {
              client_code: clientCode,
              form: formKey,
              answers: questions.map((q) => ({
                id: q.id,
                question: q.label,
                answer: serializeAnswer(q),
              })),
            },
          },
        );
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
    enter: (dir: number) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -60 : 60, opacity: 0 }),
  };

  const renderQuestion = (q: Question) => {
    const value = answers[q.id];

    switch (q.type) {
      case "long":
        return (
          <Textarea
            value={(value as string) ?? ""}
            onChange={(e) => setAnswer(q.id, e.target.value)}
            placeholder={q.placeholder ?? "Votre réponse..."}
            rows={4}
            className="text-base leading-relaxed rounded-2xl border-2 border-border/60 bg-background/40 backdrop-blur-sm px-5 py-4 shadow-sm transition-all duration-200 focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/20 focus-visible:ring-offset-0 placeholder:text-muted-foreground/60 resize-none"
          />
        );

      case "single_choice": {
        const sel = (value as string) ?? "";
        return (
          <div className="space-y-2">
            {q.options?.map((opt) => {
              const active = sel === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setAnswer(q.id, opt)}
                  className={cn(
                    "w-full text-left px-4 py-3 rounded-xl border-2 transition-all flex items-center gap-3",
                    active
                      ? "border-primary bg-primary/10"
                      : "border-border/60 bg-background/40 hover:border-primary/50",
                  )}
                >
                  <span
                    className={cn(
                      "h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0",
                      active ? "border-primary bg-primary" : "border-border",
                    )}
                  >
                    {active && (
                      <span className="h-2 w-2 rounded-full bg-primary-foreground" />
                    )}
                  </span>
                  <span className="text-base text-foreground">{opt}</span>
                </button>
              );
            })}
          </div>
        );
      }

      case "multi_choice": {
        const sel = Array.isArray(value) ? value : [];
        return (
          <div className="space-y-2">
            {q.options?.map((opt) => {
              const active = sel.includes(opt);
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => toggleMulti(q.id, opt)}
                  className={cn(
                    "w-full text-left px-4 py-3 rounded-xl border-2 transition-all flex items-center gap-3",
                    active
                      ? "border-primary bg-primary/10"
                      : "border-border/60 bg-background/40 hover:border-primary/50",
                  )}
                >
                  <span
                    className={cn(
                      "h-5 w-5 rounded-md border-2 flex items-center justify-center shrink-0",
                      active ? "border-primary bg-primary" : "border-border",
                    )}
                  >
                    {active && (
                      <Check
                        className="h-3.5 w-3.5 text-primary-foreground"
                        strokeWidth={3}
                      />
                    )}
                  </span>
                  <span className="text-base text-foreground">{opt}</span>
                </button>
              );
            })}
          </div>
        );
      }

      case "scale": {
        const min = q.scaleMin ?? 1;
        const max = q.scaleMax ?? 5;
        const sel = (value as string) ?? "";
        const ticks = Array.from({ length: max - min + 1 }, (_, i) => min + i);
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4 text-xs md:text-sm text-muted-foreground">
              <span className="max-w-[40%]">{q.scaleMinLabel}</span>
              <span className="max-w-[40%] text-right">{q.scaleMaxLabel}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              {ticks.map((n) => {
                const active = sel === String(n);
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setAnswer(q.id, String(n))}
                    className={cn(
                      "flex-1 h-12 md:h-14 rounded-xl border-2 text-lg font-bold transition-all",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border/60 bg-background/40 text-foreground hover:border-primary/50",
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

      case "url":
      case "short":
      default:
        return (
          <Input
            type={q.type === "url" ? "url" : "text"}
            value={(value as string) ?? ""}
            onChange={(e) => setAnswer(q.id, e.target.value)}
            placeholder={q.placeholder ?? "Votre réponse..."}
            className="text-base h-12 rounded-2xl border-2 border-border/60 bg-background/40 backdrop-blur-sm px-5 shadow-sm transition-all duration-200 focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/20 focus-visible:ring-offset-0 placeholder:text-muted-foreground/60"
          />
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top progress + steps */}
      <div className="space-y-3">
        <div className="flex justify-between text-sm text-foreground/70">
          <span>
            Bloc {blockIndex + 1} / {blocks.length} · {currentBlock.title}
          </span>
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

        {/* Block dots */}
        <div className="flex flex-wrap gap-2 pt-1">
          {blocks.map((b, i) => {
            const done = i < blockIndex;
            const active = i === blockIndex;
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => {
                  if (i <= blockIndex) {
                    setDirection(i > blockIndex ? 1 : -1);
                    setBlockIndex(i);
                  }
                }}
                disabled={i > blockIndex}
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-medium border transition-all",
                  active &&
                    "border-primary bg-primary text-primary-foreground",
                  done &&
                    "border-primary/40 bg-primary/10 text-foreground hover:bg-primary/20",
                  !active &&
                    !done &&
                    "border-border/60 bg-background/40 text-muted-foreground cursor-not-allowed",
                )}
              >
                {done && <Check className="inline h-3 w-3 mr-1" />}
                {i + 1}. {b.title}
              </button>
            );
          })}
        </div>
      </div>

      {/* Block content */}
      <div className="relative min-h-[400px]">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentBlock.id}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="space-y-6"
          >
            <div className="space-y-1">
              <h3 className="text-2xl md:text-3xl font-bold text-foreground leading-tight">
                {currentBlock.title}
              </h3>
              {currentBlock.description && (
                <p className="text-foreground/70">{currentBlock.description}</p>
              )}
            </div>

            <div className="space-y-6">
              {currentQuestions.map((q, i) => (
                <div key={q.id} className="space-y-3">
                  <label className="block text-base md:text-lg font-semibold text-foreground leading-snug">
                    <span className="text-primary mr-2">{i + 1}.</span>
                    {q.label}
                  </label>
                  {renderQuestion(q)}
                </div>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Nav */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-center pt-4 border-t border-border/40">
        <Button
          variant="outline"
          size="lg"
          onClick={prev}
          disabled={blockIndex === 0 || submitting}
          className="w-full sm:w-auto"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Bloc précédent
        </Button>

        {isLastBlock ? (
          <Button
            variant="hero"
            size="lg"
            onClick={handleSubmit}
            disabled={submitting || !blockComplete}
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
            disabled={!blockComplete}
            className="w-full sm:w-auto"
          >
            Bloc suivant
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
};
