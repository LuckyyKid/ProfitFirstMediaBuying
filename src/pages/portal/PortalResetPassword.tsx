import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { ArrowLeft, KeyRound, AlertCircle, CheckCircle2 } from "lucide-react";

const PortalResetPassword = () => {
  const navigate = useNavigate();
  const [recoveryReady, setRecoveryReady] = useState<"pending" | "ready" | "invalid">("pending");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [done, setDone] = useState(false);

  // Supabase parses the recovery token from the URL hash on mount and fires
  // a `PASSWORD_RECOVERY` event. We also fall back to `getSession()` in case
  // the event fired before this component subscribed.
  useEffect(() => {
    let unsubscribed = false;

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (unsubscribed) return;
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setRecoveryReady("ready");
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (unsubscribed) return;
      if (data.session) {
        setRecoveryReady("ready");
      } else {
        // Give onAuthStateChange a brief moment in case the token hash is still parsing.
        setTimeout(() => {
          if (!unsubscribed) {
            supabase.auth.getSession().then(({ data: d2 }) => {
              if (unsubscribed) return;
              setRecoveryReady(d2.session ? "ready" : "invalid");
            });
          }
        }, 800);
      }
    });

    return () => {
      unsubscribed = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const fail = (msg: string) => {
    setError(msg);
    setShake(true);
    setTimeout(() => setShake(false), 500);
    toast.error(msg);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) return fail("Le mot de passe doit contenir au moins 8 caractères.");
    if (password !== confirm) return fail("Les deux mots de passe ne correspondent pas.");

    setLoading(true);
    const { error: updErr } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updErr) return fail(updErr.message);

    setDone(true);
    toast.success("Mot de passe mis à jour. Redirection vers votre portail…");
    setTimeout(() => navigate("/portail", { replace: true }), 1200);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card
        className={`w-full max-w-md p-8 space-y-6 glass-card glow-effect transition-transform ${shake ? "animate-shake" : ""}`}
      >
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <KeyRound className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold">Nouveau mot de passe</h1>
          <p className="text-sm text-muted-foreground">
            Choisissez un nouveau mot de passe. Il doit contenir au moins 8 caractères.
          </p>
        </div>

        {recoveryReady === "pending" && (
          <div className="text-center text-sm text-muted-foreground py-4">
            Validation du lien…
          </div>
        )}

        {recoveryReady === "invalid" && (
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Lien invalide ou expiré</AlertTitle>
              <AlertDescription>
                Ce lien de réinitialisation n'est plus valide (il a peut-être déjà été
                utilisé ou a expiré après 1 heure). Demandez-en un nouveau.
              </AlertDescription>
            </Alert>
            <Button
              className="w-full"
              onClick={() => navigate("/portail/forgot-password")}
            >
              Demander un nouveau lien
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => navigate("/portail/login")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour à la connexion
            </Button>
          </div>
        )}

        {recoveryReady === "ready" && !done && (
          <form onSubmit={onSubmit} className="space-y-4">
            <Input
              type="password"
              placeholder="Nouveau mot de passe (8 caractères minimum)"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(null); }}
              autoComplete="new-password"
              autoFocus
              required
            />
            <Input
              type="password"
              placeholder="Confirmer le mot de passe"
              value={confirm}
              onChange={(e) => { setConfirm(e.target.value); setError(null); }}
              autoComplete="new-password"
              required
            />
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Mise à jour refusée</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={loading || !password || !confirm}
            >
              {loading ? "Mise à jour..." : "Mettre à jour mon mot de passe"}
            </Button>
          </form>
        )}

        {done && (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>Mot de passe mis à jour</AlertTitle>
            <AlertDescription>
              Votre nouveau mot de passe est actif. Redirection vers votre portail…
            </AlertDescription>
          </Alert>
        )}
      </Card>
    </div>
  );
};

export default PortalResetPassword;
