import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { ArrowLeft, KeyRound, AlertCircle } from "lucide-react";

const STORAGE_KEY = "tdia_portal_email";

const PortalSignup = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initialCode = params.get("code") ?? "";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [clientCode, setClientCode] = useState(initialCode);
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

  const fail = (msg: string) => {
    setError(msg);
    setShake(true);
    setTimeout(() => setShake(false), 500);
    toast.error(msg);
  };

  const mapRpcError = (raw: string): string => {
    if (raw.includes("unknown_client_code"))
      return "Aucun dossier client trouvé pour ce code. Vérifiez le code fourni par votre account manager.";
    if (raw.includes("email_mismatch"))
      return "L'email saisi ne correspond pas à celui enregistré dans votre dossier client. Utilisez l'email connu de votre account manager.";
    if (raw.includes("client_email_missing"))
      return "Aucun email n'est enregistré pour ce dossier client. Contactez votre account manager.";
    if (raw.includes("user_email_missing"))
      return "Impossible de récupérer votre email. Réessayez.";
    if (raw.includes("not_authenticated"))
      return "Session non initialisée. Réessayez.";
    return raw;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim();
    const cleanCode = clientCode.trim().toUpperCase();
    if (password.length < 8) return fail("Le mot de passe doit contenir au moins 8 caractères.");
    if (password !== confirm) return fail("Les deux mots de passe ne correspondent pas.");
    if (!cleanCode) return fail("Votre code client est requis (format CLI-XXXXXXXX).");

    setLoading(true);
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
    });
    if (signUpError) {
      setLoading(false);
      return fail(signUpError.message);
    }

    // Some Supabase projects require email confirmation before a session exists.
    // If we don't have a session yet, sign in immediately with the password we just set.
    let session = signUpData.session;
    if (!session) {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });
      if (signInError || !signInData.session) {
        setLoading(false);
        return fail(
          "Compte créé, mais une confirmation par email est requise. Ouvrez le lien reçu, puis revenez sur /portail/signup pour finaliser le rattachement.",
        );
      }
      session = signInData.session;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: rpcError } = await (supabase as any).rpc("redeem_portal_client_code", { p_client_code: cleanCode });
    setLoading(false);
    if (rpcError) return fail(mapRpcError(rpcError.message));

    try { localStorage.setItem(STORAGE_KEY, cleanEmail); } catch { /* ignore */ }
    toast.success("Compte créé, bienvenue sur votre portail.");
    navigate("/portail", { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <Card
        className={`w-full max-w-md p-8 space-y-6 glass-card glow-effect transition-transform ${shake ? "animate-shake" : ""}`}
      >
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <KeyRound className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold">Créer votre accès</h1>
          <p className="text-sm text-muted-foreground">
            Saisissez votre code client (format <span className="font-mono">CLI-XXXXXXXX</span>) et l'email
            connu de votre account manager. Nous vérifions que les deux correspondent avant de vous rattacher à votre dossier.
          </p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <Input
            type="email"
            placeholder="Email (celui enregistré dans votre dossier)"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(null); }}
            autoFocus
            autoComplete="email"
          />
          <Input
            type="password"
            placeholder="Mot de passe (8 caractères minimum)"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(null); }}
            autoComplete="new-password"
          />
          <Input
            type="password"
            placeholder="Confirmer le mot de passe"
            value={confirm}
            onChange={(e) => { setConfirm(e.target.value); setError(null); }}
            autoComplete="new-password"
          />
          <Input
            type="text"
            placeholder="Code client — CLI-XXXXXXXX"
            value={clientCode}
            onChange={(e) => { setClientCode(e.target.value); setError(null); }}
            className="font-mono uppercase tracking-widest"
          />
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Inscription refusée</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Button
            type="submit"
            className="w-full"
            disabled={loading || !email || !password || !confirm || !clientCode}
          >
            {loading ? "Création..." : "Créer mon compte"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full text-sm text-muted-foreground"
            onClick={() => navigate("/portail/login")}
          >
            J'ai déjà un compte
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

export default PortalSignup;
