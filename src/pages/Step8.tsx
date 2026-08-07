import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { PlatformAccessButton } from "@/components/PlatformAccessButton";
import { ProgressBar } from "@/components/ProgressBar";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, ExternalLink, Loader2 } from "lucide-react";
import { useSound } from "@/hooks/useSound";
import { markStepCompleted, useStepGuard } from "@/hooks/useStepProgress";
import { useClient } from "@/hooks/useClient";
import { useClientProgress } from "@/hooks/useClientProgress";
import { persistOnboardingStepCompletion } from "@/lib/persistOnboardingStep";

const CALENDLY_URL = "https://calendly.com/tdiaagency/30min";

const translations = {
  en: {
    title: "Kickoff Call",
    subtitle: "Mandatory Step",
    description: "The next step is our kickoff call — the moment where we officially set the machine in motion.\n\nDuring this call, we will:\n\n• Review your advertising strategy and growth objectives together.\n\n• Verify that all technical access (Business Manager, Google Ads, Pixels, etc.) are properly configured.\n\n• Identify creative and budget priorities for the first month.\n\n• Present you with the complete action plan for the next 30 days.\n\nOur goal is simple: that you leave this call with a clear vision of the strategy, responsibilities, and launch schedule.",
    scheduleCall: "Schedule your call below:",
    loadingCalendar: "Loading calendar…",
    fallbackPrompt: "The calendar isn't loading?",
    fallbackLink: "Open the booking page in a new tab",
    back: "Previous Step",
    next: "Continue"
  },
  fr: {
    title: "Appel de démarrage",
    subtitle: "Étape obligatoire",
    description: "L'étape suivante, c'est notre appel de démarrage — le moment où on met officiellement la machine en route.\n\nDurant cet appel, on va :\n\n• Revoir ensemble ta stratégie publicitaire et tes objectifs de croissance.\n\n• Vérifier que tous les accès techniques (Business Manager, Google Ads, Pixels, etc.) sont bien configurés.\n\n• Identifier les priorités créatives et budgétaires pour le premier mois.\n\n• Te présenter le plan d'action complet pour les 30 prochains jours.\n\nNotre but est simple : que tu ressortes de cet appel avec une vision claire de la stratégie, des responsabilités et du calendrier de lancement.",
    scheduleCall: "Réserve ton créneau ci-dessous :",
    loadingCalendar: "Chargement du calendrier…",
    fallbackPrompt: "Le calendrier ne s'affiche pas ?",
    fallbackLink: "Ouvrir la page de réservation dans un nouvel onglet",
    back: "Étape précédente",
    next: "Continuer"
  }
};

const Step8 = () => {
  const [language, setLanguage] = useState<"en" | "fr">("fr");
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const navigate = useNavigate();
  const t = translations[language];
  const { playSuccessSound } = useSound();
  const { info } = useClient();
  const clientCode = info?.client?.client_code ?? null;
  const { progress } = useClientProgress(clientCode);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  useStepGuard(8);

  // Build a fresh Calendly URL for the client's current locale, without any
  // hardcoded `month=` param that would freeze the widget on a past month.
  const calendlyUrl = useMemo(() => {
    const params = new URLSearchParams({
      hide_gdpr_banner: "1",
      primary_color: "2f6bff",
    });
    if (typeof window !== "undefined") {
      params.set("embed_domain", window.location.hostname);
      params.set("embed_type", "Inline");
    }
    return `${CALENDLY_URL}?${params.toString()}`;
  }, []);

  useEffect(() => {
    if (progress?.client_language && progress.client_language !== language) {
      setLanguage(progress.client_language);
    }
  }, [progress?.client_language]);

  // Fallback: if Calendly doesn't fire onLoad within a few seconds (network,
  // blocker), we still hide the spinner so the "open in new tab" link is
  // clearly visible instead of being covered forever.
  useEffect(() => {
    if (iframeLoaded) return;
    const timer = window.setTimeout(() => setIframeLoaded(true), 6000);
    return () => window.clearTimeout(timer);
  }, [iframeLoaded]);

  const handleNext = () => {
    markStepCompleted(8);
    persistOnboardingStepCompletion(info?.client?.client_code ?? null, "kickoff_completed_at", {
      source: "step7_next_button",
    }).catch((error) => {
      console.error("kickoff completion sync error:", error);
    });
    playSuccessSound();
    setTimeout(() => navigate("/step9"), 300);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-accent/10">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-primary">TDIA</h1>
          <div className="flex items-center gap-2">
            <PlatformAccessButton language={language} />
            <LanguageSwitcher language={language} onLanguageChange={setLanguage} />
          </div>
        </div>

        {/* Progress Bar */}
        <ProgressBar currentStep={8} language={language} />

        <div className="max-w-4xl mx-auto space-y-8">
          <div className="text-center space-y-4">
            <h2 className="text-3xl sm:text-4xl font-medium tracking-[-0.02em] text-foreground">
              <span className="font-serif italic text-[#9ec8ff]">{t.title}</span>
            </h2>
            <p className="text-lg sm:text-xl font-semibold text-primary">{t.subtitle}</p>
          </div>

          <div className="bg-card border border-border rounded-lg p-5 sm:p-8 space-y-6">
            <p className="text-foreground whitespace-pre-line leading-relaxed">
              {t.description}
            </p>

            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-foreground">
                {t.scheduleCall}
              </h3>
              <div className="relative w-full h-[520px] sm:h-[600px] md:h-[700px] rounded-lg overflow-hidden border border-border bg-background">
                {!iframeLoaded && (
                  <div className="absolute inset-0 flex items-center justify-center gap-2 text-muted-foreground bg-background">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>{t.loadingCalendar}</span>
                  </div>
                )}
                <iframe
                  ref={iframeRef}
                  src={calendlyUrl}
                  width="100%"
                  height="100%"
                  frameBorder="0"
                  loading="lazy"
                  title="Calendly Scheduling"
                  className="bg-background"
                  onLoad={() => setIframeLoaded(true)}
                />
              </div>
              <p className="text-sm text-muted-foreground text-center">
                {t.fallbackPrompt}{" "}
                <a
                  href={calendlyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary underline underline-offset-2 hover:text-primary/80"
                >
                  {t.fallbackLink}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </p>
            </div>
          </div>

          <div className="flex gap-4 justify-between">
            <Button
              variant="outline"
              size="lg"
              onClick={() => navigate("/step7")}
              className="gap-2"
            >
              <ArrowLeft className="h-5 w-5" />
              {t.back}
            </Button>
            <Button
              variant="default"
              size="lg"
              onClick={handleNext}
              className="gap-2"
            >
              {t.next}
              <ArrowRight className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Step8;
