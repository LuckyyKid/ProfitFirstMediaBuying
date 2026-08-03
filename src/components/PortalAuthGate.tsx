import { Navigate } from "react-router-dom";
import { usePortalAuth } from "@/hooks/usePortalAuth";
import { Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  children: (ctx: { clientCode: string; logout: () => Promise<void> }) => React.ReactNode;
};

/**
 * Protects `/portail`. Redirects unauthenticated users to `/portail/login`.
 * If the user is authenticated but has no client_code liaison, shows a message
 * inviting them to complete signup (they may have created an account without
 * saisir leur code client).
 */
const PortalAuthGate = ({ children }: Props) => {
  const { isAuthed, ready, clientCode, error, logout } = usePortalAuth();

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Chargement de votre portail…</span>
        </div>
      </div>
    );
  }

  if (!isAuthed) {
    return <Navigate to="/portail/login" replace />;
  }

  if (!clientCode) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="glass-card max-w-md w-full p-8 space-y-4 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive mx-auto">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-semibold">Aucun dossier client rattaché</h1>
          <p className="text-sm text-muted-foreground">
            Votre compte n'est associé à aucun dossier client. Terminez votre
            inscription depuis <span className="font-mono">/portail/signup</span> en
            saisissant votre code client (fourni par votre account manager).
            {error ? <span className="block mt-2 text-xs text-destructive/80">Détail : {error}</span> : null}
          </p>
          <div className="flex flex-col gap-2 pt-2">
            <Button variant="outline" className="w-full" onClick={() => { void logout(); }}>
              Se déconnecter
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children({ clientCode, logout })}</>;
};

export default PortalAuthGate;
