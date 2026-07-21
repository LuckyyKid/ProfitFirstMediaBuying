import { useState } from "react";
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

  const handleGenerate = async () => {
    setGenError(null);
    setIsGenerating(true);
    try {
      const email = info?.client?.contact_email || info?.client?.email || info?.lead?.email;
      const name = info?.client?.owner_name || info?.client?.name || info?.caller_name || info?.lead?.name || info?.client?.company_name;
      if (!email || !name) throw new Error("Email/nom client introuvable");
      const { data, error } = await supabase.functions.invoke("create-docusign-envelope", {
        body: {
          email,
          name,
          client_code: info?.client?.client_code || info?.client?.id,
          return_url: `${window.location.origin}/step8`,
        },
      });
      if (error) throw error;
      if (!data?.signingUrl) throw new Error(data?.error || "URL de signature manquante");
      setSigningUrl(data.signingUrl);
    } catch (e: any) {
      setGenError(e?.message || "Erreur génération contrat");
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
          .update({ current_step: 5, last_activity_at: now, updated_at: now })
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
      // After contract, send client to Business Deep Dive (/step5) before kickoff.
      setTimeout(() => navigate("/step5"), 300);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-primary/5 to-background relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-primary-glow/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
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
            
            <h2 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary via-primary-glow to-primary bg-clip-text text-transparent">
              {t.title}
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
                  <div className="w-full max-w-xl rounded-2xl border border-green-500/30 bg-green-500/10 p-6 flex flex-col items-center gap-3">
                    <CheckCircle2 className="h-10 w-10 text-green-500" />
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
