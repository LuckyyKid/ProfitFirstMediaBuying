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
  type Lang,
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
  language?: Lang;
}

type AnswerValue = string | string[];

const UI_TEXT = {
  fr: {
    fillAllBlock: "Veuillez répondre à toutes les questions de ce bloc",
    fillLastBlock: "Veuillez compléter le dernier bloc",
    saved: "Réponses enregistrées !",
    genericError: "Une erreur est survenue. Réessayez.",
    yourAnswer: "Votre réponse...",
    block: "Bloc",
    prevBlock: "Bloc précédent",
    nextBlock: "Bloc suivant",
    sending: "Envoi...",
    submit: "Envoyer mes réponses",
  },
  en: {
    fillAllBlock: "Please answer every question in this block",
    fillLastBlock: "Please complete the last block",
    saved: "Answers saved!",
    genericError: "Something went wrong. Please try again.",
    yourAnswer: "Your answer...",
    block: "Block",
    prevBlock: "Previous block",
    nextBlock: "Next block",
    sending: "Sending...",
    submit: "Send my answers",
  },
} as const;

export const QuizBlocks = ({
  questions,
  blocks,
  formKey,
  clientCode,
  email,
  brandName,
  clientInfo,
  onComplete,
  language = "fr",
}: QuizBlocksProps) => {
  const t = UI_TEXT[language];
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
      toast.error(t.fillAllBlock);
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
      toast.error(t.fillLastBlock);
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

      toast.success(t.saved);
      onComplete();
    } catch (e) {
      console.error(e);
      toast.error(t.genericError);
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
            placeholder={q.placeholder ?? t.yourAnswer}
            rows={4}
            className="text-base leading-relaxed rounded-[12px] px-5 py-4 resize-none"
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
                    "w-full text-left px-4 py-3 rounded-[12px] border transition-all flex items-center gap-3",
                    active
                      ? "border-[rgba(77,159,255,0.35)] bg-[linear-gradient(135deg,rgba(77,159,255,0.14),rgba(47,107,255,0.05))] shadow-[0_0_24px_rgba(47,107,255,0.12)]"
                      : "border-[rgba(148,170,215,0.15)] bg-[rgba(255,255,255,0.02)] hover:border-[rgba(77,159,255,0.35)]",
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
                    "w-full text-left px-4 py-3 rounded-[12px] border transition-all flex items-center gap-3",
                    active
                      ? "border-[rgba(77,159,255,0.35)] bg-[linear-gradient(135deg,rgba(77,159,255,0.14),rgba(47,107,255,0.05))] shadow-[0_0_24px_rgba(47,107,255,0.12)]"
                      : "border-[rgba(148,170,215,0.15)] bg-[rgba(255,255,255,0.02)] hover:border-[rgba(77,159,255,0.35)]",
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
                      "flex-1 h-12 md:h-14 rounded-[12px] border font-mono text-lg font-normal transition-all",
                      active
                        ? "border-transparent bg-[linear-gradient(135deg,#4d9fff,#2f6bff)] text-white shadow-[0_8px_28px_rgba(47,107,255,0.35)]"
                        : "border-[rgba(148,170,215,0.15)] bg-[rgba(255,255,255,0.02)] text-foreground hover:border-[rgba(77,159,255,0.35)]",
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
            placeholder={q.placeholder ?? t.yourAnswer}
            className="text-base h-12 rounded-[12px] px-5"
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
            {t.block} {blockIndex + 1} / {blocks.length} · {currentBlock.title}
          </span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-[3px] w-full rounded-full bg-[rgba(148,170,215,0.12)] overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-[linear-gradient(90deg,#4d9fff,#2f6bff)] shadow-[0_0_12px_rgba(77,159,255,0.5)]"
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
                  "px-3 py-1 rounded-full font-mono text-[10px] uppercase tracking-[0.16em] border transition-all",
                  active &&
                    "border-[rgba(77,159,255,0.35)] bg-[linear-gradient(135deg,rgba(77,159,255,0.14),rgba(47,107,255,0.05))] text-[#9ec8ff]",
                  done &&
                    "border-[rgba(77,159,255,0.25)] bg-[rgba(77,159,255,0.06)] text-[#c8d2e4] hover:bg-[rgba(77,159,255,0.1)]",
                  !active &&
                    !done &&
                    "border-[rgba(148,170,215,0.12)] bg-transparent text-[#5f6b82] cursor-not-allowed",
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
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-center pt-4 border-t border-[rgba(148,170,215,0.12)]">
        <Button
          variant="outline"
          size="lg"
          onClick={prev}
          disabled={blockIndex === 0 || submitting}
          className="w-full sm:w-auto"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t.prevBlock}
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
                {t.sending}
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                {t.submit}
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
            {t.nextBlock}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
};
