import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { HelpCircle, X, Play } from "lucide-react";
import { tourKeyForPath, startTour } from "./tours";

export type HelpContent = {
  title: string;
  purpose?: string;
  dataSource?: string;
  usedBy?: string;
  requiredInputs?: string[];
  missingInputs?: string[];
  nextStep?: string;
  primaryCta?: string;
  tips?: string[];
};

type Ctx = {
  content: HelpContent | null;
  setContent: (c: HelpContent | null) => void;
  open: boolean;
  setOpen: (v: boolean) => void;
};

const HelpCtx = createContext<Ctx>({
  content: null, setContent: () => {}, open: false, setOpen: () => {},
});

export function HelpProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<HelpContent | null>(null);
  const [open, setOpen] = useState(false);
  return (
    <HelpCtx.Provider value={{ content, setContent, open, setOpen }}>
      {children}
    </HelpCtx.Provider>
  );
}

/** Called by SectionHeader/PageGuide to publish the current page's help content. */
export function useRegisterHelp(content: HelpContent | null) {
  const { setContent } = useContext(HelpCtx);
  useEffect(() => {
    setContent(content);
    return () => setContent(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(content)]);
}

/** Push HelpContent into the drawer and open it, from anywhere under
 *  HelpProvider (e.g. the sidebar, on a per-item info click) without
 *  waiting for a page to call useRegisterHelp(). */
export function useHelpDispatch() {
  const { setContent, setOpen } = useContext(HelpCtx);
  return {
    showHelp: (content: HelpContent) => { setContent(content); setOpen(true); },
  };
}

export function HelpButton() {
  const { setOpen, content } = useContext(HelpCtx);
  const loc = useLocation();
  const tourKey = tourKeyForPath(loc.pathname);
  return (
    <div style={{ position: "fixed", right: 20, bottom: 20, zIndex: 60, display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
      {tourKey && (
        <button
          className="gos-btn-secondary"
          onClick={() => startTour(tourKey)}
          style={{ display: "flex", alignItems: "center", gap: 6, boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }}
        >
          <Play size={14} /> Lancer le tour guidé
        </button>
      )}
      <button
        aria-label="Aide"
        onClick={() => setOpen(true)}
        disabled={!content}
        title={content ? "Ouvrir l'aide de cette page" : "Aucune aide pour cette page"}
        style={{
          width: 52, height: 52, borderRadius: "50%",
          background: "var(--tdia-blue)", color: "white", border: "none",
          cursor: content ? "pointer" : "not-allowed",
          opacity: content ? 1 : 0.5,
          boxShadow: "0 6px 18px rgba(0,0,0,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <HelpCircle size={22} />
      </button>
    </div>
  );
}

export function HelpDrawer() {
  const { content, open, setOpen } = useContext(HelpCtx);
  const loc = useLocation();
  const tourKey = tourKeyForPath(loc.pathname);
  if (!open || !content) return null;
  return (
    <>
      <div
        onClick={() => setOpen(false)}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 70 }}
      />
      <aside style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: 420, maxWidth: "90vw",
        background: "hsl(220 45% 12%)", zIndex: 71,
        borderLeft: "1px solid var(--tdia-border)",
        overflow: "auto", padding: 20,
        boxShadow: "-10px 0 30px rgba(0,0,0,0.5)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--tdia-muted)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Aide contextuelle</div>
            <div style={{ fontSize: 18, fontWeight: 600, marginTop: 4, color: "var(--tdia-text)" }}>{content.title}</div>
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label="Fermer"
            style={{ background: "transparent", border: "none", color: "var(--tdia-muted)", cursor: "pointer" }}
          >
            <X size={20} />
          </button>
        </div>

        {tourKey && (
          <button
            className="gos-btn-primary"
            onClick={() => { setOpen(false); startTour(tourKey); }}
            style={{ width: "100%", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
          >
            <Play size={14} /> Lancer le tour guidé
          </button>
        )}

        <div style={{ display: "grid", gap: 12 }}>
          {content.purpose && <HelpBlock label="Objectif" text={content.purpose} />}
          {content.dataSource && <HelpBlock label="Source de données" text={content.dataSource} />}
          {content.usedBy && <HelpBlock label="Utilisé par" text={content.usedBy} />}
          {content.requiredInputs && content.requiredInputs.length > 0 && (
            <HelpBlock label="Entrées requises" items={content.requiredInputs} />
          )}
          {content.missingInputs && content.missingInputs.length > 0 && (
            <HelpBlock label="Manquant" items={content.missingInputs} tone="danger" />
          )}
          {content.nextStep && <HelpBlock label="Prochaine étape" text={content.nextStep} tone="accent" />}
          {content.primaryCta && <HelpBlock label="Action principale" text={content.primaryCta} />}
          {content.tips && content.tips.length > 0 && (
            <HelpBlock label="Astuces" items={content.tips} />
          )}
        </div>

        <div style={{ marginTop: 20, fontSize: 11, color: "var(--tdia-muted)", lineHeight: 1.5 }}>
          Besoin de plus ? Ouvre le workspace client pour voir le contexte global, ou consulte la Manual Data Checklist pour vérifier la qualité des données.
        </div>
      </aside>
    </>
  );
}

function HelpBlock({ label, text, items, tone }: { label: string; text?: string; items?: string[]; tone?: "danger" | "accent" }) {
  const color = tone === "danger" ? "#ff6b7a" : tone === "accent" ? "var(--tdia-blue)" : "var(--tdia-text)";
  return (
    <div className="gos-card" style={{ padding: 12 }}>
      <div style={{ fontSize: 10, color: "var(--tdia-muted)", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
      {text && <div style={{ fontSize: 13, color, lineHeight: 1.5 }}>{text}</div>}
      {items && (
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color, lineHeight: 1.5 }}>
          {items.map((i, idx) => <li key={idx}>{i}</li>)}
        </ul>
      )}
    </div>
  );
}
