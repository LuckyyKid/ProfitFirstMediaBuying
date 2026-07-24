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
import { QuizSlideshow } from "@/components/QuizSlideshow";
import { getFounderScanQuestions } from "@/data/quizQuestions";
import { stripVocalQuestions } from "@/data/voiceBlocks";

const translations = {
  en: {
    step: "STEP 4: FOUNDER SCAN",
    mainTitle: "Share Your Vision",
    description: "Help us understand your priorities, decision-making process, and vision.",
    backButton: "Back to previous step",
  },
  fr: {
    step: "ÉTAPE 4: FOUNDER SCAN",
    mainTitle: "Partagez votre vision",
    description: "Aidez-nous à comprendre vos priorités, votre processus de décision et votre vision.",
    backButton: "Retour à l'étape précédente",
  },
};

const Step4 = () => {
  const [language, setLanguage] = useState<"en" | "fr">("fr");
  const t = translations[language];
  const navigate = useNavigate();
  const { playSuccessSound } = useSound();
  useStepGuard(4);

  const { info } = useClient();
  const clientCode = (info as any)?.client?.client_code ?? null;
  const { progress } = useClientProgress(clientCode);
  const alreadyDone = !!progress?.founder_scan_submitted;
  const businessType =
    (progress as any)?.business_type ?? (info as any)?.client?.business_type ?? "ecommerce";
  const founderQuestions = stripVocalQuestions(
    getFounderScanQuestions(businessType),
    "founder_scan",
    businessType,
  );

  // After Founder Scan, go to Payment (step6). Mark step 5 completed too so
  // the /step6 guard passes even though Business Deep Dive comes later now.
  const handleComplete = () => {
    markStepCompleted(5);
    playSuccessSound();
    setTimeout(() => navigate("/step6"), 600);
  };

  const handleContinue = () => {
    markStepCompleted(5);
    navigate("/step6");
  };

  return (
    <div className="min-h-screen relative overflow-hidden animate-fade-in">
      <div className="absolute top-6 right-6 z-10 flex items-center gap-2">
        <PlatformAccessButton language={language} />
        <LanguageSwitcher language={language} onLanguageChange={setLanguage} />
      </div>

      <div className="container mx-auto px-4 py-12 md:py-16">
        <ProgressBar currentStep={4} language={language} />

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
              <QuizSlideshow
                questions={founderQuestions}
                formKey="founder_scan"
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
                onClick={() => navigate("/step3")}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t.backButton}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Step4;
