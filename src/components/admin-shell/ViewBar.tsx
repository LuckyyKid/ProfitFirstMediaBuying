import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, ListFilter, Search } from "lucide-react";

export function ViewBar({
  search,
  onSearchChange,
  searchPlaceholder = "Rechercher…",
  filters,
  activeFilter,
  onFilterChange,
  total,
  grandTotal,
  extra,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder?: string;
  filters?: ReadonlyArray<{ key: string; label: string }>;
  activeFilter?: string;
  onFilterChange?: (key: string) => void;
  total: number;
  grandTotal?: number;
  extra?: ReactNode;
}) {
  return (
    <div className="h-10 flex items-center gap-2 px-4 md:px-6 border-b border-border bg-background shrink-0">
      <div className="relative w-64 max-w-full">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <Input
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-7 pl-8 pr-2 text-xs bg-background border-border focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-0"
        />
      </div>
      {filters && filters.length > 0 && onFilterChange && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs hover:bg-muted gap-1">
              <ListFilter className="h-3.5 w-3.5" />
              Filtre
              <ChevronDown className="h-3 w-3 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {filters.map((f) => (
              <DropdownMenuItem
                key={f.key}
                onClick={() => onFilterChange(f.key)}
                className={activeFilter === f.key ? "bg-muted" : ""}
              >
                {f.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {extra}
      <div className="ml-auto flex items-center gap-2 text-[11px] text-muted-foreground tabular-nums">
        <span>{total}</span>
        {grandTotal !== undefined && (
          <>
            <span className="opacity-40">/</span>
            <span>{grandTotal}</span>
          </>
        )}
      </div>
    </div>
  );
}
