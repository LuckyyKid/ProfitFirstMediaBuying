import { useMemo, useState, CSSProperties } from "react";
import {
  useClientPortalData,
  type Kpi,
  type WaterfallItem,
  type ShopifyStat,
  type Campaign,
  type Totals,
  type PeriodData,
  type Period,
  type Platform,
  type Tone,
} from "@/hooks/useClientPortalData";

// ============================================================
// Portail Client TDIA — Profit First Media Buying
// 4 vues internes (Vue d'ensemble / Performance / Rapports / Documents)
// Style : Premium Dark (fond #060910 + halo bleu, hairlines, Inter/JetBrains/Instrument).
// Toutes les valeurs affichées proviennent de useClientPortalData(clientId, period).
// Tant que la donnée n'est pas branchée, l'utilisateur voit un empty state.
// ============================================================

type Page = "overview" | "performance" | "reports" | "docs";

// Prevent tree-shaking of type-only imports referenced elsewhere in JSX (Campaign, Totals, Kpi…).
export type { Campaign, Totals, Kpi, WaterfallItem, ShopifyStat };

const MONO = "'JetBrains Mono', ui-monospace, monospace";
const SERIF = "'Instrument Serif', ui-serif, Georgia, serif";
const TONE_COLOR: Record<Tone, string> = {
  good: "#3ddc97",
  watch: "#f5b74e",
  bad: "#ff6b6b",
  neutral: "#8b97ad",
};
const TONE_GLOW: Record<Tone, string> = {
  good: "rgba(61,220,151,.8)",
  watch: "rgba(245,183,78,.8)",
  bad: "rgba(255,107,107,.8)",
  neutral: "transparent",
};

// Note: aucune donnée statique n'est déclarée ici — tout arrive via
// useClientPortalData(clientId, period). Voir @/hooks/useClientPortalData.

// -----------------------------------------------------------
// Composant principal
// -----------------------------------------------------------
type PortalClientProps = {
  clientCode: string;
  onLogout?: () => Promise<void> | void;
};

export default function PortalClient({ clientCode, onLogout }: PortalClientProps) {
  const [page, setPage] = useState<Page>("overview");
  const [period, setPeriod] = useState<Period>("30j");
  const [platform, setPlatform] = useState<Platform>("all");
  const [approved, setApproved] = useState(false);

  const { data, loading, error } = useClientPortalData(clientCode, period);
  const periodData = data?.period ?? null;
  const periodLabel = period === "30j" ? "CYCLE · 30 J" : "7 DERNIERS JOURS";

  const filteredCampaigns = useMemo(
    () => {
      if (!periodData) return [];
      return platform === "all"
        ? periodData.campaigns
        : periodData.campaigns.filter((c) => c.platform === platform);
    },
    [periodData, platform],
  );
  const counts = periodData
    ? {
        all: periodData.campaigns.length,
        meta: periodData.campaigns.filter((c) => c.platform === "meta").length,
        google: periodData.campaigns.filter((c) => c.platform === "google").length,
      }
    : { all: 0, meta: 0, google: 0 };
  const totals: Totals = periodData?.totals[platform] ?? {
    spend: "—",
    revenue: "—",
    roas: "—",
    cac: "—",
    orders: "—",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(1100px 480px at 50% -10%,rgba(47,107,255,.13),transparent 60%),#060910",
        color: "#eef2fa",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      <PulseKeyframes />
      <Header page={page} setPage={setPage} onLogout={onLogout} />

      {loading && <LoadingState />}
      {!loading && !data && <EmptyState page={page} error={error} />}

      {!loading && data && page === "overview" && (
        <Overview
          approved={approved}
          approve={() => setApproved(true)}
          unapprove={() => setApproved(false)}
          goPerformance={() => setPage("performance")}
          goReports={() => setPage("reports")}
        />
      )}
      {!loading && data && page === "performance" && periodData && (
        <Performance
          period={period}
          setPeriod={setPeriod}
          platform={platform}
          setPlatform={setPlatform}
          data={periodData}
          totals={totals}
          counts={counts}
          filteredCampaigns={filteredCampaigns}
          periodLabel={periodLabel}
        />
      )}
      {!loading && data && page === "reports" && (
        <ListPage title="Rapports" accent="exécutifs" microlabel="VOS RAPPORTS" items={data.reports} action="Télécharger →" />
      )}
      {!loading && data && page === "docs" && (
        <ListPage title="Documents" accent="partagés" microlabel="VOS DOCUMENTS" items={data.docs} action="Ouvrir →" />
      )}
    </div>
  );
}

function LoadingState() {
  return (
    <main style={{ maxWidth: 1280, margin: "0 auto", padding: "80px 48px", textAlign: "center" }}>
      <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: ".2em", color: "#8b97ad" }}>
        CHARGEMENT DE VOS DONNÉES…
      </div>
    </main>
  );
}

function EmptyState({ page, error }: { page: Page; error: string | null }) {
  const label: Record<Page, string> = {
    overview: "Vue d'ensemble",
    performance: "Performance",
    reports: "Rapports",
    docs: "Documents",
  };
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "80px 48px", textAlign: "center" }}>
      <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".24em", color: "#8b97ad" }}>
        {label[page].toUpperCase()}
      </div>
      <h1 style={{ margin: "12px 0 14px", fontSize: 26, fontWeight: 400, letterSpacing: "-.02em", color: "#eef2fa" }}>
        Aucune donnée à afficher pour l'instant
      </h1>
      <p style={{ fontSize: 13.5, lineHeight: 1.7, color: "#8b97ad", maxWidth: 520, margin: "0 auto" }}>
        Vos données Meta, Google Ads et Shopify seront synchronisées ici dès que
        votre account manager aura terminé la configuration. Vous recevrez une
        notification par email au moment de la mise en ligne.
      </p>
      {error && (
        <div style={{ marginTop: 20, fontSize: 11, color: "#ff9c9c", fontFamily: MONO }}>
          Détail technique : {error}
        </div>
      )}
    </main>
  );
}

// -----------------------------------------------------------
// Header + nav
// -----------------------------------------------------------
function PulseKeyframes() {
  return (
    <style>{`@keyframes ompulse{0%,100%{opacity:1}50%{opacity:.35}}`}</style>
  );
}

function Header({
  page,
  setPage,
  onLogout,
}: {
  page: Page;
  setPage: (p: Page) => void;
  onLogout?: () => Promise<void> | void;
}) {
  const tabs: { id: Page; label: string }[] = [
    { id: "overview", label: "Vue d'ensemble" },
    { id: "performance", label: "Performance" },
    { id: "reports", label: "Rapports" },
    { id: "docs", label: "Documents" },
  ];
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        gap: 24,
        padding: "18px 48px",
        borderBottom: "1px solid rgba(148,170,215,.1)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <div style={{ width: 24, height: 24, borderRadius: 6, background: "linear-gradient(135deg,#4d9fff,#2f6bff)" }} />
        <span style={{ fontFamily: SERIF, fontSize: 20, color: "#eef2fa" }}>TDIA</span>
        <span style={{ fontSize: 9, letterSpacing: ".22em", color: "#5f6b82", fontFamily: MONO, marginLeft: 4 }}>
          PORTAIL CLIENT
        </span>
      </div>
      <nav style={{ display: "flex", gap: 6, marginLeft: 20 }}>
        {tabs.map((t) => {
          const active = t.id === page;
          const style: CSSProperties = active
            ? {
                padding: "7px 14px",
                borderRadius: 8,
                background: "rgba(77,159,255,.12)",
                border: "1px solid rgba(77,159,255,.22)",
                color: "#9ec8ff",
                fontSize: 12.5,
                fontWeight: 600,
                cursor: "pointer",
              }
            : {
                padding: "7px 14px",
                borderRadius: 8,
                border: "1px solid transparent",
                color: "#8b97ad",
                fontSize: 12.5,
                cursor: "pointer",
              };
          return (
            <span key={t.id} style={style} onClick={() => setPage(t.id)}>
              {t.label}
            </span>
          );
        })}
      </nav>
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: 99,
              background: "#3ddc97",
              boxShadow: "0 0 8px rgba(61,220,151,.8)",
              animation: "ompulse 2s ease-in-out infinite",
            }}
          />
          <span style={{ fontSize: 9.5, letterSpacing: ".14em", color: "#3ddc97", fontFamily: MONO }}>
            SYNCHRO MÉTA · GOOGLE · SHOPIFY — 08:00
          </span>
        </div>
        {onLogout && (
          <button
            type="button"
            onClick={() => { void onLogout(); }}
            style={{
              padding: "7px 14px",
              borderRadius: 99,
              border: "1px solid rgba(148,170,215,.16)",
              background: "rgba(255,255,255,.02)",
              color: "#c8d2e4",
              fontSize: 12,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Se déconnecter
          </button>
        )}
      </div>
    </header>
  );
}

// -----------------------------------------------------------
// Page 1 — Vue d'ensemble
// -----------------------------------------------------------
type OverviewProps = {
  approved: boolean;
  approve: () => void;
  unapprove: () => void;
  goPerformance: () => void;
  goReports: () => void;
};

function Overview({ approved, approve, unapprove, goPerformance, goReports }: OverviewProps) {
  return (
    <main style={{ maxWidth: 1280, margin: "0 auto", padding: "36px 48px 70px" }}>
      {/* Salutation + carte AM */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 20, marginBottom: 28 }}>
        <div>
          <div style={{ fontSize: 10, color: "#8b97ad", fontFamily: MONO, letterSpacing: ".18em" }}>
            LUNDI 3 AOÛT · CYCLE 2 · JOUR 18/30
          </div>
          <h1 style={{ margin: "6px 0 0", fontSize: 30, fontWeight: 400, letterSpacing: "-.025em", color: "#eef2fa" }}>
            Bonjour{" "}
            <span style={{ fontFamily: SERIF, fontStyle: "italic", color: "#9ec8ff" }}>Emma</span>
          </h1>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 11, color: "#8b97ad" }}>Votre Account Manager</span>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              padding: "7px 14px",
              borderRadius: 99,
              border: "1px solid rgba(148,170,215,.16)",
              background: "rgba(255,255,255,.02)",
            }}
          >
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: 99,
                background: "rgba(148,170,215,.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 10,
                fontWeight: 700,
                color: "#c8d2e4",
              }}
            >
              SM
            </div>
            <span style={{ fontSize: 12, color: "#eef2fa", fontWeight: 500 }}>Sarah M.</span>
            <span style={{ fontSize: 11.5, color: "#9ec8ff", cursor: "pointer", marginLeft: 4 }}>Écrire →</span>
          </div>
        </div>
      </div>

      {/* Hero d'approbation */}
      {!approved && (
        <div
          style={{
            background:
              "linear-gradient(135deg,rgba(77,159,255,.45),rgba(77,159,255,.05) 40%,rgba(148,170,215,.1))",
            borderRadius: 18,
            padding: 1,
            marginBottom: 30,
            boxShadow: "0 24px 80px rgba(47,107,255,.15)",
          }}
        >
          <div
            style={{
              background: "linear-gradient(135deg,#0b1322,#080d18)",
              borderRadius: 17,
              padding: "22px 28px",
              display: "flex",
              alignItems: "center",
              gap: 26,
            }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 99,
                    background: "#4d9fff",
                    boxShadow: "0 0 10px rgba(77,159,255,.9)",
                    animation: "ompulse 2s ease-in-out infinite",
                  }}
                />
                <span style={{ fontSize: 9.5, letterSpacing: ".28em", fontWeight: 600, color: "#9ec8ff", fontFamily: MONO }}>
                  VOTRE APPROBATION EST ATTENDUE
                </span>
              </div>
              <div style={{ fontSize: 19, fontWeight: 500, color: "#eef2fa", letterSpacing: "-.01em" }}>
                Augmenter le budget Google de{" "}
                <span style={{ fontFamily: MONO }}>6 900 $ → 11 500 $</span> / mois
              </div>
              <div style={{ fontSize: 12.5, color: "#8b97ad", marginTop: 6, lineHeight: 1.6, maxWidth: 640 }}>
                Vos campagnes Google sont <strong style={{ color: "#c8d2e4" }}>48 % sous le plan</strong> alors que chaque
                dollar y rapporte davantage que prévu. Sarah recommande d'ouvrir les plafonds — impact estimé :{" "}
                <strong style={{ color: "#3ddc97" }}>+3 400 $ de contribution</strong> ce cycle. Le CAC cible de 45 $ reste
                garanti par nos garde-fous.
              </div>
            </div>
            <div style={{ flex: "none", display: "flex", gap: 10 }}>
              <div
                style={{
                  padding: "12px 18px",
                  borderRadius: 10,
                  border: "1px solid rgba(148,170,215,.2)",
                  color: "#c8d2e4",
                  fontSize: 12.5,
                  fontWeight: 500,
                  cursor: "pointer",
                  background: "rgba(255,255,255,.02)",
                }}
              >
                Poser une question
              </div>
              <div
                onClick={approve}
                style={{
                  padding: "12px 22px",
                  borderRadius: 10,
                  background: "linear-gradient(135deg,#4d9fff,#2f6bff)",
                  color: "#fff",
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: "pointer",
                  boxShadow: "0 8px 28px rgba(47,107,255,.4), inset 0 1px 0 rgba(255,255,255,.25)",
                }}
              >
                Approuver l'augmentation
              </div>
            </div>
          </div>
        </div>
      )}

      {approved && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "16px 24px",
            marginBottom: 30,
            background: "linear-gradient(135deg,rgba(61,220,151,.08),rgba(255,255,255,.015))",
            border: "1px solid rgba(61,220,151,.3)",
            borderRadius: 14,
          }}
        >
          <span
            style={{
              width: 26,
              height: 26,
              flex: "none",
              borderRadius: 99,
              background: "rgba(61,220,151,.15)",
              border: "1px solid rgba(61,220,151,.4)",
              color: "#3ddc97",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
            }}
          >
            ✓
          </span>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: "#eef2fa" }}>
              Augmentation approuvée — Sarah applique le changement aujourd'hui
            </div>
            <div style={{ fontSize: 11, color: "#8b97ad", marginTop: 2 }}>
              Budget Google 6 900 $ → 11 500 $ / mois · tracé au journal · trace auditée #GT-2231
            </div>
          </div>
          <span style={{ marginLeft: "auto", fontSize: 11, color: "#9ec8ff", cursor: "pointer" }} onClick={unapprove}>
            Annuler
          </span>
        </div>
      )}

      {/* Section KPIs hairline */}
      <SectionHeader label="VOTRE PROFIT CE CYCLE" right={
        <>
          <span style={{ fontSize: 10, color: "#5f6b82", fontFamily: MONO }}>18 JOURS SUR 30</span>
          <span style={{ fontSize: 11, color: "#9ec8ff", cursor: "pointer" }} onClick={goPerformance}>
            Voir le détail →
          </span>
        </>
      } />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.4fr 1fr 1fr 1fr",
          marginBottom: 34,
          borderTop: "1px solid rgba(148,170,215,.12)",
          borderBottom: "1px solid rgba(148,170,215,.12)",
        }}
      >
        <div style={{ padding: "22px 24px 22px 0" }}>
          <div style={{ fontSize: 9, letterSpacing: ".2em", color: "#8b97ad", fontFamily: MONO }}>
            MARGE DE CONTRIBUTION
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 8 }}>
            <span style={{ fontFamily: MONO, fontSize: 34, fontWeight: 300, color: "#eef2fa", letterSpacing: "-.02em" }}>
              41 210 $
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 5, height: 5, borderRadius: 99, background: "#3ddc97", boxShadow: "0 0 8px rgba(61,220,151,.8)" }} />
              <span style={{ fontSize: 10.5, color: "#3ddc97", fontFamily: MONO }}>+1,0% VS PLAN</span>
            </span>
          </div>
          <div style={{ fontSize: 11, color: "#5f6b82", marginTop: 6 }}>
            l'argent qui reste après produit, livraison et publicité
          </div>
        </div>
        {[
          { label: "REVENU", value: "182 450 $", tone: "watch" as Tone, delta: "−5,6% VS PLAN" },
          { label: "EFFICACITÉ (MER)", value: "4,43×", tone: "good" as Tone, delta: "+34,9% VS PLAN" },
        ].map((k) => (
          <div key={k.label} style={{ padding: "22px 24px", borderLeft: "1px solid rgba(148,170,215,.12)" }}>
            <div style={{ fontSize: 9, letterSpacing: ".2em", color: "#8b97ad", fontFamily: MONO }}>{k.label}</div>
            <div style={{ marginTop: 8, fontFamily: MONO, fontSize: 24, fontWeight: 300, color: "#eef2fa" }}>{k.value}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 6 }}>
              <span style={{ width: 5, height: 5, borderRadius: 99, background: TONE_COLOR[k.tone] }} />
              <span style={{ fontSize: 10, color: TONE_COLOR[k.tone], fontFamily: MONO }}>{k.delta}</span>
            </div>
          </div>
        ))}
        <div style={{ padding: "22px 0 22px 24px", borderLeft: "1px solid rgba(148,170,215,.12)" }}>
          <div style={{ fontSize: 9, letterSpacing: ".2em", color: "#8b97ad", fontFamily: MONO }}>COÛT PAR CLIENT</div>
          <div style={{ marginTop: 8, fontFamily: MONO, fontSize: 24, fontWeight: 300, color: "#eef2fa" }}>22,60 $</div>
          <div style={{ fontSize: 10, color: "#5f6b82", fontFamily: MONO, marginTop: 6 }}>CIBLE ≤ 45 $</div>
        </div>
      </div>

      {/* Journal + parcours */}
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 22 }}>
        <div>
          <SectionHeader label="CE QUE TDIA A FAIT POUR VOUS" right={<span style={{ fontSize: 10, color: "#5f6b82", fontFamily: MONO }}>7 DERNIERS JOURS</span>} />
          <div
            style={{
              background: "rgba(255,255,255,.02)",
              border: "1px solid rgba(148,170,215,.12)",
              borderRadius: 14,
              padding: "6px 22px",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,.03)",
            }}
          >
            <div style={{ position: "relative", display: "flex", flexDirection: "column" }}>
              <div style={{ position: "absolute", left: 8, top: 22, bottom: 22, width: 1, background: "rgba(148,170,215,.12)" }} />
              <JournalEntry
                title="3 nouvelles publicités lancées — angle « peau sensible »"
                body="Testées sur votre audience principale. La meilleure fait déjà −18 % de coût par achat vs votre moyenne."
                meta="VENDREDI · CRÉATIF"
                divider
              />
              <JournalEntry
                title="Campagne « UGC-Hydra-03 » resserrée avant qu'elle ne coûte trop cher"
                body="Son coût par achat dépassait votre seuil de rentabilité — plafond abaissé à 45 $, sans couper la campagne."
                meta="MERCREDI · MEDIA BUYING"
                divider
              />
              <JournalEntry
                title="Diagnostic hebdomadaire : votre frein n'est pas l'efficacité, c'est le volume"
                body="Vos publicités performent au-dessus du plan — c'est le budget qui limite la croissance. D'où la demande d'augmentation ci-dessus."
                meta="LUNDI · DIAGNOSTIC"
              />
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, fontSize: 11.5, color: "#5f6b82" }}>
            Chaque action est tracée et auditée ·{" "}
            <span style={{ color: "#9ec8ff", cursor: "pointer" }}>voir le journal complet →</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div>
            <SectionHeader label="VOTRE PARCOURS — CYCLE 2" />
            <div
              style={{
                background: "rgba(255,255,255,.02)",
                border: "1px solid rgba(148,170,215,.12)",
                borderRadius: 14,
                padding: "18px 20px",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,.03)",
              }}
            >
              <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 2 }}>
                <div
                  style={{
                    position: "absolute",
                    left: 10,
                    top: 14,
                    bottom: 14,
                    width: 1,
                    background:
                      "linear-gradient(180deg,rgba(61,220,151,.5),rgba(61,220,151,.5) 30%,rgba(77,159,255,.6) 48%,rgba(148,170,215,.12) 65%)",
                  }}
                />
                <JourneyStep done label="Audit & diagnostic" />
                <JourneyStep done label="Fuites de conversion réparées" />
                <div
                  style={{
                    position: "relative",
                    display: "flex",
                    gap: 12,
                    padding: "9px 10px",
                    margin: "0 -10px",
                    alignItems: "flex-start",
                    background: "linear-gradient(135deg,rgba(77,159,255,.12),rgba(47,107,255,.03))",
                    border: "1px solid rgba(77,159,255,.25)",
                    borderRadius: 10,
                  }}
                >
                  <div
                    style={{
                      width: 21,
                      height: 21,
                      flex: "none",
                      borderRadius: 99,
                      background: "linear-gradient(135deg,#4d9fff,#2f6bff)",
                      color: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 9,
                      fontWeight: 700,
                      boxShadow: "0 0 12px rgba(47,107,255,.8)",
                      zIndex: 1,
                    }}
                  >
                    3
                  </div>
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: "#9ec8ff" }}>Scaling de vos campagnes</div>
                    <div style={{ fontSize: 9.5, color: "#8b97ad", fontFamily: MONO, marginTop: 2 }}>
                      {approved ? "APPROUVÉ — EN COURS D'APPLICATION" : "EN COURS · VOTRE APPROBATION ATTENDUE"}
                    </div>
                  </div>
                </div>
                <JourneyStep index={4} label="Optimisation des gagnantes" />
                <JourneyStep locked label="Bilan du cycle 2" subLabel="· 15 août" />
              </div>
            </div>
          </div>

          <div>
            <SectionHeader label="À VENIR" />
            <div
              style={{
                background: "rgba(255,255,255,.02)",
                border: "1px solid rgba(148,170,215,.12)",
                borderRadius: 14,
                padding: "16px 20px",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,.03)",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <UpcomingRow day="06" month="AOÛT" title="Call hebdomadaire avec Sarah" meta="Jeudi · 10:00 · 30 min" cta="Lien →" />
              <div style={{ height: 1, background: "rgba(148,170,215,.07)" }} />
              <UpcomingRow day="07" month="AOÛT" title="Rapport exécutif hebdomadaire" meta="Envoyé vendredi matin · PDF" cta="Rapports →" onCta={goReports} />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function SectionHeader({ label, right }: { label: string; right?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 14 }}>
      <span style={{ fontSize: 9.5, letterSpacing: ".28em", fontWeight: 600, color: "#8b97ad", fontFamily: MONO }}>
        {label}
      </span>
      <div style={{ height: 1, flex: 1, background: "linear-gradient(90deg,rgba(148,170,215,.15),transparent)" }} />
      {right}
    </div>
  );
}

function JournalEntry({ title, body, meta, divider }: { title: string; body: string; meta: string; divider?: boolean }) {
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        gap: 16,
        padding: "16px 0",
        borderBottom: divider ? "1px solid rgba(148,170,215,.07)" : "none",
      }}
    >
      <div
        style={{
          width: 17,
          height: 17,
          flex: "none",
          borderRadius: 99,
          background: "#060910",
          border: "1px solid rgba(61,220,151,.5)",
          color: "#3ddc97",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 8,
          zIndex: 1,
          marginTop: 1,
        }}
      >
        ✓
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, color: "#eef2fa", fontWeight: 500 }}>{title}</div>
        <div style={{ fontSize: 11.5, color: "#8b97ad", marginTop: 3, lineHeight: 1.5 }}>{body}</div>
        <div style={{ fontSize: 9.5, color: "#5f6b82", fontFamily: MONO, marginTop: 5 }}>{meta}</div>
      </div>
    </div>
  );
}

function JourneyStep({
  done,
  index,
  locked,
  label,
  subLabel,
}: {
  done?: boolean;
  index?: number;
  locked?: boolean;
  label: string;
  subLabel?: string;
}) {
  const nodeStyle: CSSProperties = done
    ? {
        width: 21,
        height: 21,
        flex: "none",
        borderRadius: 99,
        background: "#060910",
        border: "1px solid rgba(61,220,151,.5)",
        color: "#3ddc97",
      }
    : locked
    ? {
        width: 21,
        height: 21,
        flex: "none",
        borderRadius: 99,
        background: "#060910",
        border: "1px dashed rgba(148,170,215,.28)",
        color: "#5f6b82",
      }
    : {
        width: 21,
        height: 21,
        flex: "none",
        borderRadius: 99,
        background: "#060910",
        border: "1px solid rgba(148,170,215,.25)",
        color: "#8b97ad",
      };
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        gap: 12,
        padding: "7px 0",
        alignItems: "center",
        opacity: locked ? 0.55 : 1,
      }}
    >
      <div
        style={{
          ...nodeStyle,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: done ? 9 : locked ? 8 : 9,
          fontWeight: 700,
          zIndex: 1,
        }}
      >
        {done ? "✓" : locked ? "🔒" : index}
      </div>
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: done ? "#8b97ad" : locked ? "#8b97ad" : "#c8d2e4",
          textDecoration: done ? "line-through" : "none",
        }}
      >
        {label}{subLabel && <span style={{ fontSize: 10, color: "#5f6b82", fontWeight: 400 }}> {subLabel}</span>}
      </div>
    </div>
  );
}

function UpcomingRow({
  day,
  month,
  title,
  meta,
  cta,
  onCta,
}: {
  day: string;
  month: string;
  title: string;
  meta: string;
  cta: string;
  onCta?: () => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ flex: "none", width: 38, textAlign: "center" }}>
        <div style={{ fontFamily: MONO, fontSize: 16, fontWeight: 500, color: "#eef2fa", lineHeight: 1 }}>{day}</div>
        <div style={{ fontSize: 8, letterSpacing: ".12em", color: "#5f6b82", fontFamily: MONO }}>{month}</div>
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12.5, color: "#eef2fa", fontWeight: 500 }}>{title}</div>
        <div style={{ fontSize: 10.5, color: "#8b97ad" }}>{meta}</div>
      </div>
      <span
        onClick={onCta}
        style={{ marginLeft: "auto", fontSize: 11, color: "#9ec8ff", cursor: "pointer" }}
      >
        {cta}
      </span>
    </div>
  );
}

// -----------------------------------------------------------
// Page 2 — Performance
// -----------------------------------------------------------
type PerformanceProps = {
  period: Period;
  setPeriod: (p: Period) => void;
  platform: Platform;
  setPlatform: (p: Platform) => void;
  data: PeriodData;
  totals: Totals;
  counts: Record<Platform, number>;
  filteredCampaigns: Campaign[];
  periodLabel: string;
};

function Performance({
  period,
  setPeriod,
  platform,
  setPlatform,
  data,
  totals,
  counts,
  filteredCampaigns,
  periodLabel,
}: PerformanceProps) {
  return (
    <main style={{ maxWidth: 1280, margin: "0 auto", padding: "36px 48px 70px" }}>
      {/* En-tête + toggle période */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 20, marginBottom: 26 }}>
        <div>
          <div style={{ fontSize: 10, color: "#8b97ad", fontFamily: MONO, letterSpacing: ".18em" }}>
            CYCLE 2 · JOUR 18/30
          </div>
          <h1 style={{ margin: "6px 0 0", fontSize: 28, fontWeight: 400, letterSpacing: "-.025em", color: "#eef2fa" }}>
            Performance &{" "}
            <span style={{ fontFamily: SERIF, fontStyle: "italic", color: "#9ec8ff" }}>rentabilité</span>
          </h1>
        </div>
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            gap: 6,
            padding: 4,
            borderRadius: 11,
            background: "rgba(255,255,255,.02)",
            border: "1px solid rgba(148,170,215,.12)",
          }}
        >
          {(["7j", "30j"] as Period[]).map((p) => {
            const active = p === period;
            const label = p === "7j" ? "7 derniers jours" : "Cycle complet (30 j)";
            return (
              <div
                key={p}
                onClick={() => setPeriod(p)}
                style={
                  active
                    ? {
                        padding: "7px 15px",
                        borderRadius: 8,
                        background: "linear-gradient(135deg,rgba(77,159,255,.16),rgba(47,107,255,.06))",
                        border: "1px solid rgba(77,159,255,.3)",
                        color: "#9ec8ff",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                      }
                    : {
                        padding: "7px 15px",
                        borderRadius: 8,
                        border: "1px solid transparent",
                        color: "#8b97ad",
                        fontSize: 12,
                        cursor: "pointer",
                      }
                }
              >
                {label}
              </div>
            );
          })}
        </div>
      </div>

      {/* KPIs — rangée hairline */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.35fr 1fr 1fr 1fr 1fr",
          marginBottom: 40,
          borderTop: "1px solid rgba(148,170,215,.12)",
          borderBottom: "1px solid rgba(148,170,215,.12)",
        }}
      >
        {data.kpis.map((k, i) => (
          <div
            key={k.label}
            style={{
              padding: i === 0 ? "22px 24px 22px 0" : "22px 24px",
              borderLeft: i === 0 ? "none" : "1px solid rgba(148,170,215,.12)",
            }}
          >
            <div style={{ fontSize: 9, letterSpacing: ".2em", color: "#8b97ad", fontFamily: MONO }}>{k.label}</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 9, marginTop: 9, flexWrap: "wrap" }}>
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: k.big ? 34 : 23,
                  fontWeight: 300,
                  color: "#eef2fa",
                  letterSpacing: "-.02em",
                }}
              >
                {k.value}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: 99,
                    background: TONE_COLOR[k.tone],
                    boxShadow: `0 0 8px ${TONE_GLOW[k.tone]}`,
                    display: "inline-block",
                  }}
                />
                <span style={{ fontSize: 10, color: TONE_COLOR[k.tone], fontFamily: MONO }}>{k.delta}</span>
              </span>
            </div>
            <div style={{ fontSize: 10.5, color: "#5f6b82", marginTop: 5 }}>{k.note}</div>
          </div>
        ))}
      </div>

      {/* Où va chaque dollar + boutique Shopify */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 26, marginBottom: 44 }}>
        <div>
          <SectionHeader label="OÙ VA CHAQUE DOLLAR" />
          <div
            style={{
              background: "rgba(255,255,255,.02)",
              border: "1px solid rgba(148,170,215,.12)",
              borderRadius: 14,
              padding: "22px 24px",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,.03)",
            }}
          >
            {data.waterfall.map((w, i) => (
              <div key={w.label} style={{ marginBottom: i === data.waterfall.length - 1 ? 0 : 14 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: w.bold ? "#eef2fa" : "#8b97ad", fontWeight: w.bold ? 600 : 400 }}>
                    {w.label}
                  </span>
                  <span style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 12.5, color: "#eef2fa" }}>{w.amount}</span>
                  <span style={{ fontFamily: MONO, fontSize: 10, color: "#5f6b82", width: 44, textAlign: "right" }}>
                    {w.pct}
                  </span>
                </div>
                <div
                  style={{
                    height: 5,
                    background: "rgba(148,170,215,.08)",
                    borderRadius: 99,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${w.w}%`,
                      height: "100%",
                      background: w.color,
                      borderRadius: 99,
                      boxShadow: w.bold ? `0 0 8px ${w.color}66` : "none",
                    }}
                  />
                </div>
              </div>
            ))}
            <div
              style={{
                marginTop: 18,
                paddingTop: 16,
                borderTop: "1px solid rgba(148,170,215,.1)",
                fontSize: 11,
                lineHeight: 1.6,
                color: "#8b97ad",
              }}
            >
              <span style={{ fontFamily: SERIF, fontStyle: "italic", color: "#c8d2e4" }}>Lecture :</span>{" "}
              {data.waterfallReading}
            </div>
          </div>
        </div>

        <div>
          <SectionHeader
            label="VOTRE BOUTIQUE SHOPIFY"
            right={<span style={{ fontSize: 10, color: "#5f6b82", fontFamily: MONO }}>{periodLabel}</span>}
          />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 12 }}>
            {data.shopify.map((s) => (
              <div
                key={s.label}
                style={{
                  background: "rgba(255,255,255,.02)",
                  border: "1px solid rgba(148,170,215,.12)",
                  borderRadius: 12,
                  padding: "15px 17px",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,.03)",
                }}
              >
                <div style={{ fontSize: 9, letterSpacing: ".16em", color: "#8b97ad", fontFamily: MONO }}>{s.label}</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 7, marginTop: 7 }}>
                  <span style={{ fontFamily: MONO, fontSize: 19, fontWeight: 300, color: "#eef2fa" }}>{s.value}</span>
                  <span style={{ fontSize: 9.5, color: TONE_COLOR[s.tone], fontFamily: MONO }}>{s.delta}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Campagnes par plateforme */}
      <SectionHeader label="VOS CAMPAGNES PAR PLATEFORME" />
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {(["all", "meta", "google"] as Platform[]).map((p) => {
          const active = p === platform;
          const label = p === "all" ? "Toutes" : p === "meta" ? "Meta" : "Google";
          return (
            <div
              key={p}
              onClick={() => setPlatform(p)}
              style={
                active
                  ? {
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                      padding: "7px 15px",
                      borderRadius: 9,
                      background: "linear-gradient(135deg,rgba(77,159,255,.14),rgba(47,107,255,.05))",
                      border: "1px solid rgba(77,159,255,.28)",
                      color: "#9ec8ff",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                    }
                  : {
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                      padding: "7px 15px",
                      borderRadius: 9,
                      background: "rgba(255,255,255,.02)",
                      border: "1px solid rgba(148,170,215,.12)",
                      color: "#8b97ad",
                      fontSize: 12,
                      cursor: "pointer",
                    }
              }
            >
              {label}{" "}
              <span style={{ fontFamily: MONO, fontSize: 9.5, color: active ? "#9ec8ff" : "#5f6b82" }}>
                {counts[p]}
              </span>
            </div>
          );
        })}
      </div>

      <div
        style={{
          background: "rgba(255,255,255,.02)",
          border: "1px solid rgba(148,170,215,.12)",
          borderRadius: 14,
          overflow: "hidden",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,.03)",
          marginBottom: 14,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2.4fr 1fr 1fr 1fr .8fr .8fr 1fr",
            gap: 12,
            padding: "11px 22px",
            borderBottom: "1px solid rgba(148,170,215,.1)",
            fontSize: 8.5,
            fontWeight: 700,
            letterSpacing: ".2em",
            color: "#5f6b82",
            fontFamily: MONO,
          }}
        >
          <div>CAMPAGNE</div>
          <div>PLATEFORME</div>
          <div style={{ textAlign: "right" }}>DÉPENSÉ</div>
          <div style={{ textAlign: "right" }}>REVENU</div>
          <div style={{ textAlign: "right" }}>ROAS</div>
          <div style={{ textAlign: "right" }}>CAC</div>
          <div style={{ textAlign: "right" }}>COMMANDES</div>
        </div>
        {filteredCampaigns.map((c) => {
          const platformLabel = c.platform === "meta" ? "Meta" : "Google";
          const badge =
            c.platform === "meta"
              ? { background: "rgba(77,159,255,.1)", border: "1px solid rgba(77,159,255,.25)", color: "#9ec8ff" }
              : { background: "rgba(61,220,151,.08)", border: "1px solid rgba(61,220,151,.22)", color: "#3ddc97" };
          return (
            <div
              key={c.name}
              style={{
                display: "grid",
                gridTemplateColumns: "2.4fr 1fr 1fr 1fr .8fr .8fr 1fr",
                gap: 12,
                padding: "13px 22px",
                borderBottom: "1px solid rgba(148,170,215,.06)",
                alignItems: "center",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 99,
                    background: TONE_COLOR[c.tone],
                    boxShadow: `0 0 8px ${TONE_GLOW[c.tone]}`,
                    flex: "none",
                  }}
                />
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 12.5,
                      fontWeight: 500,
                      color: "#eef2fa",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {c.name}
                  </div>
                  <div
                    style={{
                      fontSize: 8.5,
                      letterSpacing: ".12em",
                      color: TONE_COLOR[c.tone],
                      fontFamily: MONO,
                      marginTop: 3,
                    }}
                  >
                    {c.status}
                  </div>
                </div>
              </div>
              <div>
                <span
                  style={{
                    padding: "3px 10px",
                    borderRadius: 6,
                    fontSize: 10,
                    fontWeight: 600,
                    ...badge,
                  }}
                >
                  {platformLabel}
                </span>
              </div>
              <div style={{ textAlign: "right", fontFamily: MONO, fontSize: 12, color: "#c8d2e4" }}>{c.spend}</div>
              <div style={{ textAlign: "right", fontFamily: MONO, fontSize: 12, color: "#eef2fa" }}>{c.revenue}</div>
              <div style={{ textAlign: "right", fontFamily: MONO, fontSize: 12, color: TONE_COLOR[c.roasTone] }}>
                {c.roas}
              </div>
              <div style={{ textAlign: "right", fontFamily: MONO, fontSize: 12, color: TONE_COLOR[c.cacTone] }}>
                {c.cac}
              </div>
              <div style={{ textAlign: "right", fontFamily: MONO, fontSize: 12, color: "#c8d2e4" }}>{c.orders}</div>
            </div>
          );
        })}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2.4fr 1fr 1fr 1fr .8fr .8fr 1fr",
            gap: 12,
            padding: "13px 22px",
            background: "rgba(77,159,255,.04)",
            alignItems: "center",
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 600, color: "#9ec8ff", letterSpacing: ".08em", fontFamily: MONO }}>
            TOTAL
          </div>
          <div />
          <div style={{ textAlign: "right", fontFamily: MONO, fontSize: 12, fontWeight: 500, color: "#eef2fa" }}>
            {totals.spend}
          </div>
          <div style={{ textAlign: "right", fontFamily: MONO, fontSize: 12, fontWeight: 500, color: "#eef2fa" }}>
            {totals.revenue}
          </div>
          <div style={{ textAlign: "right", fontFamily: MONO, fontSize: 12, fontWeight: 500, color: "#3ddc97" }}>
            {totals.roas}
          </div>
          <div style={{ textAlign: "right", fontFamily: MONO, fontSize: 12, fontWeight: 500, color: "#eef2fa" }}>
            {totals.cac}
          </div>
          <div style={{ textAlign: "right", fontFamily: MONO, fontSize: 12, fontWeight: 500, color: "#eef2fa" }}>
            {totals.orders}
          </div>
        </div>
      </div>

      {/* Encart lecture Sarah */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "13px 18px",
          background: "linear-gradient(135deg,rgba(77,159,255,.08),rgba(47,107,255,.02))",
          border: "1px solid rgba(77,159,255,.2)",
          borderRadius: 12,
          fontSize: 12.5,
          color: "#c8d2e4",
          lineHeight: 1.6,
        }}
      >
        <span style={{ color: "#4d9fff", fontSize: 15, flex: "none" }}>◆</span>
        <span>
          <strong style={{ color: "#fff" }}>Lecture de Sarah, votre Account Manager :</strong> {data.amReading}
        </span>
        <span style={{ marginLeft: "auto", flex: "none", fontSize: 11.5, color: "#9ec8ff", cursor: "pointer", whiteSpace: "nowrap" }}>
          Poser une question →
        </span>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginTop: 22,
          fontSize: 10.5,
          color: "#5f6b82",
          fontFamily: MONO,
        }}
      >
        SOURCES : META ADS · GOOGLE ADS · SHOPIFY · MARGES VALIDÉES AVEC VOS COÛTS PRODUIT — CHAQUE CHIFFRE EST
        AUDITABLE
      </div>
    </main>
  );
}

// -----------------------------------------------------------
// Pages 3 & 4 — Rapports / Documents (même pattern)
// -----------------------------------------------------------
function ListPage({
  title,
  accent,
  microlabel,
  items,
  action,
}: {
  title: string;
  accent: string;
  microlabel: string;
  items: { kind: string; title: string; meta: string }[];
  action: string;
}) {
  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "36px 48px 70px" }}>
      <div style={{ fontSize: 10, color: "#8b97ad", fontFamily: MONO, letterSpacing: ".18em" }}>{microlabel}</div>
      <h1 style={{ margin: "6px 0 26px", fontSize: 28, fontWeight: 400, letterSpacing: "-.025em", color: "#eef2fa" }}>
        {title} <span style={{ fontFamily: SERIF, fontStyle: "italic", color: "#9ec8ff" }}>{accent}</span>
      </h1>
      <div
        style={{
          background: "rgba(255,255,255,.02)",
          border: "1px solid rgba(148,170,215,.12)",
          borderRadius: 14,
          overflow: "hidden",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,.03)",
        }}
      >
        {items.map((r) => {
          const badgeBase: CSSProperties = {
            fontFamily: MONO,
            fontSize: 8.5,
            borderRadius: 4,
            padding: "3px 7px",
            flex: "none",
          };
          const badge =
            r.kind === "XLSX"
              ? { ...badgeBase, color: "#3ddc97", border: "1px solid rgba(61,220,151,.35)" }
              : { ...badgeBase, color: "#f5b74e", border: "1px solid rgba(245,183,78,.35)" };
          return (
            <div
              key={r.title}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                padding: "16px 24px",
                borderBottom: "1px solid rgba(148,170,215,.07)",
              }}
            >
              <span style={badge}>{r.kind}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: "#eef2fa" }}>{r.title}</div>
                <div style={{ fontSize: 10.5, color: "#8b97ad", marginTop: 2 }}>{r.meta}</div>
              </div>
              <span style={{ marginLeft: "auto", fontSize: 11.5, color: "#9ec8ff", cursor: "pointer", whiteSpace: "nowrap" }}>
                {action}
              </span>
            </div>
          );
        })}
      </div>
    </main>
  );
}
