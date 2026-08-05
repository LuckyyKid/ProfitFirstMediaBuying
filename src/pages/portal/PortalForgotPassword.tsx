import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { ArrowLeft, MailCheck, AlertCircle } from "lucide-react";

const STORAGE_KEY = "tdia_portal_email";

const PortalForgotPassword = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) ?? ""; } catch { return ""; }
  });
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) navigate("/portail", { replace: true });
    });
    return () => { cancelled = true; };
  }, [navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cleanEmail = email.trim();
    if (!cleanEmail) return;

    setLoading(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: `${window.location.origin}/portail/reset-password`,
    });
    setLoading(false);

    if (resetError) {
      setError(resetError.message);
      setShake(true);
      setTimeout(() => setShake(false), 500);
      toast.error(resetError.message);
      return;
    }

    try { localStorage.setItem(STORAGE_KEY, cleanEmail); } catch { /* ignore */ }
    setSent(true);
    toast.success("Email envoyé — vérifiez votre boîte de réception.");
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card
        className={`w-full max-w-md p-8 space-y-6 glass-card glow-effect transition-transform ${shake ? "animate-shake" : ""}`}
      >
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <MailCheck className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold">Mot de passe oublié</h1>
          <p className="text-sm text-muted-foreground">
            Saisissez l'email associé à votre compte. Nous vous enverrons un lien
            pour définir un nouveau mot de passe.
          </p>
        </div>

        {sent ? (
          <div className="space-y-4">
            <Alert>
              <MailCheck className="h-4 w-4" />
              <AlertTitle>Vérifiez votre boîte de réception</AlertTitle>
              <AlertDescription>
                Si un compte existe pour <span className="font-mono">{email.trim()}</span>,
                un email contenant un lien de réinitialisation vient d'être envoyé.
                Le lien reste valide pendant 1 heure. Pensez à vérifier votre dossier spam.
              </AlertDescription>
            </Alert>
            <Button variant="outline" className="w-full" onClick={() => navigate("/portail/login")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour à la connexion
            </Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(null); }}
              autoFocus
              autoComplete="email"
              required
            />
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Envoi impossible</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" className="w-full" disabled={loading || !email.trim()}>
              {loading ? "Envoi..." : "Recevoir le lien de réinitialisation"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full text-sm text-muted-foreground"
              onClick={() => navigate("/portail/login")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour à la connexion
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
};

export default PortalForgotPassword;
