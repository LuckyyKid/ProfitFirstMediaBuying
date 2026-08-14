import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { ArrowLeft, KeyRound, AlertCircle, ShieldCheck } from "lucide-react";

const STORAGE_KEY = "tdia_portal_email";
const PENDING_CODE_KEY = "tdia_portal_pending_code";

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
  const [awaitingEmail, setAwaitingEmail] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendAttempts, setResendAttempts] = useState(0);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) navigate("/portail", { replace: true });
    });
    return () => { cancelled = true; };
  }, [navigate]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

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

    // Persist code so it survives the "close tab → click email link" trip.
    try {
      localStorage.setItem(PENDING_CODE_KEY, cleanCode);
      localStorage.setItem(STORAGE_KEY, cleanEmail);
    } catch { /* ignore */ }

    const emailRedirectTo = `${window.location.origin}/portail/confirm?code=${encodeURIComponent(cleanCode)}`;

    setLoading(true);
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: { emailRedirectTo },
    });
    if (signUpError) {
      setLoading(false);
      // Common: "User already registered" → nudge to login
      if (/already registered|already exists/i.test(signUpError.message)) {
        return fail("Un compte existe déjà pour cet email. Connectez-vous depuis /portail/login.");
      }
      return fail(signUpError.message);
    }

    // Supabase enumeration protection: when the email is already registered
    // AND confirmed, signUp returns a user with an empty identities array
    // (no error, no session). Detect this and route to login — otherwise the
    // user lands on the OTP screen and hits the silent-resend trap.
    if (
      !signUpData.session &&
      signUpData.user &&
      Array.isArray(signUpData.user.identities) &&
      signUpData.user.identities.length === 0
    ) {
      setLoading(false);
      return fail("Un compte existe déjà pour cet email. Connectez-vous depuis /portail/login.");
    }

    // Case 1 — session issued immediately (email confirmation disabled).
    // Redeem the client_code right away.
    if (signUpData.session) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: rpcError } = await (supabase as any).rpc("redeem_portal_client_code", { p_client_code: cleanCode });
      setLoading(false);
      if (rpcError) return fail(mapRpcError(rpcError.message));
      try { localStorage.removeItem(PENDING_CODE_KEY); } catch { /* ignore */ }
      toast.success("Compte créé, bienvenue sur votre portail.");
      navigate("/portail", { replace: true });
      return;
    }

    // Case 2 — email confirmation required. Show the OTP input state
    // (this is NOT an error — the account was created successfully).
    setLoading(false);
    setAwaitingEmail(cleanEmail);
    setResendCooldown(60);
  };

  const onVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!awaitingEmail) return;
    const token = otp.replace(/\D/g, "").slice(0, 8);
    if (token.length !== 8) {
      setOtpError("Le code doit contenir 8 chiffres.");
      return;
    }
    setVerifying(true);
    setOtpError(null);

    const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
      email: awaitingEmail,
      token,
      type: "signup",
    });
    if (verifyError || !verifyData.session) {
      setVerifying(false);
      const raw = verifyError?.message || "";
      if (/expired/i.test(raw))
        setOtpError("Ce code a expiré. Cliquez sur « Renvoyer le code ».");
      else if (/invalid|incorrect/i.test(raw))
        setOtpError("Code incorrect. Vérifiez le code reçu par email.");
      else setOtpError(raw || "Vérification impossible. Réessayez.");
      return;
    }

    // Session issued — link the client_code.
    const cleanCode = clientCode.trim().toUpperCase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: rpcError } = await (supabase as any).rpc("redeem_portal_client_code", {
      p_client_code: cleanCode,
    });
    setVerifying(false);
    if (rpcError) {
      setOtpError(mapRpcError(rpcError.message));
      return;
    }
    try { localStorage.removeItem(PENDING_CODE_KEY); } catch { /* ignore */ }
    toast.success("Code correct — votre compte est validé. Bienvenue sur votre portail.");
    navigate("/portail", { replace: true });
  };

  const onResend = async () => {
    if (!awaitingEmail || resendCooldown > 0) return;
    setResending(true);
    setOtpError(null);
    const emailRedirectTo = `${window.location.origin}/portail/confirm?code=${encodeURIComponent(clientCode.trim().toUpperCase())}`;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: resendError } = await (supabase.auth as any).resend({
        type: "signup",
        email: awaitingEmail,
        options: { emailRedirectTo },
      });
      setResending(false);
      if (resendError) {
        const raw = resendError.message || "";
        // Supabase rate-limit → "you can only request this after N seconds."
        const match = raw.match(/(\d+)\s*seconds?/i);
        if (match) {
          const wait = Math.max(parseInt(match[1], 10), 1);
          setResendCooldown(wait);
          setOtpError(`Un code a déjà été envoyé récemment. Réessayez dans ${wait} s.`);
        } else {
          setOtpError(raw || "Impossible de renvoyer le code pour l'instant. Réessayez dans une minute.");
        }
        toast.error("Renvoi refusé — voir le détail sous le champ.");
        return;
      }
    } catch (thrown) {
      setResending(false);
      const msg = thrown instanceof Error ? thrown.message : String(thrown);
      setOtpError(`Impossible de contacter le serveur. Vérifiez votre connexion. (${msg})`);
      return;
    }

    // Supabase returns success even when the account is already confirmed —
    // in that case NO email is sent. Track the attempt count so the UI can
    // surface a "go to login" escape hatch after repeated silent successes.
    setResendAttempts((n) => n + 1);
    setOtp("");
    setResendCooldown(60);
    toast.success("Nouveau code envoyé. Vérifiez votre boîte de réception.");
  };

  // ------------------------------------------------------------------
  // OTP verification state (email confirmation via 6-digit code)
  // ------------------------------------------------------------------
  if (awaitingEmail) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-10">
        <Card className="w-full max-w-md p-8 space-y-6 glass-card glow-effect">
          <div className="text-center space-y-2">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-bold">Vérification de votre email</h1>
            <p className="text-sm text-muted-foreground">
              Nous avons envoyé un code à 8 chiffres à{" "}
              <span className="font-mono text-foreground">{awaitingEmail}</span>. Saisissez-le
              ci-dessous pour activer votre compte et accéder à votre portail.
            </p>
          </div>

          <form onSubmit={onVerifyOtp} className="space-y-4">
            <Input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="1234 5678"
              maxLength={8}
              value={otp}
              onChange={(e) => {
                setOtp(e.target.value.replace(/\D/g, "").slice(0, 8));
                setOtpError(null);
              }}
              autoFocus
              className="font-mono text-center text-2xl tracking-[0.35em] py-6"
            />
            {otpError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Vérification refusée</AlertTitle>
                <AlertDescription>{otpError}</AlertDescription>
              </Alert>
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={verifying || otp.length !== 8}
            >
              {verifying ? "Vérification…" : "Activer mon compte"}
            </Button>
          </form>

          <div className="text-xs text-muted-foreground text-center leading-relaxed">
            Le code expire dans 10 minutes. Pensez à vérifier vos spams — l'expéditeur est{" "}
            <span className="font-mono">notify.tdiaconnect.ca</span>.
          </div>

          <div className="space-y-2 pt-2 border-t border-border/40">
            {resendAttempts >= 2 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Toujours pas de code&nbsp;?</AlertTitle>
                <AlertDescription>
                  Si vous aviez déjà un compte pour cet email, Supabase n'enverra
                  plus de code de confirmation. Utilisez la page de connexion.
                </AlertDescription>
              </Alert>
            )}
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={onResend}
              disabled={resending || resendCooldown > 0}
            >
              {resending
                ? "Envoi…"
                : resendCooldown > 0
                  ? `Renvoyer le code (${resendCooldown} s)`
                  : "Renvoyer le code"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full text-sm text-muted-foreground"
              onClick={() => navigate("/portail/login")}
            >
              J'ai déjà un compte — aller à la connexion
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full text-sm text-muted-foreground"
              onClick={() => {
                setAwaitingEmail(null);
                setOtp("");
                setOtpError(null);
                setResendAttempts(0);
              }}
            >
              Modifier l'email ou le code client
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full text-sm text-muted-foreground"
              onClick={() => navigate("/")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour au choix d'accès
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Signup form
  // ------------------------------------------------------------------
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
