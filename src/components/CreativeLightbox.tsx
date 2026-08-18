// Lightbox partagé pour agrandir une vignette créative — utilisé dans
// MetaAdsDashboard (AdThumbnail) et dans les rapports (ClientReportView).
// referrerPolicy="no-referrer" est indispensable pour que le CDN Meta
// (scontent.fbcdn.net) ne rejette pas la requête avec un 403.

import { useEffect } from "react";

const MONO = "'JetBrains Mono', ui-monospace, monospace";

interface Props {
  url: string;
  name?: string;
  onClose: () => void;
}

export function CreativeLightbox({ url, name, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    // Bloque le scroll de la page derrière le modal, restauré à la fermeture.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={name ?? "Aperçu créative"}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(6,9,16,.92)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 32,
        cursor: "zoom-out",
      }}
    >
      <img
        src={url}
        alt=""
        referrerPolicy="no-referrer"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "min(100%, 1200px)",
          maxHeight: "calc(100vh - 120px)",
          objectFit: "contain",
          borderRadius: 10,
          boxShadow: "0 24px 80px rgba(0,0,0,.6)",
          cursor: "default",
        }}
      />
      <button
        type="button"
        onClick={onClose}
        aria-label="Fermer"
        style={{
          position: "absolute",
          top: 20,
          right: 20,
          width: 36,
          height: 36,
          borderRadius: 999,
          border: "1px solid rgba(148,170,215,.22)",
          background: "rgba(255,255,255,.06)",
          color: "#eef2fa",
          fontSize: 18,
          lineHeight: 1,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "inherit",
        }}
      >
        ×
      </button>
      {name && (
        <div
          style={{
            position: "absolute",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            padding: "8px 18px",
            background: "rgba(255,255,255,.06)",
            border: "1px solid rgba(148,170,215,.22)",
            borderRadius: 999,
            color: "#eef2fa",
            fontSize: 11,
            fontFamily: MONO,
            letterSpacing: ".14em",
            textTransform: "uppercase",
            maxWidth: "80vw",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {name}
        </div>
      )}
    </div>
  );
}
