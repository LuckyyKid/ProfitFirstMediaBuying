import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SectionHeader, EmptyState } from "@/gos/ui";
import { useSelectedClient } from "@/gos/context";
import { toast } from "sonner";
import { Sparkles, Play, RefreshCw, Bot, FileText, CalendarClock, LineChart, Wand2 } from "lucide-react";

type Run = {
  id: string;
  automation_type: string;
  title: string | null;
  status: string;
  output_text: string | null;
  model: string | null;
  tokens_input: number | null;
  tokens_output: number | null;
  duration_ms: number | null;
  error: string | null;
  created_at: string;
};

type AutomationKind =
  | "weekly_exec_summary"
  | "creative_brief_ideas"
  | "wayfinder_prep"
  | "portfolio_insights"
  | "custom_prompt";

const PRESETS: {
  kind: AutomationKind;
  label: string;
  icon: any;
  description: string;
  defaultPrompt: string;
}[] = [
  {
    kind: "weekly_exec_summary",
    label: "Résumé hebdo exécutif",
    icon: FileText,
    description: "Génère un rapport exécutif structuré basé sur le contexte client.",
    defaultPrompt: "Rédige le rapport de la semaine en cours en te basant sur les dernières métriques du client.",
  },
  {
    kind: "creative_brief_ideas",
    label: "Idées de briefs créatifs",
    icon: Wand2,
    description: "5 nouveaux angles créatifs prêts à briefer.",
    defaultPrompt: "Propose 5 angles créatifs pertinents pour la phase actuelle du client.",
  },
  {
    kind: "wayfinder_prep",
    label: "Préparation Wayfinder",
    icon: CalendarClock,
    description: "Ordre du jour et talking-points pour le Wayfinder Wednesday.",
    defaultPrompt: "Prépare l'ordre du jour Wayfinder pour cette semaine.",
  },
  {
    kind: "portfolio_insights",
    label: "Insights portefeuille",
    icon: LineChart,
    description: "Insights transverses et alertes sur le portefeuille.",
    defaultPrompt: "Donne-moi 3 insights transverses et 3 alertes sur ce client vs le reste du portefeuille.",
  },
  {
    kind: "custom_prompt",
    label: "Prompt libre",
    icon: Bot,
    description: "Question ouverte à l'assistant growth.",
    defaultPrompt: "",
  },
];

const CARD = "hsl(220 45% 16%)";
const BORDER = "hsl(220 45% 25%)";
const MUTED = "hsl(0 0% 40%)";
const BLUE = "hsl(226 100% 60%)";
const MONO = "'JetBrains Mono', ui-monospace, monospace";

export default function AiAutomationHub() {
  const { clientId } = useParams();
  const { setSelectedClient } = useSelectedClient();
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedKind, setSelectedKind] = useState<AutomationKind>("weekly_exec_summary");
  const [prompt, setPrompt] = useState<string>(PRESETS[0].defaultPrompt);
  const [running, setRunning] = useState(false);
  const [lastOutput, setLastOutput] = useState<string | null>(null);

  const preset = useMemo(() => PRESETS.find((p) => p.kind === selectedKind)!, [selectedKind]);

  useEffect(() => {
    setPrompt(preset.defaultPrompt);
  }, [preset]);

  const load = async () => {
    if (!clientId) return;
    setLoading(true);
    const [c, r] = await Promise.all([
      supabase.from("gos_clients").select("*").eq("id", clientId).maybeSingle(),
      supabase
        .from("gos_ai_automation_runs" as any)
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    if (c.data) setSelectedClient(c.data as any);
    setRuns(((r.data as any[]) ?? []) as Run[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [clientId]);

  const runAutomation = async () => {
    if (!clientId) return;
    if (!prompt.trim() && selectedKind === "custom_prompt") {
      toast.error("Écris un prompt d'abord.");
      return;
    }
    setRunning(true);
    setLastOutput(null);
    const { data, error } = await supabase.functions.invoke("gos-ai-automation", {
      body: {
        client_id: clientId,
        automation_type: selectedKind,
        title: preset.label,
        prompt,
      },
    });
    setRunning(false);
    if (error) {
      toast.error(error.message || "Échec de l'exécution");
      load();
      return;
    }
    const output = (data as any)?.output_text as string | undefined;
    setLastOutput(output ?? "(sortie vide)");
    toast.success("Automation exécutée");
    load();
  };

  if (loading) return <div style={{ height: 300, background: CARD, borderRadius: 8 }} />;

  return (
    <>
      <SectionHeader
        title="Agents IA & automations"
        subtitle="Lance des automations basées sur Lovable AI pour ce client : briefs, résumés, préparations de meetings."
        guide={{
          purpose: "Automatiser les livrables textuels récurrents (rapports, briefs, agendas) en s'appuyant sur le contexte structuré du client.",
          dataSource: "gos_clients + prompt utilisateur → Lovable AI Gateway (Gemini/Flash par défaut).",
          usedBy: "AM · Growth Strategist · Directeur créatif.",
          requiredInputs: ["Client sélectionné", "Type d'automation", "Prompt (optionnel selon preset)"],
          nextStep: "Choisis un preset, ajuste le prompt si besoin, puis exécute.",
          primaryCta: "Exécuter l'automation",
        }}
        actions={
          <button className="gos-btn-secondary" onClick={load}>
            <RefreshCw size={14} style={{ verticalAlign: "middle", marginRight: 6 }} /> Actualiser
          </button>
        }
      />

      {/* Preset picker */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12, marginBottom: 16 }}>
        {PRESETS.map((p) => {
          const active = p.kind === selectedKind;
          return (
            <button
              key={p.kind}
              onClick={() => setSelectedKind(p.kind)}
              style={{
                textAlign: "left",
                padding: 14,
                borderRadius: 10,
                border: `1px solid ${active ? BLUE : BORDER}`,
                background: active ? "hsl(226 100% 60% / 0.08)" : CARD,
                cursor: "pointer",
                color: "var(--tdia-text)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <p.icon size={16} color={active ? BLUE : MUTED} />
                <span style={{ fontWeight: 700, fontSize: 13 }}>{p.label}</span>
              </div>
              <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.4 }}>{p.description}</div>
            </button>
          );
        })}
      </div>

      {/* Prompt + run */}
      <div style={{ padding: 16, borderRadius: 12, border: `1px solid ${BORDER}`, background: CARD, marginBottom: 16 }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.03em" }}>
          Prompt · {preset.label}
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={5}
          placeholder="Décris ce que tu attends de l'agent…"
          style={{
            width: "100%",
            marginTop: 8,
            padding: 12,
            background: "hsl(220 45% 14%)",
            border: `1px solid ${BORDER}`,
            borderRadius: 8,
            color: "var(--tdia-text)",
            fontFamily: MONO,
            fontSize: 13,
            resize: "vertical",
            outline: "none",
          }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
          <span style={{ fontSize: 11, color: MUTED, fontFamily: MONO }}>Modèle : google/gemini-2.5-flash (défaut)</span>
          <button
            onClick={runAutomation}
            disabled={running}
            style={{
              padding: "10px 20px",
              background: running ? "hsl(0 0% 60%)" : BLUE,
              border: "none",
              borderRadius: 8,
              color: "var(--tdia-text)",
              fontWeight: 700,
              fontSize: 12,
              letterSpacing: "0.03em",
              textTransform: "uppercase",
              cursor: running ? "not-allowed" : "pointer",
              fontFamily: MONO,
            }}
          >
            <Play size={14} style={{ verticalAlign: "middle", marginRight: 6 }} />
            {running ? "Exécution…" : "Lancer l'agent"}
          </button>
        </div>
      </div>

      {/* Last output */}
      {lastOutput !== null && (
        <div style={{ padding: 20, borderRadius: 12, border: `1px solid ${BLUE}`, background: "hsl(226 100% 60% / 0.05)", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <Sparkles size={16} color={BLUE} />
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.03em", textTransform: "uppercase", color: BLUE }}>
              Résultat le plus récent
            </span>
          </div>
          <div style={{ whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.6, color: "var(--tdia-text)" }}>{lastOutput}</div>
        </div>
      )}

      {/* History */}
      <div style={{ borderRadius: 12, border: `1px solid ${BORDER}`, background: CARD, overflow: "hidden" }}>
        <div style={{ padding: "12px 20px", background: "hsl(220 45% 12%)", borderBottom: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.03em" }}>
            Historique des exécutions
          </span>
          <span style={{ fontFamily: MONO, fontSize: 11, color: MUTED }}>{runs.length} runs</span>
        </div>
        {runs.length === 0 ? (
          <EmptyState title="Aucune exécution" hint="Lance ta première automation ci-dessus." />
        ) : (
          <div>
            {runs.map((r) => (
              <div key={r.id} style={{ padding: 16, borderTop: `1px solid ${BORDER}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{
                      fontFamily: MONO, fontSize: 10, padding: "2px 8px", borderRadius: 4,
                      background: r.status === "completed" ? "hsl(140 60% 92%)" : r.status === "error" ? "hsl(0 84% 92%)" : "hsl(45 90% 88%)",
                      color: r.status === "completed" ? "hsl(140 60% 25%)" : r.status === "error" ? "hsl(0 72% 42%)" : "hsl(45 90% 30%)", textTransform: "uppercase", letterSpacing: "0.03em", fontWeight: 700,
                    }}>{r.status}</span>
                    <span style={{ fontSize: 13, color: "var(--tdia-text)", fontWeight: 600 }}>{r.title ?? r.automation_type}</span>
                  </div>
                  <span style={{ fontFamily: MONO, fontSize: 11, color: MUTED }}>
                    {new Date(r.created_at).toLocaleString("fr-FR")}
                    {r.duration_ms != null && ` · ${(r.duration_ms / 1000).toFixed(1)}s`}
                    {(r.tokens_input != null || r.tokens_output != null) && ` · ${r.tokens_input ?? 0}/${r.tokens_output ?? 0} tok`}
                  </span>
                </div>
                {r.error && (
                  <div style={{ fontSize: 12, color: "#c1121f", marginTop: 4 }}>Erreur : {r.error}</div>
                )}
                {r.output_text && (
                  <details style={{ marginTop: 8 }}>
                    <summary style={{ cursor: "pointer", fontSize: 12, color: MUTED }}>Voir la sortie</summary>
                    <div style={{ whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.55, color: "var(--tdia-text)", marginTop: 8, padding: 12, background: "hsl(220 45% 14%)", borderRadius: 8 }}>
                      {r.output_text}
                    </div>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
