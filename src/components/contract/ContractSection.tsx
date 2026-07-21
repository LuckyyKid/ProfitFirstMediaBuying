import React from "react";

export const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="mb-7">
    {title && (
      <h2
        className="font-bold uppercase mb-3 pb-1 border-b-2 border-black tracking-wider"
        style={{ fontFamily: "'Times New Roman', serif", fontSize: "13px", letterSpacing: "0.08em" }}
      >
        {title}
      </h2>
    )}
    <div className="contract-body text-justify" style={{ hyphens: "auto" }}>
      {children}
    </div>
  </section>
);

export const pageStyle: React.CSSProperties = {
  fontFamily: "'Times New Roman', serif",
  width: "210mm",
  minHeight: "297mm",
  fontSize: "13px",
  lineHeight: "1.65",
  color: "#0a0a0a",
  boxSizing: "border-box",
};

export const pageClassName =
  "contract-page bg-white text-black px-12 sm:px-16 py-14 max-w-[210mm] mx-auto shadow-[0_2px_24px_-12px_rgba(0,0,0,0.25)] border border-black/80 relative";
