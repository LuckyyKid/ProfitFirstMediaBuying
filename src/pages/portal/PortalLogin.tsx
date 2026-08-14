import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { ArrowLeft, UserRound, AlertCircle } from "lucide-react";

const STORAGE_KEY = "tdia_portal_email";
const PENDING_CODE_KEY = "tdia_portal_pending_code";

const mapRedeemError = (raw: string): string => {
  if (raw.includes("unknown_client_code"))
    return "Aucun dossier client trouvé pour ce code. Vérifiez le code fourni par votre account manager.";
  if (raw.includes("email_mismatch"))
    return "L'email connecté ne correspond pas à celui enregistré dans votre dossier client.";
  if (raw.includes("client_email_missing"))
    return "Aucun email n'est enregistré pour ce dossier client. Contactez votre account manager.";
  return raw;
};

const PortalLogin = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) ?? ""; } catch { return ""; }
  });
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
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
    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (authError) {
      const msg = authError.message === "Invalid login credentials"
        ? "Email ou mot de passe incorrect."
        : authError.message;
      setError(msg);
      setShake(true);
      setTimeout(() => setShake(false), 500);
      toast.error(msg);
      return;
    }
    try { localStorage.setItem(STORAGE_KEY, email.trim()); } catch { /* ignore */ }

    // If the user just came from the signup → confirmation-link flow, a
    // pending client_code is stashed in localStorage. Redeem it now so the
    // dossier gets linked to this fresh session. Failure here is not fatal
    // (they still get into /portail); the error tells them what to do.
    let pendingCode = "";
    try { pendingCode = (localStorage.getItem(PENDING_CODE_KEY) ?? "").trim().toUpperCase(); }
    catch { /* ignore */ }
    if (pendingCode) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: redeemError } = await (supabase as any).rpc("redeem_portal_client_code", {
        p_client_code: pendingCode,
      });
      if (redeemError) {
        toast.error(`Portail non rattaché : ${mapRedeemError(redeemError.message)}`);
      } else {
        try { localStorage.removeItem(PENDING_CODE_KEY); } catch { /* ignore */ }
        toast.success("Votre accès portail est activé.");
      }
    }

    navigate("/portail", { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card
        className={`w-full max-w-md p-8 space-y-6 glass-card glow-effect transition-transform ${shake ? "animate-shake" : ""}`}
      >
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <UserRound className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold">Portail client TDIA</h1>
          <p className="text-sm text-muted-foreground">
            Connectez-vous avec votre compte pour accéder à votre portail.
          </p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(null); }}
            autoFocus
            autoComplete="email"
          />
          <Input
            type="password"
            placeholder="Mot de passe"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(null); }}
            autoComplete="current-password"
          />
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Connexion refusée</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Button type="submit" className="w-full" disabled={loading || !email || !password}>
            {loading ? "Connexion..." : "Se connecter"}
          </Button>
          <Button
            type="button"
            variant="link"
            className="w-full text-sm text-muted-foreground"
            onClick={() => navigate("/portail/forgot-password")}
          >
            Mot de passe oublié ?
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full text-sm text-muted-foreground"
            onClick={() => navigate("/portail/signup")}
          >
            Première connexion ? Créer mon compte avec un code
          </Button>
          <Button type="button" variant="outline" className="w-full" onClick={() => navigate("/")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour au choix d'accès
          </Button>
        </form>
      </Card>
    </div>
  );
};

export default PortalLogin;
