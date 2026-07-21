import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ArrowRight, Lock, UserRound } from "lucide-react";
import { useNavigate } from "react-router-dom";

const translations = {
  en: {
    greeting: "Hello, choose your access",
    description: "Select the portal that matches your role before continuing.",
    clientTitle: "Client access",
    clientDescription: "Open your onboarding and identify yourself with your client information.",
    adminTitle: "Administrator access",
    adminDescription: "Go to the TDIA admin portal to access the dashboard.",
    clientAction: "Continue as client",
    adminAction: "Continue as admin",
  },
  fr: {
    greeting: "Bonjour, choisissez votre accès",
    description: "Sélectionnez le portail correspondant à votre rôle avant de continuer.",
    clientTitle: "Accès client",
    clientDescription: "Ouvrez votre onboarding et identifiez-vous avec vos informations client.",
    adminTitle: "Accès administrateur",
    adminDescription: "Accédez au portail admin TDIA pour ouvrir le dashboard.",
    clientAction: "Continuer comme client",
    adminAction: "Continuer comme administrateur",
  },
};

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

      <main className="container mx-auto min-h-screen px-4 py-20 md:py-28 flex items-center justify-center">
        <div className="w-full max-w-3xl space-y-10 text-center">
          <div className="space-y-4">
            <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">TDIA</p>
            <h1 className="text-4xl md:text-6xl font-bold text-foreground tracking-tight">
              {t.greeting}
            </h1>
            <p className="max-w-2xl mx-auto text-base md:text-lg text-muted-foreground leading-relaxed">
              {t.description}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="group rounded-3xl border border-border bg-card/70 p-6 md:p-8 text-left transition-all hover:border-primary/50 hover:bg-card">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-4">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <UserRound className="h-6 w-6" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-2xl font-semibold text-foreground">{t.clientTitle}</h2>
                    <p className="text-sm leading-relaxed text-muted-foreground">{t.clientDescription}</p>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
              </div>
              <Button className="mt-8 w-full justify-between" onClick={() => navigate("/client")}>
                {t.clientAction}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="group rounded-3xl border border-border bg-card/70 p-6 md:p-8 text-left transition-all hover:border-primary/50 hover:bg-card">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-4">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Lock className="h-6 w-6" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-2xl font-semibold text-foreground">{t.adminTitle}</h2>
                    <p className="text-sm leading-relaxed text-muted-foreground">{t.adminDescription}</p>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
              </div>
              <Button className="mt-8 w-full justify-between" onClick={() => navigate("/admin/login")}>
                {t.adminAction}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
        </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
