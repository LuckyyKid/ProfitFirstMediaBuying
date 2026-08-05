// Moniteur d'un run tdia-audit. Affiche l'etat reel du pipeline (status.json)
// et pas 7 fake engines. URL: /admin/ops/run/:slug/:auditId
// Le pipeline actuel fait uniquement collecte + Excel — pas de PDF strategique.

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { tdia } from "@/agentOps/service";
import { trackRun } from "@/agentOps/trackedRuns";
import type { AuditRun, AuditStep } from "@/agentOps/types";
import { STEP_LABELS, STALL_THRESHOLD_MS } from "@/agentOps/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BackendErrorBanner } from "@/components/agentOps/Primitives";
import {
  formatDuration,
  humanStatusLabel,
  isTerminal,
  shortStatusLabel,
  statusTone,
  toneClasses,
  toneDotClass,
} from "@/agentOps/humanStatus";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ARTIFACT_ICONS: Record<string, typeof FileText> = {
  reviews_xlsx: FileSpreadsheet,
  reviews_csv: FileSpreadsheet,
  audit_data_xlsx: FileSpreadsheet,
  business_context: FileText,
};

function formatTs(ts?: number | null): string {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleTimeString("fr-CA", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function stepDuration(step: AuditStep, nextTs?: number | null): string {
  if (!nextTs || nextTs < step.ts) return "—";
  return formatDuration((nextTs - step.ts) * 1000);
}

function effectiveState(run: AuditRun, now: number): AuditRun["state"] {
  if (run.state === "completed" || run.state === "failed" || run.state === "queued") {
    return run.state;
  }
  // running mais dernier step > seuil = stalled
  if (run.last_step_ts && (now - run.last_step_ts * 1000) > STALL_THRESHOLD_MS) {
    return "stalled";
  }
  return run.state;
}

export default function RunMonitor() {
  const { slug = "", auditId = "" } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (slug && auditId) trackRun(slug, auditId);
  }, [slug, auditId]);

  const runQ = useQuery({
    queryKey: ["audit", slug, auditId],
    queryFn: () => tdia.getAudit(slug, auditId),
    enabled: Boolean(slug && auditId),
    refetchInterval: (q) => {
      const data = q.state.data as AuditRun | undefined;
      return isTerminal(data?.state) ? false : 3000;
    },
    retry: 1,
  });

  // Ticker pour "il y a Xs" et detection de stall en temps reel
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const run = runQ.data;

  if (runQ.isLoading && !run) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-6 space-y-3">
        <div className="h-10 w-2/3 rounded bg-card/40 animate-pulse" />
        <div className="h-24 rounded bg-card/40 animate-pulse" />
        <div className="h-64 rounded bg-card/40 animate-pulse" />
      </div>
    );
  }

  if (!run) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-6 space-y-4">
        <Button variant="ghost" size="sm" onClick={() => nav("/admin/ops")}>
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Retour
        </Button>
        <BackendErrorBanner
          message={runQ.error instanceof Error ? runQ.error.message : "Run introuvable."}
        />
      </div>
    );
  }

  const state = effectiveState(run, now);
  const tone = statusTone(state);
  const lastActivityMs = run.last_step_ts ? now - run.last_step_ts * 1000 : 0;
  const runIdShort = `${run.audit_id}`;

  return (
    <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">
      {/* Header */}
      <div className="relative rounded-[14px] border border-[rgba(148,170,215,0.12)] bg-[rgba(255,255,255,0.02)] overflow-hidden shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(600px 200px at 80% 30%, rgba(47,107,255,0.1), transparent 60%)" }}
        />
        <div className="relative px-5 py-4 flex items-center gap-4 flex-wrap">
          <button
            onClick={() => nav("/admin/ops")}
            className="h-9 w-9 rounded-[10px] border border-[rgba(148,170,215,0.12)] bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.05)] flex items-center justify-center text-[#c8d2e4] shrink-0 transition-colors"
            aria-label="Retour"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-[#9ec8ff]">
              <span className={cn("h-1.5 w-1.5 rounded-full", toneDotClass(tone))} />
              {humanStatusLabel(state)}
            </div>
            <div className="text-lg md:text-xl font-medium text-foreground mt-0.5 tracking-[-0.02em] truncate">
              {run.onboarding_name ?? run.client}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-[#5f6b82] mt-0.5 font-mono">
              <span>{runIdShort}</span>
              <button
                onClick={() => navigator.clipboard.writeText(`${run.client}/${run.audit_id}`)}
                className="hover:text-[#9ec8ff]"
                title="Copier client/audit_id"
              >
                <Copy className="h-3 w-3" />
              </button>
              <span>·</span>
              <span>{run.client}</span>
              {run.onboarding_website && (
                <>
                  <span>·</span>
                  <a
                    href={run.onboarding_website}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-[#9ec8ff] truncate"
                  >
                    {run.onboarding_website.replace(/^https?:\/\//, "")}
                  </a>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <div className="px-4 py-2 rounded-[12px] border border-[rgba(148,170,215,0.12)] bg-[rgba(255,255,255,0.02)] min-w-[14rem]">
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#5f6b82]">
                Progression
              </div>
              <div className="mt-1 flex items-center gap-2">
                <div className="flex-1 h-[3px] rounded-full bg-[rgba(148,170,215,0.12)] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,#4d9fff,#2f6bff)] shadow-[0_0_12px_rgba(77,159,255,0.5)] transition-[width] duration-700"
                    style={{ width: `${run.progress}%` }}
                  />
                </div>
                <span className="text-xs font-mono text-[#9ec8ff]">
                  {run.steps_done}/{run.steps_total}
                </span>
              </div>
            </div>
            <div className="px-3 py-2 rounded-[12px] border border-[rgba(148,170,215,0.12)] bg-[rgba(255,255,255,0.02)]">
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#5f6b82] flex items-center gap-1">
                <Clock className="h-3 w-3" /> Dernière activité
              </div>
              <div className="text-sm font-mono text-foreground mt-0.5">
                {run.last_step_ts ? formatDuration(lastActivityMs) : "—"}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                qc.invalidateQueries({ queryKey: ["audit", slug, auditId] })
              }
            >
              <RefreshCw className={cn("h-4 w-4 mr-1.5", runQ.isFetching && "animate-spin")} />
              Rafraîchir
            </Button>
          </div>
        </div>
      </div>

      {/* Stall warning */}
      {state === "stalled" && (
        <Card className="p-4 border-[rgba(255,184,77,0.3)] bg-[linear-gradient(135deg,rgba(255,184,77,0.06),rgba(255,255,255,0.015))]">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-[hsl(var(--watch))] mt-0.5" />
            <div>
              <div className="font-semibold text-[hsl(var(--watch))]">
                Aucune activité depuis {formatDuration(lastActivityMs)}
              </div>
              <div className="text-sm text-muted-foreground mt-0.5">
                Le worker peut être bloqué (rate-limit Apify, timeout LLM, worker mort).
                Vérifie les logs RQ côté serveur — le pipeline n'écrit plus dans status.json.
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Failed */}
      {state === "failed" && (
        <FailureCard run={run} />
      )}

      {/* Completed — livrables */}
      {state === "completed" && run.artifacts.length > 0 && (
        <Card className="p-5 border-[rgba(122,232,180,0.25)] bg-[linear-gradient(135deg,rgba(122,232,180,0.06),rgba(255,255,255,0.015))]">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-[hsl(var(--good))] mt-0.5" />
            <div className="flex-1">
              <div className="font-semibold">Collecte terminée</div>
              <div className="text-sm text-muted-foreground mt-0.5">
                Télécharge le reviews.xlsx pour l'uploader dans ta conversation IA.
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                {run.artifacts.map((a) => {
                  const Icon = ARTIFACT_ICONS[a.kind] ?? FileText;
                  const url = a.kind === "reviews_xlsx" || a.kind === "reviews_csv"
                    ? tdia.reviewsXlsxUrl(run.client, run.audit_id)
                    : a.kind === "audit_data_xlsx"
                      ? tdia.auditDataXlsxUrl(run.client, run.audit_id)
                      : null; // business_context = markdown lu inline plus bas
                  if (!url) return null;
                  return (
                    <Button key={a.kind} variant={a.kind === "reviews_xlsx" ? "default" : "outline"} asChild>
                      <a href={url} target="_blank" rel="noreferrer">
                        <Icon className="h-4 w-4 mr-1.5" />
                        {a.title}
                        <Download className="h-3.5 w-3.5 ml-2 opacity-60" />
                      </a>
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Contexte business inline si dispo */}
      {run.artifacts.some((a) => a.kind === "business_context") && (
        <BusinessContextCard slug={run.client} auditId={run.audit_id} />
      )}

      {/* Timeline des steps reels */}
      <StepsTimeline run={run} />
    </div>
  );
}

/* ============================== Timeline ============================== */

function StepsTimeline({ run }: { run: AuditRun }) {
  const stepEntries = useMemo(() => {
    // Ordre chronologique (basé sur ts). Si ts=0 on met a la fin.
    return Object.entries(run.steps).sort(([, a], [, b]) => (a.ts || 0) - (b.ts || 0));
  }, [run.steps]);

  return (
    <Card className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-mono text-[10px] font-semibold uppercase tracking-[0.25em] text-[#9ec8ff]">
            Pipeline · étapes réelles
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            {stepEntries.length === 0
              ? "Le worker n'a encore rien enregistré. Statut : en file d'attente."
              : `${run.steps_done} sur ${run.steps_total} étapes complétées${run.steps_error > 0 ? ` · ${run.steps_error} en erreur` : ""}.`}
          </p>
        </div>
      </div>

      {stepEntries.length === 0 ? (
        <div className="text-sm text-muted-foreground py-6 text-center">
          En attente du démarrage du worker…
        </div>
      ) : (
        <div className="space-y-1.5">
          {stepEntries.map(([name, step], idx) => {
            const nextTs = stepEntries[idx + 1]?.[1]?.ts;
            const tone = statusTone(step.state);
            return (
              <div
                key={name}
                className={cn(
                  "rounded-md border px-3 py-2 flex items-start gap-3 text-sm",
                  tone === "running"
                    ? "border-[rgba(77,159,255,0.4)] bg-[rgba(77,159,255,0.04)]"
                    : tone === "failed"
                      ? "border-[rgba(255,107,107,0.3)] bg-[rgba(255,107,107,0.03)]"
                      : "border-[rgba(148,170,215,0.12)] bg-[rgba(255,255,255,0.02)]",
                )}
              >
                <span className={cn("h-2 w-2 rounded-full mt-2 shrink-0", toneDotClass(tone))} />
                <span className="text-[10px] text-muted-foreground font-mono w-6 mt-1.5 shrink-0">
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <div className="flex-1 min-w-0">
                  <div className={cn("font-medium truncate", tone === "running" && "text-[#9ec8ff]")}>
                    {STEP_LABELS[name] ?? name}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 font-mono flex flex-wrap gap-x-3">
                    <span>{name}</span>
                    <span>· {formatTs(step.ts)}</span>
                    {tone === "done" || tone === "completed" ? (
                      <span>· durée {stepDuration(step, nextTs)}</span>
                    ) : null}
                  </div>
                  {step.detail && tone === "failed" && (
                    <div className="mt-1.5 text-[11px] text-[hsl(var(--bad))] font-mono whitespace-pre-wrap break-words max-h-32 overflow-y-auto bg-[rgba(255,107,107,0.05)] rounded p-2">
                      {step.detail}
                    </div>
                  )}
                </div>
                <Badge variant="outline" className={cn("text-[9px] uppercase shrink-0", toneClasses(tone))}>
                  {shortStatusLabel(step.state)}
                </Badge>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

/* ============================== Failure detail ============================== */

function FailureCard({ run }: { run: AuditRun }) {
  const failed = Object.entries(run.steps).find(([, s]) => s.state === "error");
  const [name, step] = failed ?? [null, null];
  return (
    <Card className="p-5 border-[rgba(255,107,107,0.3)] bg-[linear-gradient(135deg,rgba(255,107,107,0.06),rgba(255,255,255,0.015))]">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-[hsl(var(--bad))] mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-[hsl(var(--bad))]">Le pipeline a échoué</div>
          {name && step && (
            <>
              <div className="text-sm text-muted-foreground mt-0.5">
                Étape en erreur : <span className="font-mono text-foreground">{STEP_LABELS[name] ?? name}</span>
              </div>
              {step.detail && (
                <div className="mt-2 text-[11px] font-mono whitespace-pre-wrap break-words max-h-64 overflow-y-auto bg-[rgba(255,107,107,0.05)] rounded p-3">
                  {step.detail}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

/* ============================== Business context inline ============================== */

function BusinessContextCard({ slug, auditId }: { slug: string; auditId: string }) {
  const q = useQuery({
    queryKey: ["business-context", slug, auditId],
    queryFn: () => tdia.getBusinessContext(slug, auditId),
    staleTime: 60_000,
  });
  const [expanded, setExpanded] = useState(false);
  const md = q.data ?? "";
  const preview = expanded ? md : md.slice(0, 800);

  return (
    <Card className="glass-card p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-mono text-[10px] font-semibold uppercase tracking-[0.25em] text-[#9ec8ff]">
            Contexte business (LLM)
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Sortie de l'agent Contexte — utilisé pour déterminer le plan de collecte.
          </p>
        </div>
        {md.length > 800 && (
          <Button variant="ghost" size="sm" onClick={() => setExpanded((v) => !v)}>
            {expanded ? "Réduire" : "Tout afficher"}
            <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
          </Button>
        )}
      </div>
      {q.isLoading ? (
        <div className="h-24 rounded bg-card/40 animate-pulse" />
      ) : q.error ? (
        <div className="text-sm text-muted-foreground">Impossible de charger le contexte business.</div>
      ) : (
        <pre className="text-[12px] whitespace-pre-wrap font-sans text-foreground/85 leading-relaxed">
          {preview}
          {!expanded && md.length > 800 ? "…" : ""}
        </pre>
      )}
    </Card>
  );
}
