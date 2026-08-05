// Dashboard TDIA — liste les runs recents (locaux + tracked) avec leur etat
// reel derive de status.json. Aucun step invente : ce qui est affiche = ce qui
// se passe vraiment cote pipeline.

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { tdia } from "@/agentOps/service";
import type { AuditRun, AuditState, Client } from "@/agentOps/types";
import { STALL_THRESHOLD_MS, STEP_LABELS } from "@/agentOps/types";
import { BackendErrorBanner } from "@/components/agentOps/Primitives";
import { getTrackedRuns, untrackRun } from "@/agentOps/trackedRuns";
import { statusTone, shortStatusLabel, toneClasses, toneDotClass } from "@/agentOps/humanStatus";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, FileSpreadsheet, Rocket, Users } from "lucide-react";
import { cn } from "@/lib/utils";

function effectiveState(r: { state: AuditState; last_step_ts?: number | null }, now: number): AuditState {
  if (r.state === "completed" || r.state === "failed" || r.state === "queued") return r.state;
  if (r.last_step_ts && now - r.last_step_ts * 1000 > STALL_THRESHOLD_MS) return "stalled";
  return r.state;
}

function timeAgoTs(ts: number, now: number): string {
  if (!ts) return "—";
  const diff = Math.max(0, now - ts * 1000);
  const s = Math.floor(diff / 1000);
  if (s < 60) return `il y a ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `il y a ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h}h`;
  return `il y a ${Math.floor(h / 24)}j`;
}

export default function Dashboard() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(t);
  }, []);

  const clientsQ = useQuery({
    queryKey: ["clients"],
    queryFn: () => tdia.listClients(),
    refetchInterval: 30_000,
  });

  const [trackedIds, setTrackedIds] = useState(() => getTrackedRuns());

  // Combine: latest audit for each client (via /clients response) + tracked runs
  // (utile pour voir un run en cours qu'on vient de lancer).
  const clientAuditsQ = useQuery({
    queryKey: ["client-audits", clientsQ.data?.map((c) => c.slug).join(",")],
    queryFn: async () => {
      const results: AuditRun[] = [];
      const clients = clientsQ.data ?? [];
      // Fetch details for the latest audit of each client
      await Promise.all(
        clients
          .filter((c) => c.latest_audit_id)
          .map(async (c) => {
            try {
              const r = await tdia.getAudit(c.slug, c.latest_audit_id!);
              results.push(r);
            } catch { /* ignore */ }
          }),
      );
      // Also fetch any tracked runs not already in the list
      const seen = new Set(results.map((r) => `${r.client}/${r.audit_id}`));
      await Promise.all(
        trackedIds.map(async (t) => {
          const key = `${t.slug}/${t.auditId}`;
          if (seen.has(key)) return;
          try {
            const r = await tdia.getAudit(t.slug, t.auditId);
            results.push(r);
          } catch {
            untrackRun(t.slug, t.auditId);
          }
        }),
      );
      setTrackedIds(getTrackedRuns());
      return results;
    },
    enabled: !!clientsQ.data,
    refetchInterval: 5_000,
  });

  const runs = useMemo(() => {
    const list = clientAuditsQ.data ?? [];
    return [...list].sort((a, b) => (b.last_step_ts || 0) - (a.last_step_ts || 0));
  }, [clientAuditsQ.data]);

  const active = runs.filter((r) => {
    const s = effectiveState(r, now);
    return s === "running" || s === "queued" || s === "stalled";
  });
  const completed = runs.filter((r) => r.state === "completed");
  const failed = runs.filter((r) => r.state === "failed");

  const err = clientsQ.error instanceof Error ? clientsQ.error.message : undefined;

  return (
    <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
      {err && <BackendErrorBanner message={err} />}

      {/* Top stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Clients" value={clientsQ.data?.length ?? 0} icon={<Users className="h-4 w-4" />} />
        <StatCard label="Runs en cours" value={active.length} accent="running" />
        <StatCard label="Terminés" value={completed.length} accent="completed" />
        <StatCard label="Échecs" value={failed.length} accent="failed" />
      </div>

      {/* Active runs */}
      {active.length > 0 && (
        <section>
          <SectionTitle title="En cours" sub="Runs actifs ou bloqués" />
          <div className="space-y-2 mt-3">
            {active.map((r) => <RunRow key={`${r.client}/${r.audit_id}`} run={r} now={now} />)}
          </div>
        </section>
      )}

      {/* Empty state */}
      {runs.length === 0 && (
        <Card className="glass-card p-10 text-center">
          <Rocket className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
          <div className="text-lg font-medium">Aucun run pour l'instant</div>
          <div className="text-sm text-muted-foreground mt-1">
            Lance un premier audit — le pipeline collecte les données brutes et produit un reviews.xlsx à uploader dans une conversation IA.
          </div>
          <Button asChild className="mt-4">
            <Link to="/admin/ops/new">Nouvel audit <ArrowRight className="h-4 w-4 ml-1.5" /></Link>
          </Button>
        </Card>
      )}

      {/* Recent completed */}
      {completed.length > 0 && (
        <section>
          <SectionTitle
            title="Terminés récents"
            sub="Livrables téléchargeables — reviews.xlsx (pour IA) + audit_data.xlsx (pour AM)"
          />
          <div className="space-y-2 mt-3">
            {completed.slice(0, 10).map((r) => <RunRow key={`${r.client}/${r.audit_id}`} run={r} now={now} />)}
          </div>
        </section>
      )}

      {/* Failed */}
      {failed.length > 0 && (
        <section>
          <SectionTitle title="Échecs" sub="Voir la timeline du run pour la trace complète" />
          <div className="space-y-2 mt-3">
            {failed.slice(0, 5).map((r) => <RunRow key={`${r.client}/${r.audit_id}`} run={r} now={now} />)}
          </div>
        </section>
      )}
    </div>
  );
}

function SectionTitle({ title, sub }: { title: string; sub: string }) {
  return (
    <div>
      <h2 className="font-mono text-[10px] font-semibold uppercase tracking-[0.25em] text-[#9ec8ff]">{title}</h2>
      <p className="text-xs text-muted-foreground mt-1">{sub}</p>
    </div>
  );
}

function StatCard({
  label, value, icon, accent,
}: { label: string; value: number; icon?: React.ReactNode; accent?: "running" | "completed" | "failed" }) {
  const color =
    accent === "running" ? "text-[#9ec8ff]" :
    accent === "completed" ? "text-[hsl(var(--good))]" :
    accent === "failed" ? "text-[hsl(var(--bad))]" :
    "text-foreground";
  return (
    <Card className="glass-card p-4">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </div>
      <div className={cn("text-2xl font-semibold mt-1.5 tabular-nums", color)}>{value}</div>
    </Card>
  );
}

function RunRow({ run, now }: { run: AuditRun; now: number }) {
  const state = effectiveState(run, now);
  const tone = statusTone(state);
  const currentLabel = run.current ? (STEP_LABELS[run.current] ?? run.current) : "—";
  const hasReviews = run.artifacts.some((a) => a.kind === "reviews_xlsx" || a.kind === "reviews_csv");

  return (
    <Link
      to={`/admin/ops/run/${encodeURIComponent(run.client)}/${encodeURIComponent(run.audit_id)}`}
      className="block rounded-lg border border-[rgba(148,170,215,0.12)] bg-[rgba(255,255,255,0.02)] hover:border-[rgba(77,159,255,0.3)] hover:bg-[rgba(77,159,255,0.03)] transition-colors"
    >
      <div className="px-4 py-3 flex items-center gap-4">
        <span className={cn("h-2 w-2 rounded-full shrink-0", toneDotClass(tone))} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="font-medium truncate">{run.onboarding_name ?? run.client}</div>
            <Badge variant="outline" className={cn("text-[9px] uppercase shrink-0", toneClasses(tone))}>
              {shortStatusLabel(state)}
            </Badge>
            {hasReviews && (
              <span className="inline-flex items-center gap-1 text-[10px] text-[#9ec8ff]" title="reviews.xlsx disponible">
                <FileSpreadsheet className="h-3 w-3" /> XLSX
              </span>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5 font-mono flex flex-wrap gap-x-3">
            <span>{run.audit_id}</span>
            <span>· étape : {currentLabel}</span>
            {run.last_step_ts ? <span>· {timeAgoTs(run.last_step_ts, now)}</span> : null}
          </div>
        </div>
        <div className="w-32 shrink-0">
          <div className="text-[10px] text-muted-foreground font-mono text-right mb-1">
            {run.steps_done}/{run.steps_total}
          </div>
          <div className="h-[3px] rounded-full bg-[rgba(148,170,215,0.12)] overflow-hidden">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,#4d9fff,#2f6bff)]"
              style={{ width: `${run.progress}%` }}
            />
          </div>
        </div>
      </div>
    </Link>
  );
}
