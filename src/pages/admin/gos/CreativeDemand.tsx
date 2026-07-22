/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SectionHeader, EmptyState } from "@/gos/ui";
import { useSelectedClient } from "@/gos/context";
import { toast } from "sonner";
import { Wand2, Play, RefreshCw } from "lucide-react";
import { runCreativeDemand } from "@/gos/creativeDemand";
import {
  createCreativeDemandRun,
  fetchCreativeDemandRuns,
  type CreativeDemandRunRow,
} from "@/gos/creativeDemandController";

const BG = "rgba(255, 255, 255, 0.02)";
const CARD = "rgba(255, 255, 255, 0.02)";
const BORDER = "rgba(148, 170, 215, 0.12)";
const MUTED = "#8b97ad";
const BLUE = "#4d9fff";
const GREEN = "#3ddc97";
const RED = "#ff6b6b";
const AMBER = "#f5b74e";
const MONO = "'JetBrains Mono', ui-monospace, monospace";

const fmtInt = (n: number) => n.toLocaleString("fr-FR");
const fmtMoney = (n: number) => `${n.toLocaleString("fr-FR")} $`;
const fmtCompact = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(Math.round(n));
};

export default function CreativeDemand() {
  const { clientId } = useParams();
  const { setSelectedClient } = useSelectedClient();
  const [targets, setTargets] = useState<any[]>([]);
  const [runs, setRuns] = useState<CreativeDemandRunRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ period_label: "", target_ad_spend: "25000", avg_cpm: "12.5", fatigue: "200000" });

  const load = async () => {
    if (!clientId) return;
    setLoading(true);
    const [c, t, r] = await Promise.all([
      supabase.from("gos_clients").select("*").eq("id", clientId).single(),
      supabase.from("gos_metric_targets").select("*").eq("client_id", clientId).order("created_at", { ascending: false }),
      fetchCreativeDemandRuns(clientId),
    ]);
    if (c.data) { setSelectedClient(c.data as any); }
    setTargets(t.data ?? []);
    setRuns(r);
    setLoading(false);
  };

  useEffect(() => { load(); }, [clientId]);

  const spend = Number(form.target_ad_spend) || 0;
  const cpm = Number(form.avg_cpm) || 0;
  const fatigue = Number(form.fatigue) || 0;
  const preview = useMemo(() => runCreativeDemand({
    weekly_spend: spend,
    avg_cpm: cpm,
    fatigue_threshold_impressions: fatigue,
  }), [spend, cpm, fatigue]);

  const submit = async () => {
    if (!form.period_label) { toast.error("Label requis"); return; }
    try {
      await createCreativeDemandRun(clientId!, {
        period_label: form.period_label,
        target_ad_spend: spend,
        avg_cpm: cpm,
        fatigue_threshold_impressions: fatigue,
      });
      toast.success("Demande créative calculée");
      setForm({ ...form, period_label: "" });
      load();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur de création de demande créative";
      toast.error(message);
    }
  };

  const fromLatestTarget = () => {
    const t = targets[0];
    if (!t) { toast.error("Aucune cible existante"); return; }
    const weekly = t.target_ad_spend ? Math.round(Number(t.target_ad_spend) / 4) : 0;
    setForm({ period_label: t.period_label, target_ad_spend: String(weekly), avg_cpm: form.avg_cpm, fatigue: form.fatigue });
  };

  if (loading) return <div style={{ height: 300, background: CARD, borderRadius: 8 }} />;

  // Gauge math — 12 is a "sane" upper anchor for weekly concepts
  const gaugeMax = Math.max(12, preview.creatives_per_week_needed);
  const gaugeRatio = Math.min(1, preview.creatives_per_week_needed / gaugeMax);
  const R = 110;
  const CIRC = 2 * Math.PI * R;
  const dashOffset = CIRC * (1 - gaugeRatio);

  const fatiguePct = preview.fatigue_load_pct;
  const fatigueColor = fatiguePct >= 70 ? RED : fatiguePct >= 40 ? AMBER : GREEN;
  const confidencePct = Math.round(preview.confidence * 100);

  return (
    <>
      <SectionHeader
        guide={{
          purpose: "Estime combien de nouveaux créatifs le client doit produire par semaine pour soutenir la dépense prévue sans fatigue publicitaire.",
          dataSource: "Prévisions (niveau de spend) · Vélocité créative historique.",
          usedBy: "Carte d'exécution · briefs équipe créative.",
          requiredInputs: ["Spend cible", "Fenêtre de fatigue créative", "Mix de formats"],
          nextStep: "Approuve le volume hebdo, puis intègre-le aux priorités de la Carte d'exécution.",
          primaryCta: "Calculer le besoin en créatifs",
        }}
        title="Besoin en créatifs"
        subtitle="Calculateur déterministe : spend hebdo ÷ CPM ÷ seuil de fatigue → concepts nouveaux par semaine."
        actions={
          <button className="gos-btn-secondary" onClick={load}>
            <RefreshCw size={14} style={{ verticalAlign: "middle", marginRight: 6 }} /> Actualiser
          </button>
        }
      />

      {/* Top input bandeau */}
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr 1fr 1fr auto", gap: 12, padding: 16, borderRadius: 12, border: `1px solid ${BORDER}`, background: CARD, marginBottom: 20 }}>
        <InputCell label="Label période">
          <input value={form.period_label} onChange={(e) => setForm({ ...form, period_label: e.target.value })} placeholder="Semaine 45"
            style={inputStyle()} />
        </InputCell>
        <InputCell label="Spend hebdo">
          <MoneyInput value={form.target_ad_spend} onChange={(v) => setForm({ ...form, target_ad_spend: v })} accent />
        </InputCell>
        <InputCell label="CPM moyen">
          <MoneyInput value={form.avg_cpm} onChange={(v) => setForm({ ...form, avg_cpm: v })} />
        </InputCell>
        <InputCell label="Seuil fatigue (impr.)">
          <input value={form.fatigue} onChange={(e) => setForm({ ...form, fatigue: e.target.value })} inputMode="numeric"
            style={inputStyle()} />
        </InputCell>
        <InputCell label="Depuis cible">
          <button className="gos-btn-secondary" onClick={fromLatestTarget} disabled={targets.length === 0} style={{ width: "100%", height: 38 }}>
            <Wand2 size={12} style={{ verticalAlign: "middle", marginRight: 4 }} /> Auto
          </button>
        </InputCell>
        <div style={{ display: "flex", alignItems: "flex-end" }}>
          <button onClick={submit} style={{
            height: 38, padding: "0 20px", background: BLUE, color: "white",
            border: "none", borderRadius: 8, fontWeight: 700, fontSize: 12,
            letterSpacing: "0.03em", textTransform: "uppercase", cursor: "pointer",
            fontFamily: MONO,
          }}>
            <Play size={14} style={{ verticalAlign: "middle", marginRight: 6 }} /> Calculer
          </button>
        </div>
      </div>

      {/* Workstation grid */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20, marginBottom: 20 }}>
        {/* Left: gauge */}
        <div style={{ position: "relative", padding: 32, borderRadius: 12, border: `1px solid ${BORDER}`, background: CARD, overflow: "hidden", boxShadow: "none" }}>
          <div style={{ position: "absolute", top: 16, left: 24, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: GREEN, boxShadow: `0 0 8px ${GREEN}` }} />
            <span style={{ fontFamily: MONO, fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: "0.03em" }}>
              Calculateur déterministe · v2.1
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 40 }}>
            <div style={{ position: "relative", width: 256, height: 256 }}>
              <svg width={256} height={256} style={{ transform: "rotate(-90deg)" }}>
                <circle cx={128} cy={128} r={R} stroke={BORDER} strokeWidth={12} fill="transparent" />
                <circle cx={128} cy={128} r={R} stroke={BLUE} strokeWidth={12} fill="transparent"
                  strokeDasharray={CIRC} strokeDashoffset={dashOffset} strokeLinecap="round"
                  style={{ transition: "stroke-dashoffset 400ms ease" }} />
              </svg>
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontFamily: MONO, fontSize: 56, fontWeight: 700, color: "var(--tdia-text)", lineHeight: 1 }}>
                  {String(preview.creatives_per_week_needed).padStart(2, "0")}
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.03em", marginTop: 8 }}>
                  Concepts / sem
                </span>
              </div>
            </div>

            <div style={{ marginTop: 32, width: "100%", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", borderTop: `1px solid ${BORDER}`, paddingTop: 24 }}>
              <StatCell label="Impressions" value={fmtCompact(preview.impressions_per_week)} />
              <StatCell label="Fatigue" value={`${fatiguePct}%`} color={fatigueColor} bordered />
              <StatCell label="Confiance" value={`${confidencePct}%`} color={GREEN} />
            </div>
          </div>
        </div>

        {/* Right: creative mix */}
        <div style={{ padding: 24, borderRadius: 12, border: `1px solid ${BORDER}`, background: CARD, display: "flex", flexDirection: "column", boxShadow: "none" }}>
          <h3 style={{ fontSize: 12, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 24 }}>
            Creative Mix
          </h3>
          <MixBar label="Statique" pct={50} units={preview.static_creatives_needed} color={BLUE} />
          <MixBar label="Vidéo" pct={35} units={preview.video_creatives_needed} color="#8b5cf6" />
          <MixBar label="UGC" pct={15} units={preview.ugc_creatives_needed} color="#f97316" />
          <div style={{ marginTop: "auto", padding: 12, borderRadius: 8, background: BG, border: `1px solid ${BORDER}`, fontFamily: MONO, fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: "0.03em", lineHeight: 1.6 }}>
            Formule : ceil((spend / CPM × 1000) / seuil_fatigue) · mix 50/35/15
          </div>
        </div>
      </div>

      {/* Runs ledger */}
      <div style={{ borderRadius: 12, border: `1px solid ${BORDER}`, background: CARD, overflow: "hidden" }}>
        <div style={{ padding: "12px 20px", background: "rgba(255, 255, 255, 0.02)", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${BORDER}` }}>
          <h3 style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.03em" }}>
            Historique des simulations
          </h3>
          <span style={{ fontFamily: MONO, fontSize: 10, color: MUTED }}>{runs.length} RUNS</span>
        </div>
        {runs.length === 0 ? (
          <EmptyState title="Aucun calcul" hint="Lance un premier calcul de demande créative." />
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.03em" }}>
                <Th>Période</Th>
                <Th>Spend</Th>
                <Th>CPM</Th>
                <Th>Fatigue</Th>
                <Th align="center" color={BLUE}>Stat.</Th>
                <Th align="center" color="#8b5cf6">Vid.</Th>
                <Th align="center" color="#f97316">UGC</Th>
                <Th align="right">Besoin total</Th>
              </tr>
            </thead>
            <tbody style={{ fontFamily: MONO, fontSize: 12 }}>
              {runs.map((r, i) => (
                <tr key={r.id} style={{ borderTop: i === 0 ? "none" : `1px solid ${BORDER}` }}>
                  <Td>{r.period_label}</Td>
                  <Td>{r.target_ad_spend != null ? fmtMoney(Number(r.target_ad_spend)) : "—"}</Td>
                  <Td color={MUTED}>{r.avg_cpm != null ? `${r.avg_cpm} $` : "—"}</Td>
                  <Td>{r.fatigue_threshold_impressions != null ? fmtInt(Number(r.fatigue_threshold_impressions)) : "—"}</Td>
                  <Td align="center">{r.static_creatives_needed ?? "—"}</Td>
                  <Td align="center">{r.video_creatives_needed ?? "—"}</Td>
                  <Td align="center">{r.ugc_creatives_needed ?? "—"}</Td>
                  <Td align="right" bold color={BLUE}>{r.creatives_per_week_needed ?? "—"} concepts</Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function inputStyle(): React.CSSProperties {
  return {
    width: "100%",
    background: BG,
    border: `1px solid ${BORDER}`,
    borderRadius: 8,
    padding: "8px 12px",
    fontFamily: MONO,
    fontSize: 13,
    color: "var(--tdia-text)",
    outline: "none",
    height: 38,
  };
}

function InputCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 10, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.03em" }}>{label}</label>
      {children}
    </div>
  );
}

function MoneyInput({ value, onChange, accent }: { value: string; onChange: (v: string) => void; accent?: boolean }) {
  return (
    <div style={{ position: "relative" }}>
      <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: MUTED, fontFamily: MONO, fontSize: 13 }}>$</span>
      <input value={value} inputMode="decimal" onChange={(e) => onChange(e.target.value)}
        style={{ ...inputStyle(), paddingLeft: 26, color: accent ? BLUE : "white", fontWeight: accent ? 700 : 500 }} />
    </div>
  );
}

function StatCell({ label, value, color, bordered }: { label: string; value: string; color?: string; bordered?: boolean }) {
  return (
    <div style={{ textAlign: "center", borderLeft: bordered ? `1px solid ${BORDER}` : "none", borderRight: bordered ? `1px solid ${BORDER}` : "none" }}>
      <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: MONO, fontSize: 18, fontWeight: 700, color: color ?? "white" }}>{value}</div>
    </div>
  );
}

function MixBar({ label, pct, units, color }: { label: string; pct: number; units: number; color: string }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 6 }}>
        <span style={{ color: MUTED, textTransform: "uppercase", letterSpacing: "0.03em", fontWeight: 600 }}>{label} ({pct}%)</span>
        <span style={{ fontFamily: MONO, color: "var(--tdia-text)", fontWeight: 700 }}>{units} units</span>
      </div>
      <div style={{ height: 8, width: "100%", background: BG, borderRadius: 999, overflow: "hidden", border: `1px solid ${BORDER}` }}>
        <div style={{ height: "100%", background: color, width: `${pct}%`, boxShadow: `0 0 8px ${color}80` }} />
      </div>
    </div>
  );
}

function Th({ children, align = "left", color }: { children: React.ReactNode; align?: "left" | "right" | "center"; color?: string }) {
  return <th style={{ padding: "12px 20px", textAlign: align, fontWeight: 700, borderBottom: `1px solid ${BORDER}`, color: color ?? MUTED }}>{children}</th>;
}

function Td({ children, align = "left", bold, color }: { children: React.ReactNode; align?: "left" | "right" | "center"; bold?: boolean; color?: string }) {
  return <td style={{ padding: "14px 20px", textAlign: align, color: color ?? "white", fontWeight: bold ? 700 : 400 }}>{children}</td>;
}
