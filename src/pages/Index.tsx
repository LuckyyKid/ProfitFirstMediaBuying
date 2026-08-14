import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ArrowRight, Lock, ShieldCheck, UserRound } from "lucide-react";
import { useNavigate } from "react-router-dom";

const translations = {
  en: {
    greeting: "Hello, choose your access",
    description: "Select the portal that matches your role before continuing.",
    onboardingTitle: "Client onboarding",
    onboardingDescription: "First visit? Open your onboarding to identify yourself with your client information.",
    onboardingAction: "Start onboarding",
    portalTitle: "Client portal",
    portalDescription: "Already onboarded? Sign in with your email and password to access your dashboard.",
    portalAction: "Sign in to your portal",
    portalSignup: "Don't have an account yet? Create one with your client code →",
    adminTitle: "Administrator access",
    adminDescription: "Go to the TDIA admin portal to access the dashboard.",
    adminAction: "Continue as admin",
  },
  fr: {
    greeting: "Bonjour, choisissez votre accès",
    description: "Sélectionnez le portail correspondant à votre rôle avant de continuer.",
    onboardingTitle: "Onboarding client",
    onboardingDescription: "Première visite ? Ouvrez votre onboarding et identifiez-vous avec vos informations client.",
    onboardingAction: "Démarrer l'onboarding",
    portalTitle: "Portail client",
    portalDescription: "Déjà onboardé ? Connectez-vous avec votre email et votre mot de passe pour accéder à votre dashboard.",
    portalAction: "Se connecter à mon portail",
    portalSignup: "Pas encore de compte ? Créez-le avec votre code client →",
    adminTitle: "Accès administrateur",
    adminDescription: "Accédez au portail admin TDIA pour ouvrir le dashboard.",
    adminAction: "Continuer comme administrateur",
  },
};

type CardProps = {
  icon: React.ReactNode;
  title: string;
  description: string;
  action: string;
  onClick: () => void;
  footer?: React.ReactNode;
};

const AccessCard = ({ icon, title, description, action, onClick, footer }: CardProps) => (
  <div className="group rounded-3xl border border-border bg-card/70 p-6 md:p-8 text-left transition-all hover:border-primary/50 hover:bg-card flex flex-col">
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-4">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          {icon}
        </div>
        <div className="space-y-2">
          <h2 className="text-xl md:text-2xl font-semibold text-foreground">{title}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
        </div>
      </div>
      <ArrowRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
    </div>
    <Button className="mt-8 w-full justify-between" onClick={onClick}>
      {action}
      <ArrowRight className="h-4 w-4" />
    </Button>
    {footer && <div className="mt-3">{footer}</div>}
  </div>
);

const Index = () => {
  const [language, setLanguage] = useState<"en" | "fr">("fr");
  const t = translations[language];
  const navigate = useNavigate();

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="absolute top-6 left-6 z-10">
        <h1 className="text-2xl font-bold text-primary">TDIA</h1>
      </div>

      <div className="absolute top-6 right-6 z-10">
        <LanguageSwitcher language={language} onLanguageChange={setLanguage} />
      </div>

      <main className="container mx-auto min-h-screen px-4 py-16 sm:py-20 md:py-28 flex items-center justify-center">
        <div className="w-full max-w-5xl space-y-10 text-center">
          <div className="space-y-4">
            <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">TDIA</p>
            <h1 className="text-3xl sm:text-4xl md:text-6xl font-bold text-foreground tracking-tight">
              {t.greeting}
            </h1>
            <p className="max-w-2xl mx-auto text-base md:text-lg text-muted-foreground leading-relaxed">
              {t.description}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3 max-w-5xl mx-auto">
            <AccessCard
              icon={<UserRound className="h-6 w-6" />}
              title={t.onboardingTitle}
              description={t.onboardingDescription}
              action={t.onboardingAction}
              onClick={() => navigate("/client")}
            />
            <AccessCard
              icon={<ShieldCheck className="h-6 w-6" />}
              title={t.portalTitle}
              description={t.portalDescription}
              action={t.portalAction}
              onClick={() => navigate("/portail/login")}
              footer={
                <button
                  type="button"
                  onClick={() => navigate("/portail/signup")}
                  className="text-xs text-muted-foreground hover:text-primary text-left w-full transition-colors"
                >
                  {t.portalSignup}
                </button>
              }
            />
            <AccessCard
              icon={<Lock className="h-6 w-6" />}
              title={t.adminTitle}
              description={t.adminDescription}
              action={t.adminAction}
              onClick={() => navigate("/admin/login")}
            />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
