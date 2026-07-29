import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Cloud } from "lucide-react";

export const STATUSES = ["Not Started", "In Progress", "Ready for Review", "Needs AM Review", "Approved", "Completed"] as const;
export type CrmStatus = typeof STATUSES[number];

const GOOD = "bg-[rgba(122,232,180,0.08)] text-[hsl(var(--good))] border-[rgba(122,232,180,0.3)]";
const INFO = "bg-[rgba(77,159,255,0.08)] text-[#9ec8ff] border-[rgba(77,159,255,0.3)]";
const WATCH = "bg-[rgba(255,184,77,0.08)] text-[hsl(var(--watch))] border-[rgba(255,184,77,0.3)]";
const BAD = "bg-[rgba(255,107,107,0.08)] text-[hsl(var(--bad))] border-[rgba(255,107,107,0.3)]";
const MUTED = "bg-[rgba(148,170,215,0.06)] text-[#c8d2e4] border-[rgba(148,170,215,0.15)]";

export function StatusBadge({ status }: { status?: string | null }) {
  const s = status ?? "Not Started";
  const cls =
    s === "Approved" || s === "Completed" ? GOOD
    : s === "Needs AM Review" ? WATCH
    : s === "Ready for Review" ? INFO
    : s === "In Progress" ? INFO
    : MUTED;
  return <Badge variant="outline" className={cls}>{s}</Badge>;
}

export function RiskBadge({ level }: { level?: string | null }) {
  const l = level ?? "Low";
  const cls =
    l === "High" ? BAD
    : l === "Medium" ? WATCH
    : GOOD;
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
