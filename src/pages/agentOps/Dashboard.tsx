// src/pages/agentOps/Dashboard.tsx
//
// « Mission control » — un seul run actif développé (anneau + pipeline +
// télémétrie), le reste replié en tiroirs. Voir 5a-admin-ops-jarvis.png.
// Palette : bleu TDIA (#4d9fff / #2f6bff) + statuts good/watch/bad.

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { tdia } from "@/agentOps/service";
import type { Client, RunEvent, WorkflowRun } from "@/agentOps/types";
import { BackendErrorBanner } from "@/components/agentOps/Primitives";
import { getTrackedRuns, untrackRun } from "@/agentOps/trackedRuns";
import { statusTone, timeAgo } from "@/agentOps/humanStatus";

interface RunWithClient { run: WorkflowRun; client?: Client }

// ── Palette ─────────────────────────────────────────────────────────────────
const BG        = "#04060b";
const BLUE      = "#4d9fff";
const BLUE_DARK = "#2f6bff";
const GOOD      = "#3ddc97";
const WATCH     = "#f5b74e";
const BAD       = "#ff6b6b";
const HAIRLINE  = "rgba(148,170,215,0.10)";
const FAINT     = "rgba(148,170,215,0.70)";
const FAINTER   = "rgba(148,170,215,0.45)";
const TEXT      = "#f2f4fb";
const GLASS     = "rgba(255,255,255,0.012)";

// ── Pipeline blueprint (tdia-audit) ─────────────────────────────────────────
const STEPS = [
  { id: 1, label: "Agent Contexte — plan de collecte",     meta: "1 MIN 40" },
  { id: 2, label: "Collecte multi-sources",                meta: "" },
  { id: 3, label: "Agents VOC · Compétiteurs · Tendances", meta: "MAP-REDUCE" },
  { id: 4, label: "Agent CRO & Offre → ICP & Angles",      meta: "MIN. 15 ICP" },
  { id: 5, label: "Rapport — XLSX · CSV · PDF",            meta: "LIVRABLES AM" },
] as const;

const COLLECTORS = [
  { key: "trustpilot", label: "Trustpilot" },
  { key: "meta_ads",   label: "Meta Ads"   },
  { key: "reddit",     label: "Reddit"     },
  { key: "trends",     label: "Trends"     },
  { key: "pages",      label: "Pages"      },
] as const;

type CollectorStatus = "done" | "active" | "future";
type CollectorState  = { count?: number; status: CollectorStatus };

function stepFromProgress(progress?: number | null): number {
  const p = typeof progress === "number" ? progress : 0;
  if (p < 15) return 0;
  if (p < 45) return 1;
  if (p < 70) return 2;
  if (p < 90) return 3;
  return 4;
}

function pad(n: number): string { return n < 10 ? `0${n}` : String(n); }
function formatCount(n: number): string { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " "); }
function formatCost(usd: number): string { return `${usd.toFixed(2).replace(".", ",")} $`; }

// Rough ETA — total = elapsed / progress × 100 (progress ≥ 1 %).
function estimateEndClock(run: WorkflowRun): string {
  const start = run.started_at ?? run.created_at;
  const startMs = new Date(start).getTime();
  if (!startMs) return "—";
  const p = Math.max(1, Math.min(100, typeof run.progress === "number" ? run.progress : 30));
  const totalMs = (Date.now() - startMs) / p * 100;
  const eta = new Date(startMs + totalMs);
  return `${pad(eta.getHours())}:${pad(eta.getMinutes())}`;
}

// Rough cost heuristic tant que le backend n'expose pas run.cost_usd.
function estimateCost(run: WorkflowRun): number {
  const p = Math.max(0, Math.min(100, typeof run.progress === "number" ? run.progress : 0));
  return (p / 100) * 6.6;
}

// Parse la position et l'avancement des collectors à partir du flux d'events.
function deriveCollectors(events: RunEvent[], currentStep: number): Map<string, CollectorState> {
  const map = new Map<string, CollectorState>();
  for (const ev of events) {
    const data = ev.data as Record<string, unknown> | undefined;
    const source = String(data?.source ?? "").toLowerCase().replace(/-/g, "_");
    if (!source) continue;
    const raw = (data?.count ?? data?.items ?? data?.total) as unknown;
    const count = typeof raw === "number" ? raw : undefined;
    const isDone = ev.event_type.includes("complete") || ev.event_type.includes("done") || ev.event_type.includes("succeeded");
    const prev = map.get(source);
    map.set(source, { count: count ?? prev?.count, status: isDone ? "done" : "active" });
  }
  // Étape 2 non atteinte → tout futur ; dépassée → tout done.
  if (currentStep < 1) return new Map();
  if (currentStep > 1) {
    for (const c of COLLECTORS) if (!map.has(c.key)) map.set(c.key, { status: "done" });
  }
  return map;
}

// ── Action-required banner ──────────────────────────────────────────────────
function ActionRequiredBanner({ run, client }: { run: WorkflowRun; client?: Client }) {
  return (
    <div className="mx-10 mt-4 px-4 py-2.5 rounded-[11px] flex items-center justify-between"
      style={{
        background: `linear-gradient(135deg, rgba(245,183,78,0.07), rgba(255,255,255,0.01))`,
        border: `1px solid rgba(245,183,78,0.25)`,
      }}
    >
      <div className="flex items-center gap-3">
        <span className="rounded-full" style={{ width: 6, height: 6, background: WATCH, boxShadow: `0 0 8px ${WATCH}`, animation: "pulse 2s ease-in-out infinite" }} />
        <span className="font-mono uppercase" style={{ fontSize: 9.5, letterSpacing: "0.32em", color: "rgba(245,215,170,0.85)" }}>
          ACTION REQUISE
        </span>
        <span className="text-[12px]" style={{ color: "rgba(232,224,208,0.85)" }}>
          Plan de collecte <strong style={{ color: "#f4ecd8" }}>{client?.name ?? run.client_id}</strong> à valider avant de payer
        </span>
      </div>
      <Link to={`/admin/ops/run/${run.id}`} className="text-[12px] px-3 py-1 rounded-md"
        style={{ color: WATCH, border: `1px solid rgba(245,183,78,0.35)` }}
      >
        Examiner →
      </Link>
    </div>
  );
}

// ── Progression ring ────────────────────────────────────────────────────────
function ProgressRing({ run, activeCollectorLabel }: { run: WorkflowRun; activeCollectorLabel?: string }) {
  const progress = Math.max(0, Math.min(100, typeof run.progress === "number" ? run.progress : 0));
  const stepIdx = stepFromProgress(progress);
  const step = STEPS[stepIdx];
  const runShort = run.id.slice(0, 8).toUpperCase();
  const deg = progress * 3.6;
  const conic = `conic-gradient(from -90deg, ${BLUE_DARK} 0deg, ${BLUE} ${deg}deg, rgba(148,170,215,0.10) ${deg + 0.5}deg, rgba(148,170,215,0.10) 360deg)`;

  const inner = stepIdx === 1 && activeCollectorLabel ? `Collecte · ${activeCollectorLabel}` : step.label.split("—")[0].split("→")[0].trim();

  return (
    <div className="relative shrink-0" style={{ width: 280, height: 280 }}>
      {/* orbite pointillée */}
      <div className="absolute rounded-full pointer-events-none"
        style={{ inset: -24, border: `1px dashed rgba(77,159,255,0.18)`, animation: "orbit 24s linear infinite" }}
      />
      {/* hairline */}
      <div className="absolute rounded-full pointer-events-none"
        style={{ inset: -12, border: `1px solid rgba(148,170,215,0.07)` }}
      />
      {/* anneau de progression */}
      <div className="absolute rounded-full"
        style={{ inset: 0, background: conic, boxShadow: `0 0 80px rgba(47,107,255,0.25)` }}
      />
      {/* disque interne */}
      <div className="absolute rounded-full flex flex-col items-center justify-center text-center px-8"
        style={{ inset: 5, background: BG }}
      >
        <div className="font-mono uppercase" style={{ fontSize: 9, letterSpacing: "0.32em", color: FAINT }}>
          RUN {runShort}
        </div>
        <div className="font-mono mt-3 flex items-baseline" style={{ color: TEXT, fontWeight: 300 }}>
          <span style={{ fontSize: 52, lineHeight: 1 }}>{Math.round(progress)}</span>
          <span style={{ fontSize: 22, color: FAINT, marginLeft: 2 }}>%</span>
        </div>
        <div className="mt-2" style={{ fontSize: 13, fontWeight: 600, color: "#9ec8ff" }}>
          {inner}
        </div>
        <div className="font-mono mt-1.5 uppercase" style={{ fontSize: 10, color: FAINTER, letterSpacing: "0.14em" }}>
          FIN ESTIMÉE {estimateEndClock(run)} · {formatCost(estimateCost(run))}
        </div>
      </div>
    </div>
  );
}

// ── Pipeline timeline ───────────────────────────────────────────────────────
function CollectorChip({ label, state }: { label: string; state?: CollectorState }) {
  const s = state?.status ?? "future";
  if (s === "done") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md" style={{
        background: "rgba(61,220,151,0.07)",
        border: `1px solid rgba(61,220,151,0.28)`,
        color: "rgba(220,245,232,0.9)", fontSize: 10,
      }}>
        <span style={{ color: GOOD }}></span>{label}
        {typeof state?.count === "number" && (
          <span className="font-mono" style={{ color: "rgba(180,235,205,0.9)" }}>{formatCount(state.count)}</span>
        )}
      </span>
    );
  }
  if (s === "active") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md" style={{
        background: "rgba(77,159,255,0.10)",
        border: `1px solid rgba(77,159,255,0.32)`,
        color: "#e0ecff", fontSize: 10,
      }}>
        <span className="rounded-full" style={{ width: 5, height: 5, background: BLUE, animation: "pulse 1.4s ease-in-out infinite" }} />
        {label}
        <span className="font-mono" style={{ color: "#bfd8ff" }}>{formatCount(state?.count ?? 0)}…</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-1 rounded-md" style={{
      border: `1px dashed rgba(148,170,215,0.22)`,
      color: "rgba(148,170,215,0.55)", fontSize: 10,
    }}>
      {label}
    </span>
  );
}

function PipelineTimeline({ run, client, collectors }: {
  run: WorkflowRun; client?: Client; collectors: Map<string, CollectorState>;
}) {
  const currentIndex = stepFromProgress(run.progress);
  const clientName = client?.name ?? run.client_id;
  // Dernière syllabe en Instrument Serif italique — coupe à mi-mot pour un mot simple.
  const cut = clientName.length > 4 ? Math.max(1, clientName.length - Math.max(3, Math.floor(clientName.length / 3))) : clientName.length;
  const namePrefix = clientName.slice(0, cut);
  const nameTail   = clientName.slice(cut);

  return (
    <div className="min-w-0" style={{ maxWidth: 520 }}>
      <div className="font-mono uppercase" style={{ fontSize: 9, letterSpacing: "0.32em", color: FAINT }}>
        AUDIT EN COURS
      </div>
      <h2 className="mt-1.5" style={{ fontSize: 30, fontWeight: 400, color: TEXT, letterSpacing: -0.4, lineHeight: 1.1 }}>
        {namePrefix}<span style={{ fontFamily: "'Instrument Serif', 'Cormorant Garamond', Georgia, serif", fontStyle: "italic", fontWeight: 400 }}>{nameTail}</span>
      </h2>
      <div className="mt-1.5" style={{ fontSize: 11.5, color: FAINT }}>
        Démarré {timeAgo(run.started_at ?? run.created_at)} · workflow {run.workflow ?? "—"} · LLM {run.mode ?? "claude-sonnet"}
      </div>

      <ol className="mt-6 relative" style={{ paddingLeft: 34 }}>
        <div className="absolute w-px" style={{
          top: 10, bottom: 10, left: 9,
          background: `linear-gradient(180deg, ${GOOD}, ${BLUE_DARK} 45%, ${HAIRLINE} 75%)`,
        }} />
        {STEPS.map((step, i) => {
          const done   = i <  currentIndex;
          const active = i === currentIndex;
          const future = i >  currentIndex;
          const dimmed = future && (i - currentIndex) > 1;

          return (
            <li key={step.id} className="relative pb-5 last:pb-0" style={{ opacity: dimmed ? 0.6 : 1 }}>
              {/* Node */}
              <span className="absolute rounded-full flex items-center justify-center"
                style={{
                  top: 1, left: -34, width: 19, height: 19,
                  background: active ? `linear-gradient(135deg, ${BLUE_DARK}, ${BLUE})` : BG,
                  border: done ? `1.5px solid ${GOOD}` : active ? `1.5px solid ${BLUE}` : `1px solid ${HAIRLINE}`,
                  boxShadow: active ? `0 0 22px rgba(77,159,255,0.55)` : undefined,
                  animation: active ? "pulse 2s ease-in-out infinite" : undefined,
                }}
              >
                {done && <span style={{ color: GOOD, fontSize: 11, lineHeight: 1 }}>✓</span>}
                {active && <span style={{ color: "#fff", fontSize: 9, marginLeft: 1 }}>▶</span>}
                {future && <span className="font-mono" style={{ fontSize: 10, color: FAINT }}>{step.id}</span>}
              </span>

              {active ? (
                <div className="rounded-[11px] px-3 py-2.5" style={{
                  background: `linear-gradient(135deg, rgba(47,107,255,0.16), rgba(77,159,255,0.05))`,
                  border: `1px solid rgba(77,159,255,0.28)`,
                }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{step.label}</div>
                  {step.id === 2 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {COLLECTORS.map((c) => (
                        <CollectorChip key={c.key} label={c.label} state={collectors.get(c.key)} />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 pt-0.5">
                  <span style={{ fontSize: 13, color: done ? "rgba(230,238,252,0.85)" : FAINT }}>
                    {step.label}
                  </span>
                  {step.meta && (
                    <span className="font-mono uppercase" style={{ fontSize: 9, letterSpacing: "0.28em", color: FAINTER }}>
                      {step.meta}
                    </span>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ── Empty-scene state ───────────────────────────────────────────────────────
function EmptyScene() {
  return (
    <div className="flex items-center gap-14">
      <div className="relative shrink-0" style={{ width: 280, height: 280 }}>
        <div className="absolute rounded-full" style={{ inset: -24, border: `1px dashed rgba(148,170,215,0.10)` }} />
        <div className="absolute rounded-full" style={{ inset: 0, border: `1px solid rgba(148,170,215,0.10)` }} />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <div className="font-mono uppercase" style={{ fontSize: 9, letterSpacing: "0.32em", color: FAINT }}>AUCUN AUDIT EN COURS</div>
          <Link to="/admin/ops/new" className="mt-2 px-3.5 py-1.5 rounded-md text-[12.5px]" style={{
            color: "#f0f6ff", background: `linear-gradient(180deg, ${BLUE}, ${BLUE_DARK})`,
            boxShadow: `0 0 22px rgba(77,159,255,0.35)`, border: `1px solid rgba(77,159,255,0.5)`,
          }}>+ Nouvel audit</Link>
        </div>
      </div>
      <div className="min-w-0" style={{ maxWidth: 480, color: FAINT }}>
        <div className="font-mono uppercase" style={{ fontSize: 9, letterSpacing: "0.32em" }}>QUEUE VIDE</div>
        <p className="mt-2 text-[13px]">
          Aucun workflow n'est actif. Lance un audit pour voir la progression ici en temps réel.
        </p>
      </div>
    </div>
  );
}

// ── Télémétrie ──────────────────────────────────────────────────────────────
function TelemetryConsole({ events, empty }: { events: RunEvent[]; empty?: boolean }) {
  const last = events.slice(-3);
  return (
    <div className="mx-10 mt-8 rounded-[12px] relative overflow-hidden"
      style={{ background: GLASS, border: `1px solid ${HAIRLINE}` }}
    >
      <div className="relative flex items-center justify-between px-4 py-2" style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
        <span className="font-mono uppercase" style={{ fontSize: 8.5, letterSpacing: "0.36em", color: FAINT }}>
          TÉLÉMÉTRIE
        </span>
        <span className="font-mono uppercase" style={{ fontSize: 8.5, letterSpacing: "0.36em", color: FAINT }}>
          POLLING 4 S
        </span>
        <div className="absolute bottom-0 left-0 h-px w-1/3 pointer-events-none"
          style={{
            background: `linear-gradient(90deg, transparent, ${BLUE}, transparent)`,
            animation: "scan-line 3s linear infinite",
          }}
        />
      </div>
      <div className="px-4 py-3 font-mono" style={{ fontSize: 10.5, lineHeight: 1.9 }}>
        {empty || last.length === 0 ? (
          <span style={{ color: FAINT }}>en attente de télémétrie…</span>
        ) : (
          last.map((ev, i) => <TelemetryLine key={ev.id} ev={ev} last={i === last.length - 1} />)
        )}
      </div>
    </div>
  );
}

function TelemetryLine({ ev, last }: { ev: RunEvent; last: boolean }) {
  const data = ev.data as Record<string, unknown> | undefined;
  const ok = ev.event_type.includes("complete") || ev.event_type.includes("succeeded") || ev.event_type.includes("done");
  const source = String(data?.source ?? ev.event_type.split(".")[0] ?? "system");
  const message = String(data?.message ?? data?.detail ?? ev.event_type);
  const ts = new Date(ev.created_at);
  const time = `${pad(ts.getHours())}:${pad(ts.getMinutes())}:${pad(ts.getSeconds())}`;
  return (
    <div style={{ color: "rgba(210,220,240,0.85)" }}>
      <span style={{ color: FAINTER }}>{time}</span>{" "}
      <span style={{ color: ok ? GOOD : BLUE }}>{ok ? "✓" : "▶"}</span>{" "}
      <span style={{ color: "#9ec8ff" }}>{source}</span>{" "}
      <span style={{ color: FAINT }}>— {message}</span>
      {last && (
        <span className="inline-block ml-1" style={{
          width: 6, height: 12, background: BLUE, verticalAlign: -2,
          animation: "blink 1s steps(1, end) infinite",
        }} />
      )}
    </div>
  );
}

// ── Drawers ─────────────────────────────────────────────────────────────────
const CHEVRON: CSSProperties = { fontSize: 11, color: FAINT, transition: "transform 0.15s ease" };

function DrawerShell({ children, borderColor }: { children: ReactNode; borderColor?: string }) {
  return (
    <details className="group flex-1 min-w-[220px] rounded-[12px]"
      style={{ background: GLASS, border: `1px solid ${borderColor ?? HAIRLINE}` }}
    >
      {children}
    </details>
  );
}

function ArtifactChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded-md font-mono"
      style={{ fontSize: 9, letterSpacing: "0.12em", color: "#c8d6ff", background: "rgba(77,159,255,0.08)", border: `1px solid rgba(77,159,255,0.22)` }}
    >
      {children}
    </span>
  );
}

function CompletedDrawer({ runs }: { runs: RunWithClient[] }) {
  const latest = runs[0];
  return (
    <DrawerShell>
      <summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="group-open:rotate-90" style={CHEVRON}>▸</span>
          <span className="font-mono uppercase" style={{ fontSize: 9, letterSpacing: "0.32em", color: FAINT }}>
            RUNS TERMINÉS
          </span>
          <span className="font-mono" style={{ fontSize: 13, color: TEXT }}>{runs.length}</span>
          {latest && (
            <span className="truncate" style={{ fontSize: 11, color: FAINT }}>
              derniers livrables : <span style={{ color: "rgba(210,220,240,0.9)" }}>{latest.client?.name ?? latest.run.client_id}</span> · {timeAgo(latest.run.completed_at ?? latest.run.created_at)} · XLSX + 2 CSV + PDF
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="rounded-full" style={{ width: 6, height: 6, background: GOOD }} />
          <span className="font-mono uppercase" style={{ fontSize: 9, letterSpacing: "0.32em", color: FAINT }}>
            PRÊTS POUR L'AUDIT MANUEL
          </span>
        </div>
      </summary>
      {runs.length > 0 && (
        <div className="px-4 pb-3 space-y-1.5" style={{ borderTop: `1px solid ${HAIRLINE}`, paddingTop: 10 }}>
          {runs.map(({ run, client }) => (
            <div key={run.id} className="flex items-center justify-between gap-3 py-1 rounded hover:bg-white/[0.02]">
              <Link to={`/admin/ops/run/${run.id}`} className="flex-1 min-w-0">
                <div className="truncate" style={{ fontSize: 12, color: TEXT }}>{client?.name ?? run.client_id}</div>
                <div className="font-mono" style={{ fontSize: 10, color: FAINT }}>
                  {run.id.slice(0, 8)} · {timeAgo(run.completed_at ?? run.created_at)}
                </div>
              </Link>
              <div className="flex items-center gap-1 shrink-0">
                <ArtifactChip>XLSX</ArtifactChip>
                <ArtifactChip>CSV</ArtifactChip>
                <ArtifactChip>PDF</ArtifactChip>
              </div>
            </div>
          ))}
          <Link to="/admin/ops/pipeline" className="mt-2 inline-block" style={{ fontSize: 11, color: BLUE }}>
            Utiliser dans l'audit manuel →
          </Link>
        </div>
      )}
    </DrawerShell>
  );
}

function FailedDrawer({ runs }: { runs: RunWithClient[] }) {
  const first = runs[0];
  return (
    <DrawerShell borderColor="rgba(255,107,107,0.20)">
      <summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="group-open:rotate-90" style={CHEVRON}>▸</span>
          <span className="font-mono uppercase" style={{ fontSize: 9, letterSpacing: "0.32em", color: FAINT }}>
            ÉCHECS
          </span>
          <span className="font-mono" style={{ fontSize: 13, color: BAD }}>{runs.length}</span>
          {first && (
            <span className="truncate" style={{ fontSize: 11, color: FAINT }}>
              Apify quota · relance possible
            </span>
          )}
        </div>
      </summary>
      {runs.length > 0 && (
        <div className="px-4 pb-3 space-y-1.5" style={{ borderTop: `1px solid rgba(255,107,107,0.15)`, paddingTop: 10 }}>
          {runs.map(({ run, client }) => (
            <div key={run.id} className="flex items-center justify-between gap-3 py-1">
              <Link to={`/admin/ops/run/${run.id}`} className="flex-1 min-w-0">
                <div className="truncate" style={{ fontSize: 12, color: TEXT }}>{client?.name ?? run.client_id}</div>
                <div className="font-mono" style={{ fontSize: 10, color: FAINT }}>{run.id.slice(0, 8)} · échec {timeAgo(run.completed_at ?? run.created_at)}</div>
              </Link>
              <Link to={`/admin/ops/run/${run.id}`} className="shrink-0" style={{ fontSize: 11, color: BAD }}>
                Relancer la collecte seule →
              </Link>
            </div>
          ))}
        </div>
      )}
    </DrawerShell>
  );
}

function QueueDrawer({ runs }: { runs: RunWithClient[] }) {
  return (
    <DrawerShell>
      <summary className="cursor-pointer list-none px-4 py-3 flex items-center gap-3">
        <span className="group-open:rotate-90" style={CHEVRON}>▸</span>
        <span className="font-mono uppercase" style={{ fontSize: 9, letterSpacing: "0.32em", color: FAINT }}>FILE</span>
        <span className="font-mono" style={{ fontSize: 13, color: TEXT }}>{runs.length}</span>
      </summary>
    </DrawerShell>
  );
}

// ── Extra-active mini card (when > 1 active runs) ───────────────────────────
function ActiveMiniCard({ run, client }: { run: WorkflowRun; client?: Client }) {
  const p = Math.max(0, Math.min(100, typeof run.progress === "number" ? run.progress : 0));
  return (
    <Link to={`/admin/ops/run/${run.id}`} className="flex items-center gap-3 px-3 py-2 rounded-[10px] min-w-[200px]"
      style={{ background: GLASS, border: `1px solid ${HAIRLINE}` }}
    >
      <span className="rounded-full shrink-0" style={{ width: 6, height: 6, background: BLUE, animation: "pulse 1.6s ease-in-out infinite" }} />
      <div className="min-w-0 flex-1">
        <div className="truncate" style={{ fontSize: 12, color: TEXT }}>{client?.name ?? run.client_id}</div>
        <div className="mt-1 h-[3px] rounded-full overflow-hidden" style={{ background: "rgba(148,170,215,0.10)" }}>
          <div className="h-full rounded-full" style={{ width: `${p}%`, background: `linear-gradient(90deg, ${BLUE_DARK}, ${BLUE})` }} />
        </div>
      </div>
      <span className="font-mono" style={{ fontSize: 11, color: FAINT }}>{Math.round(p)}%</span>
    </Link>
  );
}

// ── Dashboard ───────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [trackedIds, setTrackedIds] = useState<string[]>(() => getTrackedRuns());

  const clientsQ = useQuery({
    queryKey: ["clients"],
    queryFn: async () => { try { return await tdia.listClients(); } catch { return [] as Client[]; } },
    refetchInterval: 30_000,
  });

  const runsQ = useQuery({
    queryKey: ["tracked-runs", trackedIds],
    queryFn: async () => {
      const out: RunWithClient[] = [];
      for (const id of trackedIds) {
        try { const run = await tdia.getRun(id); out.push({ run }); }
        catch { untrackRun(id); }
      }
      setTrackedIds(getTrackedRuns());
      return out;
    },
    refetchInterval: 4_000,
  });

  useEffect(() => {
    if (!runsQ.data || !clientsQ.data) return;
    const byId = new Map(clientsQ.data.map((c) => [c.id, c]));
    for (const r of runsQ.data) r.client = byId.get(r.run.client_id);
  }, [runsQ.data, clientsQ.data]);

  const runs = useMemo(() => runsQ.data ?? [], [runsQ.data]);

  // Buckets
  const active = useMemo(() => runs.filter((r) => statusTone(r.run.status) === "running"), [runs]);
  const queued = useMemo(() => runs.filter((r) => statusTone(r.run.status) === "queued"), [runs]);
  const done   = useMemo(() => runs.filter((r) => statusTone(r.run.status) === "completed"), [runs]);
  const failed = useMemo(() => runs.filter((r) => statusTone(r.run.status) === "failed"), [runs]);
  const review = useMemo(() => runs.filter((r) => statusTone(r.run.status) === "human_review"), [runs]);

  const focus = active[0] ?? queued[0];
  const extraActive = active.length > 1 ? active.slice(1) : [];

  // Events for the focused run (drives collectors + telemetry)
  const eventsQ = useQuery({
    queryKey: ["events", focus?.run.id],
    queryFn: async () => {
      if (!focus) return [] as RunEvent[];
      try { return await tdia.listEvents(focus.run.id); } catch { return [] as RunEvent[]; }
    },
    enabled: !!focus,
    refetchInterval: 4_000,
  });
  const events = useMemo(() => eventsQ.data ?? [], [eventsQ.data]);
  const collectors = useMemo(() => deriveCollectors(events, focus ? stepFromProgress(focus.run.progress) : -1), [events, focus]);
  const activeCollector = useMemo(() => {
    for (const [key, state] of collectors) if (state.status === "active") return COLLECTORS.find((c) => c.key === key)?.label;
    return undefined;
  }, [collectors]);

  const err = clientsQ.error instanceof Error ? clientsQ.error.message : undefined;

  return (
    <div className="relative" style={{ color: TEXT }}>
      {err && <div className="mx-10 mt-4"><BackendErrorBanner message={err} /></div>}

      {review[0] && <ActionRequiredBanner run={review[0].run} client={review[0].client} />}

      {/* Scène centrale */}
      <div className="px-10 py-16 flex items-center justify-center" style={{ minHeight: 420 }}>
        {focus ? (
          <div className="flex items-center gap-[70px] flex-wrap justify-center">
            <ProgressRing run={focus.run} activeCollectorLabel={activeCollector} />
            <PipelineTimeline run={focus.run} client={focus.client} collectors={collectors} />
          </div>
        ) : (
          <EmptyScene />
        )}
      </div>

      {/* Mini-cartes des runs actifs secondaires */}
      {extraActive.length > 0 && (
        <div className="mx-10 flex flex-wrap gap-2 -mt-6 mb-2">
          {extraActive.map(({ run, client }) => (
            <ActiveMiniCard key={run.id} run={run} client={client} />
          ))}
        </div>
      )}

      <TelemetryConsole events={events} empty={!focus} />

      {/* Tiroirs repliés */}
      <div className="mx-10 mt-4 mb-10 flex flex-wrap gap-3">
        <CompletedDrawer runs={done} />
        <FailedDrawer runs={failed} />
        <QueueDrawer runs={queued} />
      </div>
    </div>
  );
}
