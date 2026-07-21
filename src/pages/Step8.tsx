import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { PlatformAccessButton } from "@/components/PlatformAccessButton";
import { ProgressBar } from "@/components/ProgressBar";
import { Button } from "@/components/ui/button";
import { FileCheck, ArrowLeft, ArrowRight } from "lucide-react";
import { useSound } from "@/hooks/useSound";
import { markStepCompleted, useStepGuard } from "@/hooks/useStepProgress";
import { useClient } from "@/hooks/useClient";
import { persistOnboardingStepCompletion } from "@/lib/persistOnboardingStep";

const translations = {
  en: {
    title: "Kickoff Call",
    subtitle: "Mandatory Step",
    description: "The next step is our kickoff call — the moment where we officially set the machine in motion 🚀\n\nDuring this call, we will:\n\n• Review your advertising strategy and growth objectives together.\n\n• Verify that all technical access (Business Manager, Google Ads, Pixels, etc.) are properly configured.\n\n• Identify creative and budget priorities for the first month.\n\n• Present you with the complete action plan for the next 30 days.\n\nOur goal is simple: that you leave this call with a clear vision of the strategy, responsibilities, and launch schedule.",
    scheduleCall: "Schedule your call below:",
    back: "Previous Step",
    next: "Continue"
  },
  fr: {
    title: "Appel de démarrage",
    subtitle: "Étape obligatoire",
    description: "L'étape suivante, c'est notre appel de démarrage — le moment où on met officiellement la machine en route 🚀\n\nDurant cet appel, on va :\n\n• Revoir ensemble ta stratégie publicitaire et tes objectifs de croissance.\n\n• Vérifier que tous les accès techniques (Business Manager, Google Ads, Pixels, etc.) sont bien configurés.\n\n• Identifier les priorités créatives et budgétaires pour le premier mois.\n\n• Te présenter le plan d'action complet pour les 30 prochains jours.\n\nNotre but est simple : que tu ressortes de cet appel avec une vision claire de la stratégie, des responsabilités et du calendrier de lancement.",
    scheduleCall: "Réserve ton créneau ci-dessous :",
    back: "Étape précédente",
    next: "Continuer"
  }
};

const Step8 = () => {
  const [language, setLanguage] = useState<"en" | "fr">("fr");
  const navigate = useNavigate();
  const t = translations[language];
  const { playSuccessSound } = useSound();
  const { info } = useClient();
  useStepGuard(8);

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
            <h2 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
              {t.title}
            </h2>
            <p className="text-xl font-semibold text-primary">{t.subtitle}</p>
          </div>

          <div className="bg-card border border-border rounded-lg p-8 space-y-6">
            <p className="text-foreground whitespace-pre-line leading-relaxed">
              {t.description}
            </p>

            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-foreground">
                {t.scheduleCall}
              </h3>
              <div className="w-full h-[700px] rounded-lg overflow-hidden border border-border">
                <iframe
                  src="https://calendly.com/tdiaagency/30min?month=2025-11&embed=true"
                  width="100%"
                  height="100%"
                  frameBorder="0"
                  title="Calendly Scheduling"
                  className="bg-background"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-4 justify-between">
            <Button
              variant="outline"
              size="lg"
              onClick={() => navigate("/step5")}
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
