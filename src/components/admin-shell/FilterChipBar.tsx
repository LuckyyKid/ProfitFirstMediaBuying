import type { ReactNode } from "react";
import { Filter, X } from "lucide-react";

export function FilterChipBar({
  chips,
  onReset,
}: {
  chips: Array<{ key: string; label: ReactNode; onRemove: () => void }>;
  onReset?: () => void;
}) {
  if (chips.length === 0) return null;
  return (
    <div className="min-h-8 flex items-center gap-1.5 px-4 md:px-6 py-1.5 border-b border-border bg-background shrink-0">
      <Filter className="h-3 w-3 text-muted-foreground" />
      {chips.map((c) => (
        <Chip key={c.key} onRemove={c.onRemove}>{c.label}</Chip>
      ))}
      {onReset && (
        <button onClick={onReset} className="ml-auto text-[11px] text-muted-foreground hover:text-foreground">
          Réinitialiser
        </button>
      )}
    </div>
  );
}

export function Chip({ children, onRemove }: { children: ReactNode; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 h-6 pl-2 pr-1 rounded-md bg-muted border border-border text-[11px] text-foreground">
      {children}
      <button onClick={onRemove} className="h-4 w-4 rounded-sm hover:bg-background inline-flex items-center justify-center">
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}
