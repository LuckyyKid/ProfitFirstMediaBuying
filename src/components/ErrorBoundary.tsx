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
      <div className="min-h-screen flex items-center justify-center p-6 bg-background text-foreground">
        <div className="max-w-2xl w-full space-y-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-[#ff6b6b]">
            Erreur interface
          </div>
          <h1 className="text-2xl font-medium tracking-[-0.02em] text-foreground">
            Un écran <span className="font-serif italic text-[#9ec8ff]">imprévu</span> — je fixe.
          </h1>
          <p className="text-[#c8d2e4]">
            Le contenu ne s'est pas affiché à cause d'une exception. Envoie-moi le
            message ci-dessous et je corrige.
          </p>
          <div className="card-alert p-4 space-y-3">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-[#ff6b6b] mb-1">
                Message
              </div>
              <pre className="text-sm text-[#ff8b8b] whitespace-pre-wrap break-words font-mono">
                {error.message}
              </pre>
            </div>
            {error.stack && (
              <details className="text-xs text-[#c8d2e4]">
                <summary className="cursor-pointer text-[#9ec8ff]">Stack trace</summary>
                <pre className="mt-2 whitespace-pre-wrap break-words font-mono">{error.stack}</pre>
              </details>
            )}
            {info?.componentStack && (
              <details className="text-xs text-[#c8d2e4]">
                <summary className="cursor-pointer text-[#9ec8ff]">Component stack</summary>
                <pre className="mt-2 whitespace-pre-wrap break-words font-mono">
                  {info.componentStack}
                </pre>
              </details>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={this.handleReset}
              className="btn-secondary-hairline px-4 py-2 rounded-[10px] text-sm font-semibold"
            >
              Réessayer
            </button>
            <button
              onClick={this.handleReload}
              className="btn-primary-gradient px-4 py-2 rounded-[10px] text-sm"
            >
              Recharger la page
            </button>
          </div>
        </div>
      </div>
    );
  }
}
