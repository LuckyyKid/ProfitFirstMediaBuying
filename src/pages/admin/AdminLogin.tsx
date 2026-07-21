import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { toast } from "sonner";
import { ArrowLeft, Lock, AlertCircle } from "lucide-react";

const AdminLogin = () => {
  const { login, authError } = useAdminAuth();
  const [identifier, setIdentifier] = useState(() => {
    try { return localStorage.getItem("tdia_admin_identifier") ?? ""; } catch { return ""; }
  });
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [wrongPwd, setWrongPwd] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const navigate = useNavigate();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setWrongPwd(false);
    setLoginError(null);
    setLoading(true);
    const result = await login(identifier.trim(), password);
    setLoading(false);
    if (result.ok) {
      try { localStorage.setItem("tdia_admin_identifier", identifier.trim()); } catch { /* ignore storage errors */ }
      navigate("/admin", { replace: true });
    } else {
      setLoginError(result.error);
      setWrongPwd(true);
      setShake(true);
      setTimeout(() => setShake(false), 500);
      toast.error(result.error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card
        className={`w-full max-w-md p-8 space-y-6 glass-card glow-effect transition-transform ${shake ? "animate-shake" : ""}`}
      >
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Lock className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold">TDIA Admin</h1>
          <p className="text-xs text-muted-foreground">
            Utilise un utilisateur Supabase Auth du projet, pas le mot de passe du dashboard Supabase ni celui de la base de donnees.
          </p>
          <p className="text-sm text-muted-foreground">
            Accès réservé à l'équipe TDIA
          </p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <Input
            type="email"
            placeholder="Email"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            autoFocus
          />
          <Input
            type="password"
            placeholder="Mot de passe"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setWrongPwd(false); setLoginError(null); }}
          />
          {wrongPwd && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Connexion refusee</AlertTitle>
              <AlertDescription>
                {loginError || authError || "Le mot de passe saisi est incorrect. Veuillez reessayer."}
              </AlertDescription>
            </Alert>
          )}
          <Button type="submit" className="w-full" disabled={loading || !password || !identifier}>
            {loading ? "Connexion..." : "Se connecter"}
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

export default AdminLogin;
