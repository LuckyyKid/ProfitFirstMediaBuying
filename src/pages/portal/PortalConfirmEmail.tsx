import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, CheckCircle2, KeyRound, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

// Design decision: clicking the confirmation link only proves email possession;
// it must NOT grant portal access on its own. Supabase auto-creates a session
// when the link's token is verified server-side — we immediately sign the user
// out and route them to /portail/login. The pending client_code stays in
// localStorage; PortalLogin picks it up and calls redeem_portal_client_code
// after an explicit password login. This kills the "click the link and you're
// in" bypass so the portal is only reachable via OTP entry (signup screen) or
// a deliberate password login.
type Stage = "waiting_session" | "signing_out" | "email_confirmed" | "no_session";

const PortalConfirmEmail = () => {
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>("waiting_session");

  useEffect(() => {
    let cancelled = false;
    let handled = false;

    const handleAutoSession = async () => {
      if (handled || cancelled) return;
      handled = true;
      if (!cancelled) setStage("signing_out");
      try {
        await supabase.auth.signOut();
      } catch {
        /* ignore — login page will handle any leftover session */
      }
      if (cancelled) return;
      setStage("email_confirmed");
      toast.success("Email vérifié. Connectez-vous pour activer votre portail.");
      setTimeout(() => navigate("/portail/login", { replace: true }), 1500);
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      if (cancelled) return;
      if (session) void handleAutoSession();
    });

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) void handleAutoSession();
      else setStage("no_session");
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md p-8 space-y-6 glass-card glow-effect">
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            {stage === "email_confirmed" ? (
              <CheckCircle2 className="h-6 w-6" />
            ) : stage === "signing_out" ? (
              <ShieldCheck className="h-6 w-6" />
            ) : (
              <KeyRound className="h-6 w-6" />
            )}
          </div>
          <h1 className="text-2xl font-bold">
            {stage === "email_confirmed" ? "Email vérifié" : "Activation de votre accès"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {stage === "waiting_session" && "Vérification du lien de confirmation…"}
            {stage === "signing_out" && "Sécurisation en cours…"}
            {stage === "email_confirmed" &&
              "Votre email est confirmé. Pour activer votre portail, connectez-vous avec le mot de passe choisi lors de l'inscription."}
            {stage === "no_session" &&
              "Ce lien a expiré ou est déjà utilisé. Connectez-vous depuis /portail/login."}
          </p>
        </div>

        {(stage === "waiting_session" || stage === "signing_out") && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {(stage === "email_confirmed" || stage === "no_session") && (
          <Button className="w-full" onClick={() => navigate("/portail/login")}>
            Aller à la connexion
          </Button>
        )}
      </Card>
    </div>
  );
};

export default PortalConfirmEmail;
