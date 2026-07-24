import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { PlatformAccessButton } from "@/components/PlatformAccessButton";
import { ProgressBar } from "@/components/ProgressBar";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSound } from "@/hooks/useSound";
import { markStepCompleted, useStepGuard } from "@/hooks/useStepProgress";
import { useClient } from "@/hooks/useClient";
import { useClientProgress } from "@/hooks/useClientProgress";
import { QuizBlocks } from "@/components/QuizBlocks";
import { getWelcomeQuestions } from "@/data/quizQuestions";
import { stripVocalQuestions, stripVocalFromBlocks } from "@/data/voiceBlocks";

const translations = {
  en: {
    step: "STEP 3: ONBOARDING QUIZ",
    mainTitle: "Tell Us About Your Business",
    description: "Answer a few quick questions — one at a time. It only takes a few minutes.",
    backButton: "Back to previous step",
    footerNote: "The new contact platform: Slack.com (Invitation will be sent by email)",
  },
  fr: {
    step: "ÉTAPE 3: QUIZ D'INTÉGRATION",
    mainTitle: "Parlez-nous de votre entreprise",
    description: "Répondez à quelques questions, une à la fois. Cela ne prend que quelques minutes.",
    backButton: "Retour à l'étape précédente",
    footerNote: "La nouvelle plateforme de contact : Slack.com (L'invitation sera envoyée par email)",
  },
};

const Step3 = () => {
  const [language, setLanguage] = useState<"en" | "fr">("fr");
  const t = translations[language];
  const navigate = useNavigate();
  const { playSuccessSound } = useSound();
  useStepGuard(3);

  const { info } = useClient();
  const clientCode = (info as any)?.client?.client_code ?? null;
  const { progress } = useClientProgress(clientCode);
  const alreadyDone = !!progress?.welcome_form_submitted;
  const { questions: rawWelcomeQuestions, blocks: rawWelcomeBlocks } = getWelcomeQuestions(
    (progress as any)?.business_type ?? (info as any)?.client?.business_type ?? "ecommerce"
  );
  const welcomeQuestions = stripVocalQuestions(rawWelcomeQuestions, "welcome");
  const welcomeBlocks = stripVocalFromBlocks(rawWelcomeBlocks, "welcome");

  const handleComplete = () => {
    markStepCompleted(3);
    playSuccessSound();
    setTimeout(() => navigate("/step4"), 600);
  };

  const handleContinue = () => {
    markStepCompleted(3);
    navigate("/step4");
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="absolute top-6 right-6 z-10 flex items-center gap-2">
        <PlatformAccessButton language={language} />
        <LanguageSwitcher language={language} onLanguageChange={setLanguage} />
      </div>

      <div className="container mx-auto px-4 py-12 md:py-16">
        <ProgressBar currentStep={3} language={language} />

        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-5xl font-bold text-foreground mb-2 tracking-tight italic">
            {t.step}
          </h1>
        </div>

        <div className="max-w-3xl mx-auto">
          <div className="glass-card rounded-3xl p-6 md:p-10 space-y-8 glow-effect">
            <div className="text-center space-y-3">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground">
                {t.mainTitle}
              </h2>
              <p className="text-foreground/80 text-lg">{t.description}</p>
            </div>

            {alreadyDone ? (
              <div className="text-center space-y-6 py-6">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium">
                  ✓ {language === "fr" ? "Déjà complété" : "Already completed"}
                </div>
                <p className="text-foreground/80">
                  {language === "fr"
                    ? "Vous avez déjà soumis ce formulaire. Vous pouvez passer à l'étape suivante."
                    : "You've already submitted this form. You can continue to the next step."}
                </p>
                <Button variant="hero" size="lg" onClick={handleContinue} className="rounded-2xl">
                  {language === "fr" ? "Continuer" : "Continue"}
                </Button>
              </div>
            ) : (
              <QuizBlocks
                questions={welcomeQuestions}
                blocks={welcomeBlocks}
                formKey="welcome"
                clientCode={clientCode}
                email={progress?.email ?? (info as any)?.lead?.email ?? null}
                brandName={progress?.brand_name ?? (info as any)?.client?.name ?? null}
                clientInfo={info as any}
                onComplete={handleComplete}
              />
            )}

            <div className="flex justify-start pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/step2")}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t.backButton}
              </Button>
            </div>
          </div>
        </div>

        <div className="text-center mt-8">
          <p className="text-sm text-muted-foreground">{t.footerNote}</p>
        </div>
      </div>
    </div>
  );
};

export default Step3;
