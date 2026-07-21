import type { ReactNode } from "react";

export function InsightStrip({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-stretch gap-0 px-4 md:px-6 py-2 border-b border-border bg-background overflow-x-auto shrink-0">
      {children}
    </div>
  );
}

export function StatPill({
  label,
  value,
  tone,
  onClick,
  active,
}: {
  label: string;
  value: number | string;
  tone?: "red" | "green" | "amber" | "blue";
  onClick?: () => void;
  active?: boolean;
}) {
  const toneClass =
    tone === "red" ? "text-red-600" :
    tone === "green" ? "text-emerald-600" :
    tone === "amber" ? "text-amber-600" :
    tone === "blue" ? "text-primary" :
    "text-foreground";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-baseline gap-2 px-3 py-1 rounded-md text-left transition-colors ${
        onClick ? "hover:bg-muted cursor-pointer" : "cursor-default"
      } ${active ? "bg-muted" : ""}`}
    >
      <span className={`text-lg font-semibold tabular-nums leading-none ${toneClass}`}>{value}</span>
      <span className="text-[11px] text-muted-foreground uppercase tracking-wider">{label}</span>
    </button>
  );
}
