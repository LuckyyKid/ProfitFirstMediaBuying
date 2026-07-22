// TDIA Premium Dark — primitives.
// Small, composable building blocks used across Ma Journée, Mode Guidé,
// and any GOS page that adopts the Premium Dark design system.
//
// Convention: inline styles (matches the rest of GosLayout / Sidebar).
// No shadcn dependency here — this library is self-contained.

import { ReactNode, CSSProperties, ButtonHTMLAttributes } from "react";

/* ---------- MicroLabel ----------------------------------------------------- */

export function MicroLabel({
  children,
  color,
  style,
}: {
  children: ReactNode;
  color?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className="microlabel"
      style={{ color: color ?? "#8b97ad", ...style }}
    >
      {children}
    </span>
  );
}

/* ---------- StatusDot ------------------------------------------------------ */

export type Status = "good" | "watch" | "bad" | "missing";

const STATUS_COLOR: Record<Status, string> = {
  good: "#3ddc97",
  watch: "#f5b74e",
  bad: "#ff6b6b",
  missing: "#8b97ad",
};

const STATUS_LABEL: Record<Status, string> = {
  good: "GOOD",
  watch: "WATCH",
  bad: "BAD",
  missing: "MISSING",
};

export function StatusDot({
  status,
  label,
  size = 6,
  showLabel = true,
}: {
  status: Status;
  label?: string;
  size?: number;
  showLabel?: boolean;
}) {
  const color = STATUS_COLOR[status];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <span
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: color,
          boxShadow: `0 0 8px ${color}cc`,
          display: "inline-block",
          flexShrink: 0,
        }}
      />
      {showLabel && (
        <span
          className="microlabel"
          style={{ color, fontSize: 10, letterSpacing: "0.16em" }}
        >
          {label ?? STATUS_LABEL[status]}
        </span>
      )}
    </span>
  );
}

/* ---------- CardPremium ---------------------------------------------------- */

export function CardPremium({
  children,
  padding = 20,
  style,
  className = "",
}: {
  children: ReactNode;
  padding?: number | string;
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <div
      className={`card-premium ${className}`}
      style={{ padding, ...style }}
    >
      {children}
    </div>
  );
}

/* ---------- HeroCard (gradient border) ----------------------------------- */

export function HeroCard({
  children,
  padding = "28px 32px",
  style,
}: {
  children: ReactNode;
  padding?: string | number;
  style?: CSSProperties;
}) {
  return (
    <div className="card-hero-wrap" style={style}>
      <div className="card-hero-inner" style={{ padding }}>
        {children}
      </div>
    </div>
  );
}

/* ---------- Buttons -------------------------------------------------------- */

export function ButtonPrimary({
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className="gos-btn-primary" {...rest}>
      {children}
    </button>
  );
}

export function ButtonSecondary({
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className="gos-btn-secondary" {...rest}>
      {children}
    </button>
  );
}

/* ---------- Hairline ------------------------------------------------------- */

export function Hairline({ style }: { style?: CSSProperties }) {
  return <div className="hairline-h" style={{ margin: "12px 0", ...style }} />;
}
