import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { PlatformAccessButton } from "@/components/PlatformAccessButton";
import { ProgressBar } from "@/components/ProgressBar";
import { WelcomePackSection } from "@/components/WelcomePackSection";
import { ArrowLeft, ArrowRight, Check, KeyRound, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSound } from "@/hooks/useSound";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { fetchClient, useClient } from "@/hooks/useClient";
import { markStepCompleted } from "@/hooks/useStepProgress";
import { upsertClientProgress } from "@/hooks/useClientProgress";
import { supabase } from "@/integrations/supabase/client";
import { YouTubeTracker } from "@/components/YouTubeTracker";
import { useVideoWatchStatus } from "@/hooks/useVideoWatchStatus";
import { persistOnboardingStepCompletion } from "@/lib/persistOnboardingStep";


const translations = {
  en: {
    step: "STEP 1: WHAT TO EXPECT",
    mainTitle: "Let's Talk About On-Boarding",
    welcomeMessage: "Welcome to the TDIA Adventure 🎉",
    motivationText:
      "We're truly happy to have you with us.\n\nOur goal is simple: help you acquire customers at the best possible cost, with an approach focused on performance, technology, and transparency.\n\nOver the next few days, here's what you can expect:\n\nDay 1: Kickoff Call – We'll review your strategy, goals, and initial priorities together.\n\nDay 3: Technical Setup – Implementation of tracking, advertising access, and communication accounts.\n\nDay 10: Phone Check-In – Initial feedback on the experience and first optimizations.\n\nOur promise: WE take the risk. You can focus on your business, we'll handle everything else.\n\nIf you have any questions before the kickoff, feel free to reach out here or on Slack.\n\nWelcome aboard! 🚀",
    ctaButton: "Take me to the next step",
    ctaSubtext: "(2/6)",
    welcomePackTitle: "Your Welcome Pack",
    downloadPDF: "Download PDF",
    footerNote: "The new contact platform: Slack.com (Invitation will be sent by email)",
    popupTitle: "Welcome! Please identify yourself",
    popupDescription: "Enter your information to access the onboarding process.",
    brandLabel: "Brand / Company name",
    brandPlaceholder: "Your brand or company name",
    emailLabel: "Email address",
    emailPlaceholder: "you@company.com",
    emailHelp: "Use the SAME email when filling the forms in steps 3 and 4.",
    submitButton: "Access Onboarding",
    submitting: "Sending...",
    backToPortal: "Back to access choice",
    successMessage: "Welcome! You can now proceed.",
    errorMessage: "An error occurred. Please try again.",
  },
  fr: {
    step: "ÉTAPE 1: À QUOI S'ATTENDRE",
    mainTitle: "Parlons de l'Intégration",
    welcomeMessage: "Bienvenue dans l'aventure TDIA 🎉",
    motivationText:
      "On est vraiment heureux de t'avoir avec nous.\n\nNotre objectif est simple : t'aider à acquérir des clients au meilleur coût possible, avec une approche axée sur la performance, la technologie et la transparence.\n\nAu cours des prochains jours, voici ce à quoi tu peux t'attendre :\n\nJour 1 : Kickoff Call – On revoit ensemble ta stratégie, tes objectifs et les premières priorités.\n\nJour 3 : Installation technique – Mise en place du tracking, des accès publicitaires et des comptes de communication.\n\nJour 10 : Check-In téléphonique – Un premier retour sur l'expérience et les premières optimisations.\n\nNotre promesse : WE take the risk. Tu peux te concentrer sur ton business, on s'occupe de tout le reste.\n\nSi tu as la moindre question avant le kickoff, tu peux nous écrire directement ici ou sur Slack.\n\nEncore bienvenue à bord ! 🚀",
    ctaButton: "Passez à l'étape suivante",
    ctaSubtext: "(2/6)",
    welcomePackTitle: "Votre Pack de Bienvenue",
    downloadPDF: "Télécharger le PDF",
    footerNote: "La nouvelle plateforme de contact : Slack.com (L'invitation sera envoyée par email)",
    popupTitle: "Bienvenue ! Veuillez vous identifier",
    popupDescription: "Entrez vos informations pour accéder au processus d'intégration.",
    brandLabel: "Nom de marque / entreprise",
    brandPlaceholder: "Le nom de votre marque ou entreprise",
    emailLabel: "Adresse courriel",
    emailPlaceholder: "vous@entreprise.com",
    emailHelp: "Utilisez la MÊME adresse courriel pour remplir les formulaires des étapes 3 et 4.",
    submitButton: "Accéder à l'onboarding",
    submitting: "Envoi en cours...",
    backToPortal: "Retour au choix d'accès",
    successMessage: "Bienvenue ! Vous pouvez maintenant continuer.",
    errorMessage: "Une erreur est survenue. Veuillez réessayer.",
  },
};

const WELCOME_VIDEO_ID = "SEXyYnOcY1k";

const ClientOnboarding = () => {
  const [language, setLanguage] = useState<"en" | "fr">("fr");
  const { info, setClient } = useClient();
  const [showPopup, setShowPopup] = useState(!info);
  const [clientId, setClientId] = useState("");
  const [brandName, setBrandName] = useState("");
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const t = translations[language];
  const navigate = useNavigate();
  const { playSuccessSound } = useSound();
  const { isWatched, isCompleted, markWatched, markCompleted } = useVideoWatchStatus(
    (info as any)?.client?.client_code ?? null
  );

  useEffect(() => {
    if (info && isCompleted(WELCOME_VIDEO_ID)) {
      markStepCompleted(1);
    }
  }, [info, isCompleted]);

  useEffect(() => {
    setShowPopup(!info);
  }, [info]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId.trim() || !brandName.trim() || !email.trim()) return;

    setIsSubmitting(true);
    try {
      const data = await fetchClient(clientId);
      setClient(data);

      const code = (data as any)?.client?.client_code ?? clientId.trim();
      const cid = (data as any)?.client?.id ?? null;
      try {
        await upsertClientProgress({
          client_code: code,
          email,
          brand_name: brandName,
          client_id: cid,
        });
      } catch (progressErr) {
        console.error("upsertClientProgress error:", progressErr);
        toast.warning(
          language === "fr"
            ? "Identification OK, mais l'enregistrement de votre email a échoué. Les formulaires risquent de ne pas se débloquer."
            : "Logged in, but saving your email failed. Forms may not unlock automatically."
        );
      }

      try {
        const { data: progress } = await supabase
          .from("client_progress")
          .select("*")
          .eq("client_code", code)
          .maybeSingle();

        const client = (data as any)?.client ?? {};
        const p: any = progress ?? {};
        let completed = 1;
        if (p.video_watched) completed = Math.max(completed, 2);
        if (p.welcome_form_submitted) completed = Math.max(completed, 3);
        if (p.founder_scan_submitted) completed = Math.max(completed, 4);
        if (p.business_deep_dive_submitted) completed = Math.max(completed, 5);
        if (p.paid || client.paid) completed = Math.max(completed, 6);
        if (p.contract_signed || client.contract_signed) completed = Math.max(completed, 7);
        if (p.kickoff_scheduled || client.kickoff_scheduled) completed = Math.max(completed, 8);

        markStepCompleted(completed);

        setShowPopup(false);
        toast.success(t.successMessage);
        playSuccessSound();

        if (completed > 1) {
          const next = Math.min(completed + 1, 9);
          setTimeout(() => navigate(`/step${next}`), 300);
          return;
        }
      } catch (resumeErr) {
        console.error("resume progress error:", resumeErr);
      }

      setShowPopup(false);
      toast.success(t.successMessage);
      playSuccessSound();
    } catch (err) {
      console.error("Error fetching client:", err);
      toast.error(err instanceof Error ? err.message : t.errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNext = () => {
    if (!info) return;
    markStepCompleted(1);
    persistOnboardingStepCompletion((info as any)?.client?.client_code ?? null, "welcome_completed_at", {
      source: "step1_next_button",
    }).catch((error) => {
      console.error("welcome completion sync error:", error);
    });
    playSuccessSound();
    setTimeout(() => navigate("/step2"), 300);
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      <Dialog open={showPopup} onOpenChange={() => {}}>
        <DialogContent
          className="sm:max-w-md [&>button]:hidden"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-center text-primary">
              {t.popupTitle}
            </DialogTitle>
            <DialogDescription className="text-center text-muted-foreground">
              {t.popupDescription}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-5 pt-4">
            <div className="space-y-2">
              <Label htmlFor="clientId" className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-primary" />
                Client ID
              </Label>
              <Input
                id="clientId"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder={language === "fr" ? "CLI-XXXXXXX ou UUID" : "CLI-XXXXXXX or UUID"}
                required
                maxLength={100}
                className="h-12"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="brandName">{t.brandLabel}</Label>
              <Input
                id="brandName"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                placeholder={t.brandPlaceholder}
                required
                maxLength={120}
                className="h-12"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t.emailLabel}</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t.emailPlaceholder}
                required
                maxLength={255}
                className="h-12"
              />
              <p className="text-xs text-muted-foreground">{t.emailHelp}</p>
            </div>
            <div className="space-y-3">
              <Button
                type="submit"
                variant="hero"
                size="lg"
                className="w-full text-lg py-6 rounded-2xl"
                disabled={
                  isSubmitting ||
                  !clientId.trim() ||
                  !brandName.trim() ||
                  !email.trim()
                }
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    {t.submitting}
                  </>
                ) : (
                  t.submitButton
                )}
              </Button>
              <Button type="button" variant="outline" className="w-full" onClick={() => navigate("/")}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t.backToPortal}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <div className="absolute top-6 left-6 z-10">
        <h1 className="text-2xl font-bold text-primary">TDIA</h1>
      </div>

      <div className="absolute top-6 right-6 z-10 flex items-center gap-2">
        <PlatformAccessButton language={language} />
        <LanguageSwitcher language={language} onLanguageChange={setLanguage} />
      </div>

      <div className="container mx-auto px-4 py-12 md:py-16">
        <ProgressBar currentStep={1} language={language} />

        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-5xl font-bold text-foreground mb-2 tracking-tight italic">
            {t.step}
          </h1>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="glass-card rounded-3xl p-8 md:p-12 space-y-8 glow-effect">
            <h2 className="text-3xl md:text-4xl font-bold text-center text-foreground">
              {t.mainTitle}
            </h2>

            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-lg font-semibold text-primary">Vidéo de bienvenue</h3>
              {isWatched(WELCOME_VIDEO_ID) && (
                <Check className="h-5 w-5 text-green-500" />
              )}
            </div>
            <YouTubeTracker
              videoId={WELCOME_VIDEO_ID}
              clientCode={(info as any)?.client?.client_code ?? null}
              title="YouTube video player"
              className="aspect-video rounded-2xl overflow-hidden border border-border/50"
              onWatched={markWatched}
              onCompleted={(vid) => {
                markCompleted(vid);
                markStepCompleted(1);
                persistOnboardingStepCompletion((info as any)?.client?.client_code ?? null, "welcome_completed_at", {
                  source: "step1_video_completed",
                  details: { video_id: vid },
                }).catch((error) => {
                  console.error("welcome video completion sync error:", error);
                });
              }}
            />

            <div className="bg-primary/5 rounded-2xl p-6 border border-primary/20">
              <h3 className="text-2xl font-semibold mb-3 text-primary">{t.welcomeMessage}</h3>
              <p className="text-foreground/90 leading-relaxed whitespace-pre-line">{t.motivationText}</p>
            </div>

            <div className="flex justify-center">
              <Button
                variant="hero"
                size="lg"
                className="text-lg px-12 py-6 h-auto rounded-2xl group"
                onClick={handleNext}
              >
                {t.ctaButton} {t.ctaSubtext}
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>

            <WelcomePackSection translations={t} />
          </div>
        </div>

        <div className="text-center mt-8">
          <p className="text-sm text-muted-foreground">
            {t.footerNote}
          </p>
        </div>
      </div>

    </div>
  );
};

export default ClientOnboarding;