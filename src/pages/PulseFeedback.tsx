import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Loader2, CheckCircle2, AlertCircle, Heart, Send } from "lucide-react";

type Step = "enter_code" | "picker" | "verbatim" | "done" | "no_open" | "expired";

interface OpenPulse {
  survey_id: string;
  type: "onboarding" | "monthly" | "relational";
  expires_at: string;
  previous_score: number | null;
  client_display: string | null;
  language: "fr" | "en";
}

const typeLabel: Record<OpenPulse["type"], string> = {
  onboarding: "Onboarding · J+7",
  monthly: "Pulse mensuel",
  relational: "NPS relationnel",
};

function normalizeCode(raw: string): string {
  return (raw || "").trim().toUpperCase();
}

function scoreClass(score: number, selected: boolean): string {
  const base = "h-14 rounded-xl border-2 font-bold text-base transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  const activeShadow = selected ? "shadow-lg scale-[1.03]" : "hover:scale-[1.02] hover:shadow-md";
  if (score <= 6) {
    return `${base} ${activeShadow} bg-red-500/10 border-red-500/40 text-red-500 hover:bg-red-500/20 hover:border-red-500/70`;
  }
  if (score <= 8) {
    return `${base} ${activeShadow} bg-yellow-500/10 border-yellow-500/40 text-yellow-500 hover:bg-yellow-500/20 hover:border-yellow-500/70`;
  }
  return `${base} ${activeShadow} bg-emerald-500/10 border-emerald-500/40 text-emerald-500 hover:bg-emerald-500/20 hover:border-emerald-500/70`;
}

function questionForScore(score: number, lang: "fr" | "en"): string {
  if (lang === "en") {
    if (score <= 6) return "What's the biggest thing we should fix?";
    if (score <= 8) return "What would make it a 10?";
    return "What did we get right?";
  }
  if (score <= 6) return "Quelle est la plus grosse chose qu'on devrait corriger ?";
  if (score <= 8) return "Qu'est-ce qui te ferait mettre 10 ?";
  return "Qu'est-ce qu'on a réussi selon toi ?";
}

export default function PulseFeedback() {
  const [params] = useSearchParams();
  const initialCode = normalizeCode(params.get("code") ?? "");
  const initialScoreParam = params.get("score");
  const initialScore = initialScoreParam != null && /^\d+$/.test(initialScoreParam)
    ? Math.min(10, Math.max(0, Number(initialScoreParam)))
    : null;

  const [step, setStep] = useState<Step>("enter_code");
  const [code, setCode] = useState(initialCode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pulse, setPulse] = useState<OpenPulse | null>(null);
  const [capturedScore, setCapturedScore] = useState<number | null>(null);
  const [pickingScore, setPickingScore] = useState<number | null>(null);
  const [verbatim, setVerbatim] = useState("");
  const [verbatimSubmitting, setVerbatimSubmitting] = useState(false);
  const autoTriggeredRef = useRef(false);

  const lang: "fr" | "en" = pulse?.language ?? "fr";

  const t = useMemo(() => ({
    tagline: lang === "en" ? "Feedback · takes 20 seconds" : "Feedback · 20 secondes",
    step1_title: lang === "en" ? "Enter your client code" : "Entre ton code client",
    step1_intro: lang === "en"
      ? "It's shown in the email or SMS we just sent you."
      : "Il est écrit dans le courriel ou SMS qu'on t'a envoyé.",
    step1_placeholder: lang === "en" ? "e.g. ABC1234" : "ex : ABC1234",
    step1_cta: lang === "en" ? "Continue" : "Continuer",
    step2_title: lang === "en" ? "Out of 10, how would you rate?" : "Sur 10, tu donnes combien ?",
    step2_note: lang === "en" ? "One tap. That's it." : "Un tap. C'est tout.",
    step3_thanks: lang === "en" ? "Got it" : "C'est reçu",
    step3_ask: lang === "en" ? "Optional — one line to help us." : "Optionnel — une ligne pour nous aider.",
    step3_placeholder: lang === "en" ? "Type your note..." : "Ton mot ici...",
    step3_send: lang === "en" ? "Send" : "Envoyer",
    step3_skip: lang === "en" ? "Skip" : "Je passe",
    done_title: lang === "en" ? "You're all set" : "C'est envoyé",
    done_msg_low: lang === "en"
      ? "One of us will reach out in the next 48h."
      : "Un de nous te rappelle dans les prochaines 48h.",
    done_msg_mid: lang === "en"
      ? "We'll bring this up at the next weekly."
      : "On en parle au prochain weekly.",
    done_msg_high: lang === "en"
      ? "Really appreciated — makes the work worth it."
      : "Vraiment apprécié — ça donne du sens à ce qu'on fait.",
    no_open_title: lang === "en" ? "Nothing to answer right now" : "Rien à répondre pour le moment",
    no_open_msg: lang === "en"
      ? "You don't have an open pulse. We'll ping you when the next one is ready."
      : "Tu n'as pas de pulse ouvert. On te fait signe quand le prochain sera prêt.",
    expired_title: lang === "en" ? "Response window closed" : "Fenêtre de réponse fermée",
    expired_msg: lang === "en"
      ? "This pulse has expired. Reply anytime to our last email."
      : "Ce pulse est expiré. Écris-nous quand tu veux en répondant à notre dernier courriel.",
    err_client_not_found: lang === "en"
      ? "This client code doesn't match anything in our system. Double-check it."
      : "Ce code client ne correspond à rien dans nos dossiers. Vérifie-le bien.",
    err_lookup_generic: lang === "en"
      ? "Couldn't check your code. Try again in a moment."
      : "Impossible de vérifier ton code. Réessaie dans un instant.",
    err_capture_generic: lang === "en"
      ? "Couldn't save your answer. Try again in a moment."
      : "Impossible d'enregistrer ta réponse. Réessaie dans un instant.",
    err_network: lang === "en" ? "Network error. Try again." : "Erreur réseau. Réessaie.",
    err_empty_code: lang === "en" ? "Enter your client code." : "Entre ton code client.",
    change_code: lang === "en" ? "Not you? Change code" : "Pas toi ? Changer de code",
  }), [lang]);

  const submitScore = async (score: number, openPulse: OpenPulse, clientCode: string) => {
    setPickingScore(score);
    setError(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("pulse-frontend", {
        body: { action: "capture", client_code: clientCode, survey_id: openPulse.survey_id, score },
      });
      if (fnErr || !data?.ok) {
        if (data?.error === "survey_expired") {
          setStep("expired");
          return;
        }
        setError(t.err_capture_generic);
        return;
      }
      setCapturedScore(score);
      setStep("verbatim");
    } catch (e) {
      setError(t.err_network);
      console.error("[pulse-feedback] capture failed", e);
    } finally {
      setPickingScore(null);
    }
  };

  const lookupCode = async (rawCode: string, autoScore: number | null = null) => {
    const clientCode = normalizeCode(rawCode);
    if (!clientCode) {
      setError(t.err_empty_code);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("pulse-frontend", {
        body: { action: "lookup", client_code: clientCode },
      });
      if (fnErr) {
        setError(t.err_lookup_generic);
        return;
      }
      if (!data?.ok) {
        setError(data?.reason === "client_not_found" ? t.err_client_not_found : t.err_lookup_generic);
        return;
      }

      const languageDetected: "fr" | "en" = String(data.client?.language ?? "fr").toLowerCase().startsWith("en") ? "en" : "fr";
      const display = data.client?.display_name ?? clientCode;
      setCode(clientCode);

      if (!data.survey) {
        setPulse({
          survey_id: "", type: "monthly", expires_at: "", previous_score: null,
          client_display: display, language: languageDetected,
        });
        setStep("no_open");
        return;
      }

      if (new Date(data.survey.expires_at).getTime() < Date.now()) {
        setPulse({
          survey_id: data.survey.id, type: data.survey.type, expires_at: data.survey.expires_at,
          previous_score: data.survey.previous_score, client_display: display, language: languageDetected,
        });
        setStep("expired");
        return;
      }

      const openPulse: OpenPulse = {
        survey_id: data.survey.id, type: data.survey.type, expires_at: data.survey.expires_at,
        previous_score: data.survey.previous_score, client_display: display, language: languageDetected,
      };
      setPulse(openPulse);

      if (data.response?.score != null) {
        setCapturedScore(data.response.score);
        setVerbatim(data.response.verbatim ?? "");
        setStep("verbatim");
        return;
      }

      if (autoScore != null) {
        setStep("picker");
        await submitScore(autoScore, openPulse, clientCode);
        return;
      }
      setStep("picker");
    } catch (e) {
      setError(t.err_network);
      console.error("[pulse-feedback] lookup failed", e);
    } finally {
      setLoading(false);
    }
  };

  const submitVerbatim = async () => {
    if (!pulse || !code) return;
    const text = verbatim.trim().slice(0, 1000);
    setVerbatimSubmitting(true);
    try {
      if (text) {
        const { error: fnErr } = await supabase.functions.invoke("pulse-frontend", {
          body: { action: "verbatim", client_code: code, survey_id: pulse.survey_id, verbatim: text },
        });
        if (fnErr) {
          toast.error(lang === "en" ? "Couldn't save your note — sorry." : "Impossible d'enregistrer ton mot — désolé.");
          return;
        }
      }
      setStep("done");
    } catch (e) {
      toast.error(t.err_network);
      console.error("[pulse-feedback] verbatim failed", e);
    } finally {
      setVerbatimSubmitting(false);
    }
  };

  useEffect(() => {
    if (initialCode && !autoTriggeredRef.current) {
      autoTriggeredRef.current = true;
      void lookupCode(initialCode, initialScore);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doneMsg = (): string => {
    if (capturedScore == null) return "";
    if (capturedScore <= 6) return t.done_msg_low;
    if (capturedScore >= 9) return t.done_msg_high;
    return t.done_msg_mid;
  };

  const resetToCode = () => {
    setStep("enter_code");
    setPulse(null);
    setCapturedScore(null);
    setVerbatim("");
    setError(null);
  };

  const showCodeBadge = step !== "enter_code" && code;
  const clientHeader = pulse?.client_display && step !== "enter_code" ? pulse.client_display : null;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-background">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Heart className="h-6 w-6" />
          </div>
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-semibold">
            {t.tagline}
          </div>
          {clientHeader && (
            <div className="text-sm text-foreground/80 font-medium">{clientHeader}</div>
          )}
        </div>

        <Card className="glass-card glow-effect p-6 sm:p-8 space-y-5">
          {step === "enter_code" && (
            <>
              <div className="space-y-1">
                <h1 className="text-xl font-bold text-foreground tracking-tight">{t.step1_title}</h1>
                <p className="text-sm text-muted-foreground">{t.step1_intro}</p>
              </div>
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <form
                onSubmit={(e) => { e.preventDefault(); void lookupCode(code); }}
                className="space-y-3"
              >
                <Input
                  autoFocus
                  value={code}
                  onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(null); }}
                  placeholder={t.step1_placeholder}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  className="h-14 text-center text-xl tracking-[0.2em] font-bold uppercase"
                  maxLength={40}
                />
                <Button type="submit" disabled={loading || !code.trim()} className="w-full h-12 text-base">
                  {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> {lang === "en" ? "Checking..." : "Vérification..."}</> : t.step1_cta}
                </Button>
              </form>
            </>
          )}

          {step === "picker" && pulse && (
            <>
              <div className="space-y-1">
                <div className="text-[10px] uppercase tracking-[0.18em] text-primary font-bold">
                  {typeLabel[pulse.type]}
                </div>
                <h1 className="text-xl font-bold text-foreground tracking-tight">{t.step2_title}</h1>
                <p className="text-sm text-muted-foreground">{t.step2_note}</p>
                {pulse.previous_score != null && (
                  <p className="pt-1 text-xs text-muted-foreground">
                    {lang === "en" ? "Last score: " : "Dernier score : "}
                    <span className="font-semibold text-foreground">{pulse.previous_score}/10</span>
                  </p>
                )}
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-6 gap-2">
                {Array.from({ length: 11 }, (_, n) => n).map((n) => (
                  <button
                    key={n}
                    type="button"
                    disabled={pickingScore != null}
                    onClick={() => void submitScore(n, pulse, code)}
                    className={scoreClass(n, pickingScore === n)}
                  >
                    {pickingScore === n ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : n}
                  </button>
                ))}
              </div>

              <div className="flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground pt-1 px-1">
                <span>{lang === "en" ? "0 = not at all" : "0 = pas du tout"}</span>
                <span>{lang === "en" ? "10 = excellent" : "10 = excellent"}</span>
              </div>
            </>
          )}

          {step === "verbatim" && pulse && capturedScore != null && (
            <>
              <div className="flex items-start gap-3">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <h1 className="text-xl font-bold text-foreground tracking-tight">
                    {t.step3_thanks} — <span className="text-primary">{capturedScore}/10</span>
                  </h1>
                  <p className="text-sm text-muted-foreground">{questionForScore(capturedScore, lang)}</p>
                </div>
              </div>
              <Textarea
                value={verbatim}
                onChange={(e) => setVerbatim(e.target.value)}
                rows={4}
                maxLength={1000}
                placeholder={t.step3_placeholder}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">{t.step3_ask}</p>
              <div className="flex gap-2 pt-1">
                <Button
                  onClick={() => void submitVerbatim()}
                  disabled={verbatimSubmitting}
                  className="flex-1 h-11"
                >
                  {verbatimSubmitting
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <><Send className="h-4 w-4 mr-2" /> {t.step3_send}</>}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setStep("done")}
                  disabled={verbatimSubmitting}
                  className="h-11"
                >
                  {t.step3_skip}
                </Button>
              </div>
            </>
          )}

          {step === "done" && (
            <div className="text-center space-y-3 py-4">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h1 className="text-xl font-bold text-foreground tracking-tight">{t.done_title}</h1>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">{doneMsg()}</p>
            </div>
          )}

          {step === "no_open" && (
            <div className="text-center space-y-3 py-4">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Heart className="h-7 w-7" />
              </div>
              <h1 className="text-xl font-bold text-foreground tracking-tight">{t.no_open_title}</h1>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">{t.no_open_msg}</p>
              <Button variant="outline" size="sm" onClick={resetToCode} className="mt-2">
                {t.change_code}
              </Button>
            </div>
          )}

          {step === "expired" && (
            <div className="text-center space-y-3 py-4">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-orange-500/10 text-orange-500">
                <AlertCircle className="h-7 w-7" />
              </div>
              <h1 className="text-xl font-bold text-foreground tracking-tight">{t.expired_title}</h1>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">{t.expired_msg}</p>
              <Button variant="outline" size="sm" onClick={resetToCode} className="mt-2">
                {t.change_code}
              </Button>
            </div>
          )}
        </Card>

        <div className="text-center space-y-1.5">
          {showCodeBadge && step !== "done" && (
            <button
              type="button"
              onClick={resetToCode}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4"
            >
              {t.change_code}
            </button>
          )}
          <p className="text-[11px] text-muted-foreground/70">
            TDIA<span className="text-primary">.</span>{" "}
            {lang === "en" ? "Thanks for your time." : "Merci pour ton temps."}
          </p>
        </div>
      </div>
    </div>
  );
}
