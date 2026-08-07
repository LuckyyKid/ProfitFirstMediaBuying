import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { PlatformAccessButton } from "@/components/PlatformAccessButton";
import { ProgressBar } from "@/components/ProgressBar";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ArrowLeft, ArrowRight, Rocket, Sparkles } from "lucide-react";
import { useSound } from "@/hooks/useSound";
import { useStepGuard } from "@/hooks/useStepProgress";
import { useClient } from "@/hooks/useClient";
import { useClientProgress } from "@/hooks/useClientProgress";
import { supabase } from "@/integrations/supabase/client";

const translations = {
  en: {
    congratulations: "Congratulations!",
    title: "Your Journey with TDIA Begins Now",
    subtitle: "All steps completed successfully",
    welcomeMessage: "Welcome aboard! We're thrilled to have you join the TDIA family.",
    nextSteps: "What happens next?",
    step1: "Our team will review your information",
    step2: "Join your Slack channel",
    step3Prefix: "Get familiar with ",
    step3LinkLabel: "TDIA Hub",
    step3Suffix: "",
    step4: "Be ready for the kick-off call",
    platformsInfo: "Important: Your Slack access link will be sent in your onboarding email.",
    thankYou: "Thank you for choosing TDIA!",
    back: "Back to Previous Step",
    returnHome: "Return to Home"
  },
  fr: {
    congratulations: "Félicitations !",
    title: "Votre Aventure avec TDIA Commence Maintenant",
    subtitle: "Toutes les étapes complétées avec succès",
    welcomeMessage: "Bienvenue à bord ! Nous sommes ravis de vous accueillir dans la famille TDIA.",
    nextSteps: "Et maintenant ?",
    step1: "Notre équipe va examiner vos informations",
    step2: "Rejoins ton canal Slack",
    step3Prefix: "Familiarise-toi avec ",
    step3LinkLabel: "TDIA Hub",
    step3Suffix: "",
    step4: "Sois prêt pour le kick-off call",
    platformsInfo: "Important : Le lien d'accès Slack sera envoyé dans votre email d'onboarding.",
    thankYou: "Merci d'avoir choisi TDIA !",
    back: "Retour à l'étape précédente",
    returnHome: "Retour à l'accueil"
  }
};

const Step9 = () => {
  const [language, setLanguage] = useState<"en" | "fr">("fr");
  const t = translations[language];
  const { playCelebrationSound } = useSound();
  const navigate = useNavigate();
  const { info } = useClient();
  const clientCode = info?.client?.client_code ?? null;
  const { progress } = useClientProgress(clientCode);

  useStepGuard(9);

  useEffect(() => {
    if (progress?.client_language && progress.client_language !== language) {
      setLanguage(progress.client_language);
    }
  }, [progress?.client_language]);

  useEffect(() => {
    // Play celebration sound when component mounts
    const timer = setTimeout(() => {
      playCelebrationSound();
    }, 500);

    return () => clearTimeout(timer);
  }, [playCelebrationSound]);

  // Fire onboarding-complete webhook (idempotent server-side) + mark completed
  useEffect(() => {
    const code = info?.client?.client_code;
    if (!code) return;
    const now = new Date().toISOString();
    supabase
      .from("client_progress")
      .update({
        completed_at: now,
        current_step: 9,
        last_activity_at: now,
        updated_at: now,
      })
      .eq("client_code", code)
      .then(({ error }) => {
        if (error) console.error("mark onboarding completed error:", error);
      });
    supabase.functions
      .invoke("log-activity", {
        body: {
          client_code: code,
          event_type: "onboarding_completed",
          status: "ok",
          details: { source: "step9_mounted" },
        },
      })
      .catch((err) => console.error("log-activity error:", err));
    supabase.functions
      .invoke("notify-onboarding-complete", { body: { client_code: code } })
      .catch((err) => console.error("notify-onboarding-complete error:", err));
  }, [info?.client?.client_code]);

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Single Premium radial halo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[500px]"
          style={{ background: "radial-gradient(600px 250px at 50% 0%, rgba(47,107,255,0.18), transparent 60%)" }}
        />
      </div>

      <div className="container mx-auto px-4 py-8 relative z-10">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-primary">TDIA</h1>
          <div className="flex items-center gap-2">
            <PlatformAccessButton language={language} />
            <LanguageSwitcher language={language} onLanguageChange={setLanguage} />
          </div>
        </div>

        {/* Progress Bar */}
        <ProgressBar currentStep={9} language={language} />

        <div className="max-w-6xl mx-auto space-y-10 mt-12">
          {/* Celebration Header */}
          <div className="text-center space-y-6 animate-fade-in">
            <div className="flex justify-center gap-4 mb-6">
              <Rocket className="h-16 w-16 text-[#9ec8ff]" />
            </div>

            <h2 className="text-5xl md:text-6xl font-medium tracking-[-0.02em] text-foreground animate-scale-in">
              <span className="font-serif italic text-[#9ec8ff]">{t.congratulations}</span>
            </h2>
            
            <h3 className="text-3xl md:text-4xl font-semibold text-foreground animate-fade-in" style={{ animationDelay: '0.2s' }}>
              {t.title}
            </h3>

            <div className="flex items-center justify-center gap-2 animate-fade-in" style={{ animationDelay: '0.3s' }}>
              <CheckCircle2 className="h-6 w-6 text-primary" />
              <p className="text-lg text-muted-foreground font-medium">
                {t.subtitle}
              </p>
            </div>
          </div>

          {/* Welcome Message Card */}
          <div className="bg-gradient-to-br from-card to-card/80 border border-primary/20 rounded-3xl p-8 md:p-10 shadow-2xl animate-scale-in backdrop-blur-sm" style={{ animationDelay: '0.4s' }}>
            <div className="flex items-start gap-4 mb-6">
              <Sparkles className="h-8 w-8 text-primary flex-shrink-0 mt-1" />
              <p className="text-xl md:text-2xl text-foreground font-medium leading-relaxed">
                {t.welcomeMessage}
              </p>
            </div>

            <div className="space-y-6 pt-6 border-t border-border/50">
              <h4 className="text-2xl font-bold text-primary flex items-center gap-2">
                <Rocket className="h-6 w-6" />
                {t.nextSteps}
              </h4>
              
              <div className="grid gap-4">
                <div className="flex items-start gap-3 p-4 bg-background/50 rounded-xl hover-scale transition-all">
                  <CheckCircle2 className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
                  <p className="text-foreground/90">{t.step1}</p>
                </div>
                <div className="flex items-start gap-3 p-4 bg-background/50 rounded-xl hover-scale transition-all">
                  <CheckCircle2 className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
                  <p className="text-foreground/90">{t.step2}</p>
                </div>
                <div className="flex items-start gap-3 p-4 bg-background/50 rounded-xl hover-scale transition-all">
                  <CheckCircle2 className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
                  <p className="text-foreground/90">
                    {t.step3Prefix}
                    <a
                      href="https://tdiaconnect.ca/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline underline-offset-2 hover:text-primary/80"
                    >
                      {t.step3LinkLabel}
                    </a>
                    {t.step3Suffix}
                  </p>
                </div>
                <div className="flex items-start gap-3 p-4 bg-background/50 rounded-xl hover-scale transition-all">
                  <CheckCircle2 className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
                  <p className="text-foreground/90">{t.step4}</p>
                </div>
              </div>

              <div className="bg-primary/10 border border-primary/20 rounded-xl p-6 mt-6">
                <p className="text-foreground font-medium text-center">
                  {t.platformsInfo}
                </p>
              </div>
            </div>

            <div className="text-center mt-8 pt-6 border-t border-border/50">
              <p className="text-2xl font-bold text-primary animate-pulse">
                {t.thankYou}
              </p>
            </div>
          </div>

          {/* Navigation Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center pb-12 animate-fade-in" style={{ animationDelay: '0.6s' }}>
            <Button
              variant="outline"
              size="lg"
              onClick={() => navigate("/step8")}
              className="gap-2 text-lg px-8 py-6 rounded-2xl hover-scale"
            >
              <ArrowLeft className="h-5 w-5" />
              {t.back}
            </Button>
            
            <Button
              variant="hero"
              size="lg"
              onClick={() => navigate("/")}
              className="gap-3 text-lg px-8 py-6 rounded-2xl hover-scale"
            >
              {t.returnHome}
              <ArrowRight className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Step9;
