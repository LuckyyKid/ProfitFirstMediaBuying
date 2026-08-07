import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { PlatformAccessButton } from "@/components/PlatformAccessButton";
import { ProgressBar } from "@/components/ProgressBar";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, ExternalLink, Loader2 } from "lucide-react";
import { useSound } from "@/hooks/useSound";
import { useClient, fetchClient } from "@/hooks/useClient";
import { useClientProgress } from "@/hooks/useClientProgress";
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
    alreadyPaid: "Payment already completed for this client.",
    dealValueMissing: "The contract amount is not yet available for your account. Please contact your onboarding manager so we can prepare your payment link.",
    createLinkFailed: "We couldn't open the secure payment page. Please try again in a few seconds — if the problem persists, contact your onboarding manager.",
    verifyFailed: "We couldn't confirm your payment right now. Please try again in a moment — if you've already paid, your access will unlock automatically.",
    missingClient: "Your session seems to have expired. Please refresh the page and log back in with your client code."
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
    alreadyPaid: "Le paiement a déjà été effectué pour ce client.",
    dealValueMissing: "Le montant de votre contrat n'est pas encore disponible. Contactez votre chargé d'onboarding pour qu'on prépare votre lien de paiement.",
    createLinkFailed: "Impossible d'ouvrir la page de paiement sécurisée. Réessayez dans quelques secondes — si le problème persiste, contactez votre chargé d'onboarding.",
    verifyFailed: "Nous n'avons pas pu confirmer votre paiement. Réessayez dans un instant — si le paiement a bien été effectué, votre accès sera débloqué automatiquement.",
    missingClient: "Votre session semble avoir expiré. Rafraîchissez la page et reconnectez-vous avec votre code client."
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
  const { progress } = useClientProgress(clientCode ?? null);
  useStepGuard(6);

  useEffect(() => {
    if (progress?.client_language && progress.client_language !== language) {
      setLanguage(progress.client_language);
    }
  }, [progress?.client_language]);

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
    // Popup blockers strip user-activation across awaits, so window.open()
    // called after an `await` gets silently blocked. Open the tab NOW,
    // synchronously in the click handler, then swap its URL once we have it.
    const popup = window.open("", "_blank");
    const navigateToPayment = (url: string) => {
      if (popup && !popup.closed) {
        popup.location.href = url;
      } else {
        // Popup was blocked — fall back to same-tab redirect so the client
        // can still complete the payment.
        window.location.href = url;
      }
    };
    setCreating(true);
    try {
      // Double-check with Stripe before opening any link to prevent double payment
      // if local state is stale.
      try {
        const { data: chk } = await supabase.functions.invoke("check-stripe-payment", {
          body: { client_code: clientCode, client_id: info?.client?.id },
        });
        if (chk?.paid) {
          popup?.close();
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
        navigateToPayment(existingLink);
        return;
      }
      if (!dealValue || dealValue <= 0) {
        popup?.close();
        toast.error(t.dealValueMissing);
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
      if (!data?.url) throw new Error("stripe_payment_link_missing_url");
      setClient({
        ...info,
        client: {
          ...info?.client,
          stripe_link: data.url,
        },
      } as typeof info);
      navigateToPayment(data.url);
    } catch (e: any) {
      console.error("Stripe payment link error:", e);
      popup?.close();
      toast.error(t.createLinkFailed);
    } finally {
      setCreating(false);
    }
  };


  const handleNext = async () => {
    const identifier = info?.client?.id || info?.client?.client_code;
    if (!identifier) {
      toast.error(t.missingClient);
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
      console.error("Payment verification error:", e);
      toast.error(t.verifyFailed);
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
            <h2 className="text-4xl font-medium tracking-[-0.02em] text-foreground">
              <span className="font-serif italic text-[#9ec8ff]">{t.title}</span>
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
