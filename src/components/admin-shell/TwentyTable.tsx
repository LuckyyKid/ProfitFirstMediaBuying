import type { ReactNode } from "react";

export function TwentyTableWrap({ children }: { children: ReactNode }) {
  return <div className="flex-1 overflow-auto">{children}</div>;
}

export function TwentyTable({ children }: { children: ReactNode }) {
  return <table className="w-full text-xs border-collapse">{children}</table>;
}

export function TwentyThead({ children }: { children: ReactNode }) {
  return (
    <thead className="sticky top-0 z-10 bg-secondary/70 backdrop-blur">
      <tr className="border-b border-border">{children}</tr>
    </thead>
  );
}

export function Th({ className = "", children }: { className?: string; children?: ReactNode }) {
  return (
    <th className={`text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground py-2 px-3 ${className}`}>
      {children}
    </th>
  );
}

export function TwentyRow({
  children,
  archived,
  className = "",
}: {
  children: ReactNode;
  archived?: boolean;
  className?: string;
}) {
  return (
    <tr className={`group border-b border-border hover:bg-muted/40 transition-colors ${archived ? "opacity-60" : ""} ${className}`}>
      {children}
    </tr>
  );
}

export function Td({ className = "", children, colSpan }: { className?: string; children?: ReactNode; colSpan?: number }) {
  return (
    <td colSpan={colSpan} className={`py-1.5 px-3 text-xs text-foreground align-middle ${className}`}>
      {children}
    </td>
  );
}

export function EmptyRow({
  colSpan,
  title = "Aucun résultat",
  hint,
}: {
  colSpan: number;
  title?: string;
  hint?: string;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="text-center py-16">
        <div className="text-sm text-muted-foreground">{title}</div>
        {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
      </td>
    </tr>
  );
}

export function LoadingRow({ colSpan }: { colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="text-center py-10 text-muted-foreground text-sm">Chargement…</td>
    </tr>
  );
}
