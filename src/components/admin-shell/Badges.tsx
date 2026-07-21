import type { ReactNode } from "react";

export function StatusPill({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium border ${className || "bg-muted text-muted-foreground border-border"}`}
    >
      {children}
    </span>
  );
}

export function StepDot({ done }: { done: boolean }) {
  return (
    <span className={`inline-block h-1.5 w-1.5 rounded-full ${done ? "bg-emerald-500" : "bg-muted-foreground/30"}`} />
  );
}
