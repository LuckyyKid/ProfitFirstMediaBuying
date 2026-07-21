import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { PlatformAccessButton } from "@/components/PlatformAccessButton";
import { ProgressBar } from "@/components/ProgressBar";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, ExternalLink, Loader2 } from "lucide-react";
import { useSound } from "@/hooks/useSound";
import { useClient, fetchClient } from "@/hooks/useClient";
import { toast } from "sonner";
import { markStepCompleted, useStepGuard } from "@/hooks/useStepProgress";
import { supabase } from "@/integrations/supabase/client";
import { persistOnboardingStepCompletion } from "@/lib/persistOnboardingStep";

const translations = {
  en: {
    title: "Payment",
    subtitle: "Complete Your Registration",
    description: "To finalize your onboarding and activate all TDIA services, please click the button below to proceed to secure payment.",
    payButton: "Proceed to Payment",
    paid: "Payment received",
    back: "Previous Step",
    next: "Continue",
    checking: "Checking payment...",
    notPaid: "Payment not detected yet. Please complete the Stripe checkout, then try again.",
    alreadyPaid: "Payment already completed for this client."
  },
  fr: {
    title: "Paiement",
    subtitle: "Finalisez Votre Inscription",
    description: "Pour finaliser votre intégration et activer tous les services TDIA, veuillez cliquer sur le bouton ci-dessous pour procéder au paiement sécurisé.",
    payButton: "Procéder au paiement",
    paid: "Paiement reçu",
    back: "Étape précédente",
    next: "Continuer",
    checking: "Vérification du paiement...",
    notPaid: "Paiement non détecté. Veuillez compléter le paiement Stripe, puis réessayer.",
    alreadyPaid: "Le paiement a déjà été effectué pour ce client."
  }
};


const Step6 = () => {
  const [language, setLanguage] = useState<"en" | "fr">("fr");
  const navigate = useNavigate();
  const t = translations[language];
  const { playSuccessSound } = useSound();
  const { info, setClient } = useClient();
  const existingLink = info?.client?.stripe_link;
  const dealValue = Number(info?.client?.deal_value || 0);
  const clientName = info?.client?.name || info?.client?.brand_name;
  const clientCode = info?.client?.client_code;
  const isPaid = Boolean(info?.client?.paid);
  const [checking, setChecking] = useState(false);
  const [creating, setCreating] = useState(false);
  useStepGuard(6);

  const setLocalPaidState = (amount?: number) => {
    setClient({
      client: {
        ...(info?.client ?? {}),
        paid: true,
        stripe_link: null,
        ...(amount !== undefined ? { stripe_amount_paid: amount } : {}),
      },
      lead: info?.lead,
      caller_name: info?.caller_name,
    });
  };

  useEffect(() => {
    const identifier = info?.client?.id || info?.client?.client_code;
    if (!identifier || isPaid) return;

    let cancelled = false;

    const syncPaymentState = async () => {
      try {
        const { data } = await supabase.functions.invoke("check-stripe-payment", {
          body: { client_code: clientCode, client_id: info?.client?.id },
        });

        if (cancelled || !data?.paid) return;

        const fresh = await fetchClient(String(identifier));
        if (!cancelled) {
          setClient({
            ...fresh,
            client: {
              ...fresh.client,
              paid: true,
              stripe_link: null,
              ...(data?.amount !== undefined ? { stripe_amount_paid: data.amount } : {}),
            },
          });
        }
      } catch (_) {
        if (!cancelled) setLocalPaidState();
      }
    };

    void syncPaymentState();

    return () => {
      cancelled = true;
    };
  }, [clientCode, info?.client?.id, info?.client?.client_code, isPaid, setClient]);

  const handlePay = async () => {
    // Guard: never allow re-opening payment if already paid.
    if (isPaid) {
      toast.info(t.alreadyPaid);
      return;
    }
    setCreating(true);
    try {
      // Double-check with Stripe before opening any link to prevent double payment
      // if local state is stale.
      try {
        const { data: chk } = await supabase.functions.invoke("check-stripe-payment", {
          body: { client_code: clientCode, client_id: info?.client?.id },
        });
        if (chk?.paid) {
          try {
            const identifier = info?.client?.id || info?.client?.client_code;
            if (identifier) {
              const fresh = await fetchClient(String(identifier));
              setClient({
                ...fresh,
                client: {
                  ...fresh.client,
                  paid: true,
                  stripe_link: null,
                  ...(chk?.amount !== undefined ? { stripe_amount_paid: chk.amount } : {}),
                },
              });
            } else {
              setLocalPaidState(chk?.amount);
            }
          } catch (_) {
            setLocalPaidState(chk?.amount);
          }
          toast.info(t.alreadyPaid);
          return;
        }
      } catch (_) { /* ignore — fall through to opening link */ }

      if (existingLink) {
        window.open(existingLink, "_blank");
        return;
      }
      if (!dealValue || dealValue <= 0) {
        toast.error(language === "fr" ? "Valeur du contrat introuvable" : "Contract value not found");
        return;
      }
      const { data, error } = await supabase.functions.invoke("create-stripe-payment-link", {
        body: {
          deal_value: dealValue,
          client_name: clientName,
          client_code: clientCode,
          client_id: info?.client?.id,
          currency: "cad",
        },
      });
      if (error) throw error;
      if (!data?.url) throw new Error("Lien non généré");
      setClient({
        ...info,
        client: {
          ...info?.client,
          stripe_link: data.url,
        },
      } as typeof info);
      window.open(data.url, "_blank");
    } catch (e: any) {
      toast.error(e?.message || (language === "fr" ? "Erreur création paiement" : "Payment creation error"));
    } finally {
      setCreating(false);
    }
  };


  const handleNext = async () => {
    const identifier = info?.client?.id || info?.client?.client_code;
    if (!identifier) {
      toast.error(language === "fr" ? "Client introuvable" : "Client not found");
      return;
    }
    setChecking(true);
    try {
      // 1) First refresh from external CRM (in case it already knows)
      let isPaidNow = false;
      try {
        const fresh = await fetchClient(String(identifier));
        setClient(fresh);
        isPaidNow = Boolean(fresh?.client?.paid);
      } catch (_) { /* ignore — fall through to Stripe check */ }

      // 2) If still not marked, poll Stripe directly via edge function (handles webhook delay)
      if (!isPaidNow && clientCode) {
        const maxAttempts = 5;
        for (let i = 0; i < maxAttempts; i++) {
          const { data, error } = await supabase.functions.invoke("check-stripe-payment", {
            body: { client_code: clientCode, client_id: info?.client?.id },
          });

          if (!error && data?.paid) {
            isPaidNow = true;
            // refresh local client info
            try {
              const fresh2 = await fetchClient(String(identifier));
              setClient({
                ...fresh2,
                client: {
                  ...fresh2.client,
                  paid: true,
                  stripe_link: null,
                  ...(data?.amount !== undefined ? { stripe_amount_paid: data.amount } : {}),
                },
              });
            } catch (_) {
              setLocalPaidState(data?.amount);
            }
            break;
          }
          if (i < maxAttempts - 1) await new Promise((r) => setTimeout(r, 2000));
        }
      }

      if (!isPaidNow) {
        toast.error(t.notPaid);
        return;
      }
      markStepCompleted(6);
      await persistOnboardingStepCompletion(clientCode, "payment_completed_at", {
        source: "step5_payment_verified",
      });
      playSuccessSound();
      setTimeout(() => navigate("/step7"), 300);
    } catch (e: any) {
      toast.error(e?.message || (language === "fr" ? "Erreur de vérification" : "Verification error"));
    } finally {
      setChecking(false);
    }
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
        <ProgressBar currentStep={6} language={language} />

        <div className="max-w-4xl mx-auto space-y-8">
          <div className="text-center space-y-4">
            <h2 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
              {t.title}
            </h2>
            <p className="text-xl font-semibold text-primary">{t.subtitle}</p>
          </div>

          <div className="bg-card border border-border rounded-lg p-8 space-y-8">
            <p className="text-foreground text-center text-lg leading-relaxed">
              {t.description}
            </p>

            {dealValue > 0 && (
              <p className="text-center text-2xl font-bold text-primary">
                {new Intl.NumberFormat(language === "fr" ? "fr-CA" : "en-CA", {
                  style: "currency",
                  currency: "CAD",
                }).format(dealValue)}
              </p>
            )}

            <div className="flex justify-center">
              {isPaid ? (
                <div className="flex items-center gap-2 px-6 py-4 rounded-md bg-primary/10 text-primary font-semibold text-lg">
                  ✓ {t.paid}
                </div>
              ) : (
                <Button
                  variant="hero"
                  size="lg"
                  onClick={handlePay}
                  disabled={creating}
                  className="gap-2 text-lg px-12 py-6"
                >
                  {creating ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      {language === "fr" ? "Vérification..." : "Checking..."}
                    </>
                  ) : (
                    <>
                      {t.payButton}
                      <ExternalLink className="h-5 w-5" />
                    </>
                  )}
                </Button>
              )}
            </div>

          </div>

          <div className="flex gap-4 justify-between">
            <Button
              variant="outline"
              size="lg"
              onClick={() => navigate("/step4")}
              className="gap-2"
            >
              <ArrowLeft className="h-5 w-5" />
              {t.back}
            </Button>
            <Button
              variant="default"
              size="lg"
              onClick={handleNext}
              disabled={checking}
              className="gap-2"
            >
              {checking ? t.checking : t.next}
              <ArrowRight className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Step6;
