import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  info: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary] caught:", error, info);
    this.setState({ info });
  }

  handleReset = () => {
    this.setState({ error: null, info: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    const { error, info } = this.state;
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-950 text-slate-100">
        <div className="max-w-2xl w-full space-y-4">
          <h1 className="text-2xl font-semibold text-red-300">
            Oups — une erreur a interrompu l'écran.
          </h1>
          <p className="text-slate-300">
            Le contenu ne s'est pas affiché à cause d'une exception. Envoie-moi le
            message ci-dessous et je fixe.
          </p>
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 space-y-3">
            <div>
              <div className="text-xs uppercase tracking-wider text-red-300/80 mb-1">
                Message
              </div>
              <pre className="text-sm text-red-100 whitespace-pre-wrap break-words">
                {error.message}
              </pre>
            </div>
            {error.stack && (
              <details className="text-xs text-red-100/80">
                <summary className="cursor-pointer text-red-200">Stack trace</summary>
                <pre className="mt-2 whitespace-pre-wrap break-words">{error.stack}</pre>
              </details>
            )}
            {info?.componentStack && (
              <details className="text-xs text-red-100/80">
                <summary className="cursor-pointer text-red-200">Component stack</summary>
                <pre className="mt-2 whitespace-pre-wrap break-words">
                  {info.componentStack}
                </pre>
              </details>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={this.handleReset}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100"
            >
              Réessayer
            </button>
            <button
              onClick={this.handleReload}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              Recharger la page
            </button>
          </div>
        </div>
      </div>
    );
  }
}
