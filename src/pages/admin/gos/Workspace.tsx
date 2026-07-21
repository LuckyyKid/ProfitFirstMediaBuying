import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SectionHeader, RiskBadge, PhaseBadge, StatusBadge, EmptyState } from "@/gos/ui";
import { useSelectedClient } from "@/gos/context";
import { fetchWorkflowStatuses, isWorkflowDone, type WorkflowBlockKey, type WorkflowStatus } from "@/gos/workflow";
import { Lock, ArrowRight, Check, Circle, Sparkles, FileText, Settings2, Activity, Target, Map, Radio, Repeat } from "lucide-react";

type BlockKey = "record" | "setup" | "diagnosis" | "planning" | "execution" | "live" | "learning";

const BLOCKS: { key: BlockKey; title: string; desc: string; path?: string; requires?: BlockKey; Icon: any }[] = [
  { key: "record",    title: "1. Fiche client",                    desc: "Informations, contacts, liens du client.",                             path: "workspace",                Icon: FileText },
  { key: "setup",     title: "2. Configuration du modèle",         desc: "Contexte business, unit economics, produits, stock, baseline.",        path: "growth-model-setup",       Icon: Settings2, requires: "record" },
  { key: "diagnosis", title: "3. Diagnostic de croissance",        desc: "Classifier le problème de croissance.",                                path: "growth-diagnosis",         Icon: Activity,  requires: "setup" },
  { key: "planning",  title: "4. Planification & prévision",       desc: "Prévisions, objectifs, P&L hebdo, besoin en créatifs.",                path: "planning-prediction",      Icon: Target,    requires: "diagnosis" },
  { key: "execution", title: "5. Carte d'exécution",               desc: "Plan sur 30 jours avec priorités.",                                    path: "growth-execution-map",     Icon: Map,       requires: "planning" },
  { key: "live",      title: "6. Optimisation live",               desc: "Revues réel vs cible.",                                                path: "live-optimization",        Icon: Radio,     requires: "execution" },
  { key: "learning",  title: "7. Apprentissage / prochain cycle",  desc: "Apprentissages et prochain cycle 30 jours.",                           path: "learning-loop",            Icon: Repeat,    requires: "live" },
];

export default function GosWorkspace() {
  const { clientId } = useParams();
  const [client, setClient] = useState<any>(null);
  const [setupReady, setSetupReady] = useState(false);
  const [workflowStatuses, setWorkflowStatuses] = useState<Record<WorkflowBlockKey, WorkflowStatus | undefined>>({} as Record<WorkflowBlockKey, WorkflowStatus | undefined>);
  const [loading, setLoading] = useState(true);
  const { setSelectedClient } = useSelectedClient();
  const nav = useNavigate();

  useEffect(() => {
    if (!clientId) return;
    (async () => {
      const { data: c } = await supabase.from("gos_clients").select("*").eq("id", clientId).single();
      if (c) { setClient(c); setSelectedClient(c as any); }
      const [{ data: bc }, { data: fi }, { data: qb }] = await Promise.all([
        supabase.from("gos_business_contexts").select("status").eq("client_id", clientId).maybeSingle(),
        supabase.from("gos_financial_inputs").select("status").eq("client_id", clientId).maybeSingle(),
        supabase.from("gos_quantitative_baselines").select("status").eq("client_id", clientId).maybeSingle(),
      ]);
      const statuses = await fetchWorkflowStatuses(clientId);
      const ok = (s: string | undefined | null) => s === "PRÊT" || s === "APPROVED" || s === "READY";
      setSetupReady(ok(bc?.status) && ok(fi?.status) && ok(qb?.status));
      setWorkflowStatuses(statuses);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  if (loading) return <div style={{ height: 300, background: "hsl(220 45% 14%)", borderRadius: 8 }} />;
  if (!client) return <EmptyState title="Client introuvable." />;

  const statusFor = (b: typeof BLOCKS[number]) => {
    if (b.key === "record") return "APPROVED";
    if (b.key === "setup") return isWorkflowDone(workflowStatuses.setup?.status) || setupReady ? "PRÊT" : "MISSING_INPUTS";
    if (isWorkflowDone(workflowStatuses[b.key as WorkflowBlockKey]?.status)) return "APPROVED";
    return "NOT_STARTED";
  };
  const isDone = (b: typeof BLOCKS[number]) => {
    const s = statusFor(b);
    return s === "APPROVED" || s === "PRÊT";
  };
  const isLocked = (b: typeof BLOCKS[number]) => {
    if (!b.requires) return false;
    if (b.requires === "record") return false;
    const required = BLOCKS.find((x) => x.key === b.requires);
    return required ? !isDone(required) : true;
  };
  const isCurrent = (b: typeof BLOCKS[number]) => {
    const firstOpen = BLOCKS.find((x) => !isDone(x) && !isLocked(x));
    return firstOpen?.key === b.key;
  };

  const nextBlock = BLOCKS.find((b) => b.key !== "record" && !isDone(b) && !isLocked(b));
  const nextStep = nextBlock
    ? { label: nextBlock.key === "setup" ? "Démarrer la configuration du modèle" : `Ouvrir ${nextBlock.title.replace(/^\d+\.\s*/, "")}`, to: `/admin/gos/clients/${client.id}/${nextBlock.path}`, sub: nextBlock.desc }
    : { label: "Tous les blocs sont complétés", to: null as string | null, sub: "Le parcours client est à jour." };

  const doneCount = BLOCKS.filter(isDone).length;
  const pct = Math.round((doneCount / BLOCKS.length) * 100);

  return (
    <div>
      <SectionHeader
        guide={{
          purpose: "Centre de commande d'un client — phase, risque et prochaines actions à travers les 7 blocs de croissance.",
          dataSource: "Fiche client + statuts des blocs complétés.",
          usedBy: "Account Manager comme hub de navigation quotidien.",
          nextStep: nextStep.label,
          primaryCta: nextStep.to ? "Ouvrir" : "Parcours complété",
        }}
        title={client.company_name}
        subtitle={`${client.client_code} · ${client.business_type.replace("_"," ")} · ${client.industry ?? "—"}`}
        actions={
          <>
            <PhaseBadge phase={client.current_phase} />
            <RiskBadge level={client.risk_level} />
          </>
        }
      />

      {/* Progress + Next Step */}
      <div
        className="gos-card"
        style={{
          marginBottom: 28,
          padding: 24,
          background: "linear-gradient(135deg, hsl(220 45% 14%) 0%, hsl(220 45% 14%) 100%)",
          border: "1px solid hsl(220 45% 16%)",
          borderLeft: "4px solid var(--tdia-blue)",
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: 24,
          alignItems: "center",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <Sparkles size={14} style={{ color: "var(--tdia-blue)" }} />
            <div style={{ fontSize: 11, color: "var(--tdia-muted)", fontWeight: 700, letterSpacing: "0.03em", textTransform: "uppercase" }}>
              Prochaine étape recommandée
            </div>
          </div>
          <div style={{ fontSize: 20, fontWeight: 600, color: "var(--tdia-text)", marginBottom: 6 }}>{nextStep.label}</div>
          <div style={{ fontSize: 13, color: "var(--tdia-muted)", maxWidth: 640, lineHeight: 1.5 }}>{nextStep.sub}</div>

          <div style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 16 }}>
            {nextStep.to ? (
              <Link to={nextStep.to} className="gos-btn-primary" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8 }}>
                Ouvrir <ArrowRight size={14} />
              </Link>
            ) : (
              <button className="gos-btn-primary" disabled>Terminé</button>
            )}
            <div style={{ fontSize: 12, color: "var(--tdia-muted)" }}>
              <span style={{ color: "var(--tdia-text)", fontWeight: 600 }}>{doneCount}</span> / {BLOCKS.length} blocs complétés
            </div>
          </div>
        </div>

        {/* Progress ring */}
        <div style={{ position: "relative", width: 96, height: 96 }}>
          <svg width="96" height="96" viewBox="0 0 96 96" style={{ transform: "rotate(-90deg)" }}>
            <circle cx="48" cy="48" r="40" fill="none" stroke="hsl(220 45% 16%)" strokeWidth="8" />
            <circle
              cx="48"
              cy="48"
              r="40"
              fill="none"
              stroke="var(--tdia-blue)"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 40}
              strokeDashoffset={2 * Math.PI * 40 * (1 - pct / 100)}
              style={{ transition: "stroke-dashoffset .6s ease" }}
            />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "var(--tdia-text)", fontWeight: 700, fontSize: 18 }}>
            {pct}%
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div style={{ position: "relative", paddingLeft: 8 }}>
        {BLOCKS.map((b, i) => {
          const locked = isLocked(b);
          const st = statusFor(b);
          const done = isDone(b);
          const current = isCurrent(b);
          const last = i === BLOCKS.length - 1;
          const Icon = b.Icon;

          const nodeColor = done ? "var(--tdia-blue)" : current ? "var(--tdia-blue)" : "hsl(220 45% 25%)";
          const nodeBg = done ? "var(--tdia-blue)" : "hsl(220 45% 14%)";
          const nodeText = done ? "hsl(220 45% 14%)" : current ? "var(--tdia-blue)" : "var(--tdia-muted)";

          return (
            <div key={b.key} style={{ display: "grid", gridTemplateColumns: "56px 1fr", gap: 20, position: "relative", paddingBottom: last ? 0 : 20 }}>
              {/* Rail column */}
              <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: nodeBg,
                    border: `2px solid ${nodeColor}`,
                    display: "grid",
                    placeItems: "center",
                    color: nodeText,
                    boxShadow: current ? "0 0 0 4px hsl(226 100% 60% / 0.12)" : "none",
                    zIndex: 2,
                    transition: "all .2s ease",
                  }}
                >
                  {done ? <Check size={20} strokeWidth={3} /> : <Icon size={18} />}
                </div>
                {!last && (
                  <div
                    style={{
                      flex: 1,
                      width: 2,
                      marginTop: 4,
                      background: done ? "var(--tdia-blue)" : "hsl(220 45% 16%)",
                      minHeight: 40,
                    }}
                  />
                )}
              </div>

              {/* Card */}
              <div
                className="gos-card"
                style={{
                  opacity: locked ? 0.55 : 1,
                  padding: 18,
                  borderColor: current ? "var(--tdia-blue)" : undefined,
                  boxShadow: current ? "0 0 0 1px var(--tdia-blue), 0 8px 24px hsl(226 100% 60% / 0.08)" : undefined,
                  transition: "all .2s ease",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 10, color: "var(--tdia-muted)", fontWeight: 700, letterSpacing: "0.03em", textTransform: "uppercase", marginBottom: 4 }}>
                      {current ? "En cours" : done ? "Terminé" : locked ? "Verrouillé" : "À faire"}
                    </div>
                    <div style={{ fontWeight: 600, fontSize: 16, color: "var(--tdia-text)" }}>{b.title}</div>
                  </div>
                  <StatusBadge status={st} />
                </div>
                <p style={{ color: "var(--tdia-muted)", fontSize: 13, margin: "0 0 14px", lineHeight: 1.55 }}>{b.desc}</p>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {locked ? (
                    <button className="gos-btn-secondary" disabled style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <Lock size={12} /> Verrouillé
                    </button>
                  ) : b.path ? (
                    <button
                      className={current ? "gos-btn-primary" : "gos-btn-secondary"}
                      onClick={() => nav(`/admin/gos/clients/${client.id}/${b.path}`)}
                      style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                    >
                      {current ? "Reprendre" : done ? "Revoir" : "Ouvrir"} <ArrowRight size={14} />
                    </button>
                  ) : (
                    <button className="gos-btn-secondary" disabled>Vague 2+</button>
                  )}
                  {locked && b.requires && (
                    <span style={{ fontSize: 11, color: "var(--tdia-muted)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <Circle size={6} fill="currentColor" /> Nécessite : {BLOCKS.find(x => x.key === b.requires)?.title.replace(/^\d+\.\s*/, "")}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
