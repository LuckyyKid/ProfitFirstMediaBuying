import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ProgressBar } from "@/components/ProgressBar";
import { ArrowRight, Check, Copy } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useSound } from "@/hooks/useSound";
import { markStepCompleted, startOnboardingTimer, useStepGuard } from "@/hooks/useStepProgress";
import { useClient } from "@/hooks/useClient";
import { YouTubeTracker } from "@/components/YouTubeTracker";
import { useVideoWatchStatus } from "@/hooks/useVideoWatchStatus";
import { supabase } from "@/integrations/supabase/client";
import { persistOnboardingStepCompletion } from "@/lib/persistOnboardingStep";

const translations = {
  en: {
    step: "STEP 2: PLATFORM ACCESS",
    mainTitle: "Advertising Account Setup",
    accessTitle: "Advertising Account Access",
    emailLabel: "Access Email",
    tiktokLabel: "TikTok Manager ID",
    facebookLabel: "Facebook Manager ID",
    instructionsTitle: "Setup Instructions",
    tiktokVideo: "TikTok Ads Setup",
    facebookVideo: "Facebook Ads Setup",
    googleVideo: "Google Ads Setup",
    googleTagManager: "Google Tag Manager Setup",
    googleAnalytics: "Google Analytics Setup",
    ctaButton: "Continue to next step",
    ctaSubtext: "(3/6)",
    copySuccess: "Copied to clipboard!",
    footerNote: "The new contact platform: Slack.com (Invitation will be sent by email)",
  },
  fr: {
    step: "ÉTAPE 2: ACCÈS AUX PLATEFORMES",
    mainTitle: "Configuration des Comptes Publicitaires",
    accessTitle: "Accès au compte publicitaire",
    emailLabel: "Email d'accès",
    tiktokLabel: "Identifiant TikTok Manager",
    facebookLabel: "Identifiant Facebook Manager",
    instructionsTitle: "Instructions de Configuration",
    tiktokVideo: "Configuration TikTok Ads",
    facebookVideo: "Configuration Facebook Ads",
    googleVideo: "Configuration Google Ads",
    googleTagManager: "Configuration Google Tag Manager",
    googleAnalytics: "Configuration Google Analytics",
    ctaButton: "Passez à l'étape suivante",
    ctaSubtext: "(3/6)",
    copySuccess: "Copié dans le presse-papier !",
    footerNote: "La nouvelle plateforme de contact : Slack.com (L'invitation sera envoyée par email)",
  },
};

const VIDEO_IDS = {
  tiktok: "byY-v7UiUSg",
  facebook: "9W6mbJnyK4Q",
  google: "dAsfQZbo6kM",
  gtm: "UUMfoTrsNVA",
  analytics: "xvRb99NsQt0",
};

const Step2 = () => {
  const [language, setLanguage] = useState<"en" | "fr">("fr");
  const t = translations[language];
  const navigate = useNavigate();
  const { toast } = useToast();
  const { playSuccessSound } = useSound();
  const { info } = useClient();
  const clientCode = (info as any)?.client?.client_code ?? null;
  const { isWatched, markWatched } = useVideoWatchStatus(clientCode);
  const platformsSyncedRef = useRef(false);

  const allCompleted = Object.values(VIDEO_IDS).every((id) => isWatched(id));

  useEffect(() => {
    if (allCompleted) {
      markStepCompleted(2);
    }
  }, [allCompleted]);

  useEffect(() => {
    if (!allCompleted || !clientCode || platformsSyncedRef.current) return;
    platformsSyncedRef.current = true;

    const syncPlatformsCompletion = async () => {
      await persistOnboardingStepCompletion(clientCode, "platforms_completed_at", {
        eventType: "platforms_completed",
        source: "step2_all_videos_completed",
        details: { video_ids: Object.values(VIDEO_IDS) },
      });
    };

    syncPlatformsCompletion().catch((error) => {
      console.error("platforms completion sync error:", error);
      platformsSyncedRef.current = false;
    });
  }, [allCompleted, clientCode]);

  useStepGuard(2);
  useEffect(() => {
    startOnboardingTimer();
  }, []);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: t.copySuccess,
      duration: 2000,
    });
  };

  const handleNext = () => {
    markStepCompleted(2);
    persistOnboardingStepCompletion(clientCode, "platforms_completed_at", {
      source: "step2_next_button",
    }).catch((error) => {
      console.error("platforms completion sync error:", error);
    });
    playSuccessSound();
    setTimeout(() => navigate("/step3"), 300);
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Language Switcher */}
      <div className="absolute top-6 right-6 z-10">
        <LanguageSwitcher language={language} onLanguageChange={setLanguage} />
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12 md:py-16">
        {/* Progress Bar */}
        <ProgressBar currentStep={2} language={language} />
        
        {/* Step Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-5xl font-bold text-foreground mb-2 tracking-tight italic">
            {t.step}
          </h1>
        </div>

        {/* Main Card */}
        <div className="max-w-6xl mx-auto">
          <div className="glass-card rounded-3xl p-8 md:p-12 space-y-8 glow-effect">
            {/* Card Title */}
            <h2 className="text-3xl md:text-4xl font-bold text-center text-foreground">
              {t.mainTitle}
            </h2>

            {/* Access Information */}
            <div className="bg-primary/5 rounded-2xl p-6 border border-primary/20 space-y-4">
              <h3 className="text-2xl font-semibold text-primary mb-4">{t.accessTitle}</h3>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between bg-background/50 rounded-lg p-4">
                  <div>
                    <p className="text-sm text-muted-foreground">{t.emailLabel}</p>
                    <p className="text-foreground font-mono">mikola.business@gmail.com</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard("mikola.business@gmail.com")}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex items-center justify-between bg-background/50 rounded-lg p-4">
                  <div>
                    <p className="text-sm text-muted-foreground">{t.tiktokLabel}</p>
                    <p className="text-foreground font-mono">7224688108887932930</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard("7224688108887932930")}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex items-center justify-between bg-background/50 rounded-lg p-4">
                  <div>
                    <p className="text-sm text-muted-foreground">{t.facebookLabel}</p>
                    <p className="text-foreground font-mono">344128133467589</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard("344128133467589")}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Videos Section */}
            <div className="space-y-6">
              <h3 className="text-2xl font-semibold text-foreground text-center">{t.instructionsTitle}</h3>

              {/* TikTok Ads Video */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <h4 className="text-lg font-semibold text-primary">{t.tiktokVideo}</h4>
                  {isWatched(VIDEO_IDS.tiktok) && (
                    <Check className="h-5 w-5 text-green-500" />
                  )}
                </div>
                <YouTubeTracker
                  videoId={VIDEO_IDS.tiktok}
                  clientCode={clientCode}
                  title="TikTok Ads Setup"
                  className="aspect-video rounded-2xl overflow-hidden border border-border/50"
                  eventType="platform_video_watched"
                  details={{ platform: "tiktok_ads" }}
                  onWatched={markWatched}
                />
              </div>

              {/* Facebook Ads Video */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <h4 className="text-lg font-semibold text-primary">{t.facebookVideo}</h4>
                  {isWatched(VIDEO_IDS.facebook) && (
                    <Check className="h-5 w-5 text-green-500" />
                  )}
                </div>
                <YouTubeTracker
                  videoId={VIDEO_IDS.facebook}
                  clientCode={clientCode}
                  title="Facebook Ads Setup"
                  className="aspect-video rounded-2xl overflow-hidden border border-border/50"
                  eventType="platform_video_watched"
                  details={{ platform: "facebook_ads" }}
                  onWatched={markWatched}
                />
              </div>

              {/* Google Ads Video */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <h4 className="text-lg font-semibold text-primary">{t.googleVideo}</h4>
                  {isWatched(VIDEO_IDS.google) && (
                    <Check className="h-5 w-5 text-green-500" />
                  )}
                </div>
                <YouTubeTracker
                  videoId={VIDEO_IDS.google}
                  clientCode={clientCode}
                  title="Google Ads Setup"
                  className="aspect-video rounded-2xl overflow-hidden border border-border/50"
                  eventType="platform_video_watched"
                  details={{ platform: "google_ads" }}
                  onWatched={markWatched}
                />
              </div>

              {/* Google Tag Manager Video */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <h4 className="text-lg font-semibold text-primary">{t.googleTagManager}</h4>
                  {isWatched(VIDEO_IDS.gtm) && (
                    <Check className="h-5 w-5 text-green-500" />
                  )}
                </div>
                <YouTubeTracker
                  videoId={VIDEO_IDS.gtm}
                  clientCode={clientCode}
                  title="Google Tag Manager Setup"
                  className="aspect-video rounded-2xl overflow-hidden border border-border/50"
                  eventType="platform_video_watched"
                  details={{ platform: "google_tag_manager" }}
                  onWatched={markWatched}
                />
              </div>

              {/* Google Analytics Video */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <h4 className="text-lg font-semibold text-primary">{t.googleAnalytics}</h4>
                  {isWatched(VIDEO_IDS.analytics) && (
                    <Check className="h-5 w-5 text-green-500" />
                  )}
                </div>
                <YouTubeTracker
                  videoId={VIDEO_IDS.analytics}
                  clientCode={clientCode}
                  title="Google Analytics Setup"
                  className="aspect-video rounded-2xl overflow-hidden border border-border/50"
                  eventType="platform_video_watched"
                  details={{ platform: "google_analytics" }}
                  onWatched={markWatched}
                />
              </div>
            </div>

            {/* Navigation Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
              <Button
                variant="outline"
                size="lg"
                className="text-lg px-8 py-6 h-auto rounded-2xl group w-full sm:w-auto"
                onClick={() => navigate("/")}
              >
                <ArrowRight className="mr-2 h-5 w-5 rotate-180 group-hover:-translate-x-1 transition-transform" />
                {language === "fr" ? "Retour à l'étape précédente" : "Back to previous step"}
              </Button>

              <Button
                variant="hero"
                size="lg"
                className="text-lg px-12 py-6 h-auto rounded-2xl group w-full sm:w-auto"
                onClick={handleNext}
              >
                {t.ctaButton} {t.ctaSubtext}
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div className="text-center mt-8">
          <p className="text-sm text-muted-foreground">
            {t.footerNote}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Step2;
