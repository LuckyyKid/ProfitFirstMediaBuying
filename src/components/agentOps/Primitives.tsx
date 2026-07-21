import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AlertTriangle, ShieldAlert } from "lucide-react";

/** Banner used on the current validation run to make clear it's NOT a substantive audit. */
// Validation placeholder banner intentionally disabled — render nothing.
export function PlaceholderBanner(_props: { className?: string; children?: React.ReactNode }) {
  return null;
}

export function BackendErrorBanner({ message, className }: { message?: string; className?: string }) {
  return (
    <div className={cn("rounded-md border border-red-500/30 bg-red-500/10 text-red-200 text-sm px-3 py-2 flex items-start gap-2", className)}>
      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
      <div>
        <div className="font-semibold">Backend unavailable</div>
        <div className="text-red-200/80 text-xs mt-0.5">{message ?? "Could not reach api.tdiaconnect.ca through the proxy. Check that TDIA_API_TOKEN is valid and the backend is online."}</div>
      </div>
    </div>
  );
}

export function SectionHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

export function KpiCard({ label, value, hint, tone }: { label: string; value: string | number; hint?: string; tone?: "default" | "success" | "warn" | "danger" }) {
  const toneClass =
    tone === "success" ? "text-emerald-300" :
    tone === "warn"    ? "text-orange-300" :
    tone === "danger"  ? "text-red-300" : "";
  return (
    <Card className="p-4 glass-card">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("text-2xl font-semibold mt-1", toneClass)}>{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
    </Card>
  );
}

/** Back-compat alias for older imports. */
export const MockBanner = PlaceholderBanner;
