import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { PlatformAccessButton } from "@/components/PlatformAccessButton";
import { ProgressBar } from "@/components/ProgressBar";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, FileCheck, Loader2, ExternalLink, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSound } from "@/hooks/useSound";
import { useClient } from "@/hooks/useClient";
import { useClientProgress } from "@/hooks/useClientProgress";
import { markStepCompleted, useStepGuard } from "@/hooks/useStepProgress";
import { persistOnboardingStepCompletion } from "@/lib/persistOnboardingStep";

const translations = {
  en: {
    title: "Your Contract",
    subtitle: "Next steps for finalizing your partnership",
    contractSection: "Contract Information",
    description: "Your contract will be sent to you in your welcome email within 24 hours.",
    note: "You will be able to review and sign it securely from the link provided in the email.",
    back: "Back to Previous Step",
    nextStep: "Continue to Kickoff Call",
    alreadySignedTitle: "Contract already signed",
    alreadySignedDesc: "We've received your signed contract. You can move on to the next step.",
    missingContact: "Your contact info seems incomplete. Please contact your onboarding manager so we can prepare your contract.",
    generateFailed: "We couldn't prepare your contract right now. Please try again in a moment — if the problem persists, contact your onboarding manager.",
    missingSignUrl: "Your contract is being prepared. Please refresh the page in a few seconds and try again.",
  },
  fr: {
    title: "Votre Contrat",
    subtitle: "Prochaines étapes pour finaliser votre partenariat",
    contractSection: "Information sur le Contrat",
    description: "Votre contrat vous sera envoyé dans l'email de bienvenue sous 24 heures.",
    note: "Vous pourrez le consulter et le signer en toute sécurité depuis le lien fourni dans l'email.",
    back: "Retour à l'étape précédente",
    nextStep: "Continuer vers l'appel de démarrage",
    alreadySignedTitle: "Contrat déjà signé",
    alreadySignedDesc: "Nous avons bien reçu votre contrat signé. Vous pouvez passer à l'étape suivante.",
    missingContact: "Vos informations de contact semblent incomplètes. Contactez votre chargé d'onboarding pour qu'on prépare votre contrat.",
    generateFailed: "Nous n'avons pas pu préparer votre contrat. Réessayez dans un instant — si le problème persiste, contactez votre chargé d'onboarding.",
    missingSignUrl: "Votre contrat est en cours de préparation. Rafraîchissez la page dans quelques secondes puis réessayez.",
  }
};

const Step7 = () => {
  const [language, setLanguage] = useState<"en" | "fr">("fr");
  const [isSending, setIsSending] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [signingUrl, setSigningUrl] = useState<string | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const t = translations[language];
  const navigate = useNavigate();
  const { playSuccessSound } = useSound();
  const { info } = useClient();
  const clientCode = info?.client?.client_code || info?.client?.id || null;
  const { progress } = useClientProgress(clientCode);
  const docusignLink = signingUrl || info?.client?.docusign_link;
  const alreadySigned = Boolean(
    (progress as any)?.contract_signed ||
    (progress as any)?.docusign_signed_at ||
    (progress as any)?.docusign_pdf_url
  );

  useStepGuard(7);

  useEffect(() => {
    if (progress?.client_language && progress.client_language !== language) {
      setLanguage(progress.client_language);
    }
  }, [progress?.client_language]);

  const openSigningUrl = (url: string, popup: Window | null) => {
    if (popup && !popup.closed) {
      popup.location.href = url;
    } else {
      // Popup was blocked — fall back to same-tab redirect so signing still works.
      window.location.href = url;
    }
  };

  const handleGenerate = async () => {
    setGenError(null);
    // Open the signing tab synchronously (still inside the click gesture) so
    // popup blockers don't strip it after the awaits below. We'll set the
    // real URL as soon as DocuSign returns it.
    const popup = window.open("", "_blank");
    setIsGenerating(true);
    try {
      const email = info?.client?.contact_email || info?.client?.email || info?.lead?.email;
      const name = info?.client?.owner_name || info?.client?.name || info?.caller_name || info?.lead?.name || info?.client?.company_name;
      if (!email || !name) {
        popup?.close();
        setGenError(t.missingContact);
        return;
      }
      const { data, error } = await supabase.functions.invoke("create-docusign-envelope", {
        body: {
          email,
          name,
          client_code: info?.client?.client_code || info?.client?.id,
          return_url: `${window.location.origin}/step8`,
        },
      });
      if (error) throw error;
      if (!data?.signingUrl) {
        popup?.close();
        setGenError(t.missingSignUrl);
        return;
      }
      setSigningUrl(data.signingUrl);
      openSigningUrl(data.signingUrl, popup);
    } catch (e: any) {
      console.error("DocuSign envelope error:", e);
      popup?.close();
      setGenError(t.generateFailed);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleNext = async () => {
    markStepCompleted(7);
    setIsSending(true);
    try {
      if (info?.client?.client_code) {
        const now = new Date().toISOString();
        await supabase
          .from("client_progress")
          .update({ current_step: 8, last_activity_at: now, updated_at: now })
          .eq("client_code", info.client.client_code);
      }
    } catch (err) {
      console.error("step7 advance error:", err);
    }
    try {
      const userName = info?.caller_name || info?.client?.name || "Inconnu";
      await supabase.functions.invoke("notify-slack", {
        body: {
          name: userName,
          companyNumber: info?.client?.client_code || info?.client?.id || "",
          completionMessage: true,
        },
      });
    } catch (err) {
      console.error("Error notifying Slack:", err);
    } finally {
      setIsSending(false);
      playSuccessSound();
      setTimeout(() => navigate("/step8"), 300);
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Single Premium radial halo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[500px]"
          style={{ background: "radial-gradient(600px 250px at 50% 0%, rgba(47,107,255,0.14), transparent 60%)" }}
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
        <ProgressBar currentStep={7} language={language} />

        <div className="max-w-6xl mx-auto space-y-8 mt-12">
          {/* Header Section */}
          <div className="text-center space-y-4 animate-fade-in">
            <div className="flex justify-center mb-4">
              <FileCheck className="h-16 w-16 text-primary animate-scale-in" />
            </div>
            
            <h2 className="text-4xl md:text-5xl font-medium tracking-[-0.02em] text-foreground">
              <span className="font-serif italic text-[#9ec8ff]">{t.title}</span>
            </h2>
            
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {t.subtitle}
            </p>
          </div>

          {/* Contract Card */}
          <div className="bg-card border border-border rounded-3xl p-8 md:p-12 space-y-8 shadow-2xl animate-scale-in" style={{ animationDelay: '0.2s' }}>
            <div className="space-y-6 text-center">
              <h3 className="text-2xl md:text-3xl font-bold text-foreground flex items-center justify-center gap-3">
                <FileCheck className="h-8 w-8 text-primary" />
                {t.contractSection}
              </h3>
              <p className="text-xl text-foreground font-medium max-w-2xl mx-auto">
                {t.description}
              </p>
              <div className="bg-primary/10 border border-primary/20 rounded-xl p-6 max-w-2xl mx-auto">
                <p className="text-base text-foreground/80">
                  {t.note}
                </p>
              </div>
              <div className="flex flex-col items-center gap-3 pt-2">
                {alreadySigned ? (
                  <div className="w-full max-w-xl rounded-[14px] border border-[rgba(122,232,180,0.25)] bg-[linear-gradient(135deg,rgba(122,232,180,0.06),rgba(255,255,255,0.015))] p-6 flex flex-col items-center gap-3">
                    <CheckCircle2 className="h-10 w-10 text-[hsl(var(--good))]" />
                    <p className="text-lg font-semibold text-foreground">{t.alreadySignedTitle}</p>
                    <p className="text-sm text-muted-foreground text-center">{t.alreadySignedDesc}</p>
                  </div>
                ) : docusignLink ? (
                  <Button
                    variant="hero"
                    size="lg"
                    onClick={() => window.open(docusignLink, "_blank")}
                    className="gap-2 text-lg px-8 py-6 rounded-2xl"
                  >
                    {language === "fr" ? "Signer le contrat (DocuSign)" : "Sign contract (DocuSign)"}
                    <ExternalLink className="h-5 w-5" />
                  </Button>
                ) : (
                  <Button
                    variant="hero"
                    size="lg"
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className="gap-2 text-lg px-8 py-6 rounded-2xl"
                  >
                    {isGenerating ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileCheck className="h-5 w-5" />}
                    {language === "fr" ? "Générer mon contrat" : "Generate my contract"}
                  </Button>
                )}
                {genError && !alreadySigned && (
                  <p className="text-sm text-destructive max-w-xl text-center">{genError}</p>
                )}

              </div>
            </div>
          </div>

          {/* Navigation Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center pb-12 animate-fade-in" style={{ animationDelay: '0.4s' }}>
            <Button
              variant="outline"
              size="lg"
              onClick={() => navigate("/step6")}
              className="gap-2 text-lg px-8 py-6 rounded-2xl hover-scale"
            >
              <ArrowLeft className="h-5 w-5" />
              {t.back}
            </Button>
            
            <Button
              variant="hero"
              size="lg"
              onClick={handleNext}
              disabled={isSending}
              className="gap-3 text-lg px-8 py-6 rounded-2xl hover-scale"
            >
              {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
              {t.nextStep}
              <ArrowRight className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Step7;
