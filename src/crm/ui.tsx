import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Cloud } from "lucide-react";

export const STATUSES = ["Not Started", "In Progress", "Ready for Review", "Needs AM Review", "Approved", "Completed"] as const;
export type CrmStatus = typeof STATUSES[number];

export function StatusBadge({ status }: { status?: string | null }) {
  const s = status ?? "Not Started";
  const cls =
    s === "Approved" || s === "Completed" ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/30"
    : s === "Needs AM Review" ? "bg-amber-500/15 text-amber-500 border-amber-500/30"
    : s === "Ready for Review" ? "bg-blue-500/15 text-blue-500 border-blue-500/30"
    : s === "In Progress" ? "bg-primary/15 text-primary border-primary/30"
    : "bg-muted text-muted-foreground border-border";
  return <Badge variant="outline" className={cls}>{s}</Badge>;
}

export function RiskBadge({ level }: { level?: string | null }) {
  const l = level ?? "Low";
  const cls =
    l === "High" ? "bg-red-500/15 text-red-500 border-red-500/30"
    : l === "Medium" ? "bg-amber-500/15 text-amber-500 border-amber-500/30"
    : "bg-emerald-500/15 text-emerald-500 border-emerald-500/30";
  return <Badge variant="outline" className={cls}>{l}</Badge>;
}

export function ClickUpPlaceholder({ label = "Send to ClickUp" }: { label?: string }) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => toast("ClickUp integration will be connected in V2.")}
    >
      <Cloud className="h-3.5 w-3.5 mr-1.5" /> {label}
    </Button>
  );
}

export function SectionHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      {actions && <div className="flex gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}
