// "Ma Journée" — GOS home screen (Premium Dark).
//
// Design rules applied:
//   #1 one next action per screen           → HeroAction (PROCHAINE ACTION)
//   #4 no bare numbers                       → progress "X/N" + microlabels
//   #7 routine list, one row per client      → ClientRoutineRow
//   #8 missing_data is a state, not an error → blocked row w/ unblock CTA
//   #10 sidebar reduced to 3-5 entries       → handled in Sidebar.tsx
//
// The heavy AM cockpit that used to live here (attention queue, KPI grid,
// full client table) moved to /admin/gos/portfolio.

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useSelectedClient } from "@/gos/context";
import { HeroAction } from "@/gos/premium/HeroAction";
import { ClientRoutineRow, type RoutineStep } from "@/gos/premium/ClientRoutineRow";
import { MicroLabel, StatusDot, type Status } from "@/gos/premium/primitives";

type ClientRow = {
  id: string;
  client_code: string;
  company_name: string;
  business_type: string;
  current_phase: string;
  risk_level: string;
  am_owner: string | null;
  industry: string | null;
};

type RoutineClient = {
  client: ClientRow;
  ready: boolean;
  status: Status;
  progress: { done: number; total: number };
  steps: RoutineStep[];
  blocked: { reason: string; actionLabel: string } | null;
};

const ROUTINE_STEP_LABELS = [
  "Digest 7h",
  "Walkdown",
  "Buyer",
  "Créa",
  "Budget",
  "Debrief",
];

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 1)
    .join("")
    .toUpperCase();
}

function greetingByHour(): string {
  const h = new Date().getHours();
  if (h < 5) return "Bonne nuit";
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bon après-midi";
  return "Bonsoir";
}

function frenchDate(d: Date): string {
  return d.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function buildRoutine(client: ClientRow, ready: boolean): RoutineClient {
  const highRisk = ["HIGH", "CRITICAL"].includes(client.risk_level);
  const status: Status = !ready ? "missing" : highRisk ? "bad" : "good";

  if (!ready) {
    return {
      client,
      ready,
      status,
      progress: { done: 0, total: ROUTINE_STEP_LABELS.length },
      steps: [],
      blocked: {
        reason: `Configuration du modèle incomplète pour ${client.company_name} — la routine ne peut pas démarrer.`,
        actionLabel: "Compléter la configuration",
      },
    };
  }

  // Heuristic while the real routine-engine isn't wired: high-risk = active step
  // is Walkdown (step 2), otherwise Digest done + Walkdown active. Enough to
  // populate the visual until the runtime feeds real per-client state.
  const activeIndex = highRisk ? 1 : 0;
  const steps: RoutineStep[] = ROUTINE_STEP_LABELS.map((label, i) => ({
    id: `${client.id}-${i}`,
    label,
    state: i < activeIndex ? "done" : i === activeIndex ? "active" : "future",
  }));

  return {
    client,
    ready,
    status,
    progress: { done: activeIndex, total: steps.length },
    steps,
    blocked: null,
  };
}

export default function GosDashboard() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [readySet, setReadySet] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [userName, setUserName] = useState<string>("");

  const nav = useNavigate();
  const { setSelectedClient } = useSelectedClient();

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getUser();
      const email = s.user?.email ?? "";
      setUserName(email ? email.split("@")[0] : "");
    })();
  }, []);

  const load = async () => {
    setLoading(true);
    const { data: cs } = await supabase
      .from("gos_clients")
      .select("*")
      .order("created_at", { ascending: false });

    const list = (cs as ClientRow[] | null) ?? [];
    setClients(list);

    const [{ data: bc }, { data: fi }, { data: qb }] = await Promise.all([
      supabase.from("gos_business_contexts").select("client_id,status"),
      supabase.from("gos_financial_inputs").select("client_id,status"),
      supabase.from("gos_quantitative_baselines").select("client_id,status"),
    ]);
    const bcs = new Map((bc ?? []).map((r) => [r.client_id, r.status]));
    const fis = new Map((fi ?? []).map((r) => [r.client_id, r.status]));
    const qbs = new Map((qb ?? []).map((r) => [r.client_id, r.status]));
    const ok = ["PRÊT", "APPROVED"];

    const ready = new Set<string>();
    list.forEach((c) => {
      if (
        ok.includes(bcs.get(c.id) ?? "") &&
        ok.includes(fis.get(c.id) ?? "") &&
        ok.includes(qbs.get(c.id) ?? "")
      ) {
        ready.add(c.id);
      }
    });
    setReadySet(ready);
    setLoading(false);
    setLastRefresh(new Date());
  };

  useEffect(() => {
    load();
  }, []);

  const routines = useMemo<RoutineClient[]>(
    () => clients.map((c) => buildRoutine(c, readySet.has(c.id))),
    [clients, readySet],
  );

  const alertCount = routines.filter((r) => r.status === "bad" || r.status === "missing").length;
  const doneCount = routines.filter((r) => r.progress.done >= r.progress.total).length;
  const totalRoutines = routines.length;

  // Pick the "prochaine action" — first blocked client, else first high-risk,
  // else the first client whose walkdown is due.
  const nextTarget: RoutineClient | undefined =
    routines.find((r) => r.blocked) ??
    routines.find((r) => r.status === "bad") ??
    routines[0];

  const openWalkdown = (r: RoutineClient) => {
    setSelectedClient({
      id: r.client.id,
      client_code: r.client.client_code,
      company_name: r.client.company_name,
      business_type: r.client.business_type,
      current_phase: r.client.current_phase,
      risk_level: r.client.risk_level,
      industry: r.client.industry,
      am_owner: r.client.am_owner,
    });
    nav(`/admin/gos/clients/${r.client.id}/walkdown`);
  };

  const openSetup = (r: RoutineClient) => {
    setSelectedClient({
      id: r.client.id,
      client_code: r.client.client_code,
      company_name: r.client.company_name,
      business_type: r.client.business_type,
      current_phase: r.client.current_phase,
      risk_level: r.client.risk_level,
      industry: r.client.industry,
      am_owner: r.client.am_owner,
    });
    nav(`/admin/gos/clients/${r.client.id}/growth-model-setup`);
  };

  const now = new Date();
  const dateStr = frenchDate(now);
  const timeStr = lastRefresh.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 40, maxWidth: 1240 }}>
      {/* ── Greeting + top-right progress ─────────────────────────────── */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 24, flexWrap: "wrap" }}>
        <div>
          <MicroLabel style={{ marginBottom: 12 }}>{dateStr.toUpperCase()}</MicroLabel>
          <h1 style={{
            margin: 0, fontSize: 34, fontWeight: 500, letterSpacing: "-0.02em",
            color: "#eef2fa", lineHeight: 1.15,
          }}>
            {greetingByHour()}
            {userName && <>, <span className="font-accent" style={{ fontWeight: 400 }}>{userName}</span></>}
            <span style={{ color: "#4d9fff" }}> —</span>
          </h1>
          <p style={{ margin: 0, marginTop: 8, color: "#8b97ad", fontSize: 14 }}>
            Voici ta routine du jour. Une action à la fois.
          </p>
        </div>

        <div style={{
          display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8,
          minWidth: 200,
        }}>
          <MicroLabel>ROUTINE GLOBALE</MicroLabel>
          <div className="font-data" style={{
            fontSize: 28, fontWeight: 300, color: "#eef2fa", letterSpacing: "-0.01em",
          }}>
            {doneCount}<span style={{ color: "#5f6b82" }}>/{totalRoutines}</span>
          </div>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            {alertCount > 0 ? (
              <StatusDot status="bad" label={`${alertCount} alerte${alertCount > 1 ? "s" : ""}`} />
            ) : totalRoutines > 0 ? (
              <StatusDot status="good" label="RAS" />
            ) : (
              <StatusDot status="missing" label="AUCUN CLIENT" />
            )}
            <MicroLabel color="#5f6b82">SYNC {timeStr}</MicroLabel>
          </div>
        </div>
      </header>

      {/* ── Hero: PROCHAINE ACTION ───────────────────────────────────── */}
      {nextTarget ? (
        nextTarget.blocked ? (
          <HeroAction
            title="Débloquer"
            clientAccent={nextTarget.client.company_name}
            reason={nextTarget.blocked.reason}
            ctaLabel={nextTarget.blocked.actionLabel}
            onCta={() => openSetup(nextTarget)}
            meta={{
              step: "SETUP",
              duration: "~15 MIN",
              extra: "BLOQUÉ — DONNÉES MANQUANTES",
            }}
          />
        ) : (
          <HeroAction
            title="Walkdown métriques —"
            clientAccent={nextTarget.client.company_name}
            reason={`Le digest du matin est prêt : lis les 6 branches, note les 2 à surveiller, puis passe au Buyer Workspace.`}
            ctaLabel="Commencer"
            onCta={() => openWalkdown(nextTarget)}
            meta={{
              duration: "~10 MIN",
              step: `ÉTAPE 2/${ROUTINE_STEP_LABELS.length}`,
              synced: `SYNCHRO ${timeStr}`,
              extra: nextTarget.status === "bad" ? "1 BRANCHE ROUGE" : undefined,
            }}
          />
        )
      ) : (
        <div className="card-premium" style={{ padding: 32, textAlign: "center", color: "#8b97ad" }}>
          <MicroLabel color="#5f6b82" style={{ display: "block", marginBottom: 8 }}>
            AUCUNE ACTION EN ATTENTE
          </MicroLabel>
          <div style={{ fontSize: 15, color: "#c8d2e4" }}>
            Ajoute un client pour lancer la première routine.
          </div>
        </div>
      )}

      {/* ── ROUTINE DU JOUR list ────────────────────────────────────── */}
      <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <MicroLabel>ROUTINE DU JOUR</MicroLabel>
          <MicroLabel color="#5f6b82">
            {totalRoutines} CLIENT{totalRoutines > 1 ? "S" : ""}
          </MicroLabel>
        </div>

        {loading ? (
          <div className="card-premium" style={{ padding: 40, textAlign: "center", color: "#5f6b82" }}>
            Chargement…
          </div>
        ) : routines.length === 0 ? (
          <div className="card-premium" style={{ padding: 40, textAlign: "center" }}>
            <div style={{ color: "#c8d2e4", fontSize: 14, marginBottom: 6 }}>
              Aucun client dans le portefeuille.
            </div>
            <div style={{ color: "#8b97ad", fontSize: 12 }}>
              Crée-en un depuis <b>Clients</b> pour démarrer.
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {routines.map((r) => (
              <ClientRoutineRow
                key={r.client.id}
                clientInitial={initials(r.client.company_name)}
                clientName={r.client.company_name}
                clientCode={r.client.client_code}
                status={r.status}
                progress={r.progress}
                steps={r.blocked ? undefined : r.steps}
                onClick={r.blocked ? undefined : () => openWalkdown(r)}
                blocked={
                  r.blocked
                    ? {
                        reason: r.blocked.reason,
                        actionLabel: r.blocked.actionLabel,
                        onAction: () => openSetup(r),
                      }
                    : undefined
                }
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
