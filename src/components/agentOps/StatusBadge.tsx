import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { decisionClass, runStatusClass } from "@/agentOps/statusColors";

export function StatusBadge({ status, className }: { status?: string | null; className?: string }) {
  const text = (status ?? "unknown").replace(/_/g, " ");
  return <Badge variant="outline" className={cn("font-medium uppercase tracking-wide text-[10px]", runStatusClass(status), className)}>{text}</Badge>;
}

export function DecisionBadge({ decision, className }: { decision?: string | null; className?: string }) {
  const text = (decision ?? "PENDING").replace(/_/g, " ");
  return <Badge variant="outline" className={cn("font-semibold uppercase tracking-wide text-[10px]", decisionClass(decision), className)}>{text}</Badge>;
}
