import { useEffect, useMemo, useState, CSSProperties } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import {
  fetchMetaDashboardData,
  getMetaDashboardConfig,
  type MetaDashboardConfig,
  type MetaDashboardDataResponse,
  type MetaDashboardKpis,
} from "@/lib/metaDashboardApi";

const MONO = "'JetBrains Mono', ui-monospace, monospace";
const SERIF = "'Instrument Serif', ui-serif, Georgia, serif";

type Tone = "good" | "watch" | "bad" | "neutral";
const TONE_COLOR: Record<Tone, string> = {
  good: "#3ddc97",
  watch: "#f5b74e",
  bad: "#ff6b6b",
  neutral: "#8b97ad",
};

type Period = "7j" | "30j" | "90j";

interface Props {
  clientCode: string;
  initialPeriod?: Period;
  hideAds?: boolean;
  hidePeriodToggle?: boolean;
}

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------
function periodToDates(p: Period): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  const days = p === "7j" ? 7 : p === "30j" ? 30 : 90;
  from.setDate(to.getDate() - (days - 1));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(to) };
}

function fmtMoney(n: number | undefined | null, currency = "USD"): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(2)} M ${currency === "USD" ? "$" : currency}`;
  if (abs >= 10_000) return `${Math.round(n).toLocaleString("fr-CA")} ${currency === "USD" ? "$" : currency}`;
  return `${n.toLocaleString("fr-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${
    currency === "USD" ? "$" : currency
  }`;
}

function fmtInt(n: number | undefined | null): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return Math.round(n).toLocaleString("fr-CA");
}

function fmtRoas(n: number | undefined | null): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `${n.toFixed(2)}×`;
}

function fmtPct(n: number | undefined | null): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `${n.toFixed(2)}%`;
}

function roasTone(roas: number | undefined | null): Tone {
  if (roas === null || roas === undefined || Number.isNaN(roas)) return "neutral";
  if (roas >= 3) return "good";
  if (roas >= 2) return "watch";
  return "bad";
}

function ctrTone(ctr: number | undefined | null): Tone {
  if (ctr === null || ctr === undefined || Number.isNaN(ctr)) return "neutral";
  if (ctr >= 1.5) return "good";
  if (ctr >= 1) return "watch";
  return "bad";
}

// Attempt to build a daily series from rows. Uses defensive header matching
// because Porter Metrics column names vary slightly between templates.
type DailyPoint = { date: string; spend: number; revenue: number };

function findKey(headers: string[], patterns: RegExp[]): string | null {
  for (const h of headers) {
    for (const p of patterns) if (p.test(h)) return h;
  }
  return null;
}

function toNumber(v: string | number | undefined): number {
  if (typeof v === "number") return v;
  if (!v) return 0;
  const cleaned = String(v).replace(/[^\d.,-]/g, "").replace(/,/g, ".");
  const n = parseFloat(cleaned);
  return Number.isNaN(n) ? 0 : n;
}

// Aggregated rows by Campaign name / Ad name. Used to render the campaigns
// table and the ads grid. Porter Metrics templates vary — regex matching
// keeps us resilient to minor naming differences.
type AggRow = {
  name: string;
  spend: number;
  revenue: number;
  purchases: number;
  impressions: number;
  clicks: number;
  ctr: number | null;
  cpc: number | null;
  roas: number | null;
  cpa: number | null;
};
type AdAggRow = AggRow & { thumbnail: string | null; campaign: string | null };

const RE_CAMPAIGN = [/^campaign\s*name$/i, /^campaign$/i, /nom.*campagne/i];
const RE_ADSET = [/^ad\s*set\s*name$/i, /^adset\s*name$/i, /^ad\s*set$/i];
const RE_AD = [/^ad\s*name$/i, /^ad$/i, /nom.*(publicit|annonce)/i];
const RE_THUMB = [
  /thumbnail\s*url/i,
  /ad\s*preview\s*url/i,
  /ad\s*creative\s*thumb/i,
  /creative\s*url/i,
  /image\s*url/i,
  /preview\s*link/i,
];
const RE_SPEND = [/amount\s*spent/i, /^spend$/i, /^cost$/i, /dépens/i];
const RE_REVENUE = [/purchases?\s*(conversion)?\s*value/i, /purchase\s*value/i, /revenue/i, /revenu/i];
const RE_PURCHASES = [/^purchases$/i, /^achats$/i, /website\s*purchases/i];
const RE_IMPRESSIONS = [/^impressions$/i];
const RE_CLICKS = [/^clicks$/i, /^link\s*clicks$/i, /^clics$/i];

// Porter Metrics parfois sort l'URL sans schéma (`media.portermetrics.com/...`),
// parfois en http, parfois protocol-relative (`//host/...`). On accepte les
// trois formes et on force https pour éviter le mixed-content blocking.
function normalizeThumbnailUrl(raw: string | number | undefined | null): string | null {
  if (raw === null || raw === undefined) return null;
  const v = String(raw).trim();
  if (!v) return null;
  if (/^https:\/\//i.test(v)) return v;
  if (/^http:\/\//i.test(v)) return v.replace(/^http:\/\//i, "https://");
  if (v.startsWith("//")) return `https:${v}`;
  // Bare host/path like "media.portermetrics.com/facebook-ads/..."
  if (/^[a-z0-9.-]+\.[a-z]{2,}\//i.test(v)) return `https://${v}`;
  return null;
}

function computeDerived<T extends AggRow>(row: T): T {
  return {
    ...row,
    ctr: row.impressions > 0 ? (row.clicks / row.impressions) * 100 : null,
    cpc: row.clicks > 0 ? row.spend / row.clicks : null,
    roas: row.spend > 0 ? row.revenue / row.spend : null,
    cpa: row.purchases > 0 ? row.spend / row.purchases : null,
  };
}

function buildCampaigns(data: MetaDashboardDataResponse | null): AggRow[] {
  if (!data?.rows?.length) return [];
  const h = data.headers;
  const campKey = findKey(h, RE_CAMPAIGN);
  const spendKey = findKey(h, RE_SPEND);
  const revKey = findKey(h, RE_REVENUE);
  const purKey = findKey(h, RE_PURCHASES);
  const impKey = findKey(h, RE_IMPRESSIONS);
  const clkKey = findKey(h, RE_CLICKS);
  if (!campKey || !spendKey) return [];
  const map = new Map<string, AggRow>();
  for (const row of data.rows) {
    const name = String(row[campKey] ?? "").trim();
    if (!name) continue;
    const c = map.get(name) ?? {
      name,
      spend: 0,
      revenue: 0,
      purchases: 0,
      impressions: 0,
      clicks: 0,
      ctr: null,
      cpc: null,
      roas: null,
      cpa: null,
    };
    c.spend += toNumber(row[spendKey]);
    if (revKey) c.revenue += toNumber(row[revKey]);
    if (purKey) c.purchases += toNumber(row[purKey]);
    if (impKey) c.impressions += toNumber(row[impKey]);
    if (clkKey) c.clicks += toNumber(row[clkKey]);
    map.set(name, c);
  }
  return Array.from(map.values())
    .map(computeDerived)
    .sort((a, b) => b.spend - a.spend);
}

function buildAds(data: MetaDashboardDataResponse | null): AdAggRow[] {
  if (!data?.rows?.length) return [];
  const h = data.headers;
  const adKey = findKey(h, RE_AD);
  const campKey = findKey(h, RE_CAMPAIGN);
  const thumbKey = findKey(h, RE_THUMB);
  const spendKey = findKey(h, RE_SPEND);
  const revKey = findKey(h, RE_REVENUE);
  const purKey = findKey(h, RE_PURCHASES);
  const impKey = findKey(h, RE_IMPRESSIONS);
  const clkKey = findKey(h, RE_CLICKS);
  if (!adKey || !spendKey) return [];
  const map = new Map<string, AdAggRow>();
  for (const row of data.rows) {
    const name = String(row[adKey] ?? "").trim();
    if (!name) continue;
    const a = map.get(name) ?? {
      name,
      spend: 0,
      revenue: 0,
      purchases: 0,
      impressions: 0,
      clicks: 0,
      ctr: null,
      cpc: null,
      roas: null,
      cpa: null,
      thumbnail: null,
      campaign: null,
    };
    a.spend += toNumber(row[spendKey]);
    if (revKey) a.revenue += toNumber(row[revKey]);
    if (purKey) a.purchases += toNumber(row[purKey]);
    if (impKey) a.impressions += toNumber(row[impKey]);
    if (clkKey) a.clicks += toNumber(row[clkKey]);
    if (thumbKey && !a.thumbnail) {
      a.thumbnail = normalizeThumbnailUrl(row[thumbKey]);
    }
    if (campKey && !a.campaign) {
      const v = String(row[campKey] ?? "").trim();
      if (v) a.campaign = v;
    }
    map.set(name, a);
  }
  return Array.from(map.values())
    .map(computeDerived)
    .sort((a, b) => b.spend - a.spend);
}

function buildSeries(data: MetaDashboardDataResponse | null): DailyPoint[] {
  if (!data) return [];
  // Prefer the backend-normalized daily aggregate (fields already summed).
  if (data.daily?.length) {
    return data.daily
      .map((d) => ({
        date: String(d.date).slice(0, 10),
        spend: toNumber(d.spend),
        revenue: toNumber(d.purchase_value),
      }))
      .sort((a, b) => (a.date < b.date ? -1 : 1));
  }
  // Fallback: try to reconstruct from raw rows if daily wasn't provided.
  if (!data.rows?.length) return [];
  const headers = data.headers;
  const dateKey = findKey(headers, [/^date$/i, /^day$/i, /^jour$/i]);
  const spendKey = findKey(headers, [/amount\s*spent/i, /^spend$/i, /^cost$/i, /dépens/i]);
  const revKey = findKey(headers, [
    /purchases?\s*(conversion)?\s*value/i,
    /revenue/i,
    /purchase\s*value/i,
  ]);
  if (!dateKey || !spendKey) return [];
  const map = new Map<string, DailyPoint>();
  for (const row of data.rows) {
    const d = String(row[dateKey] ?? "").slice(0, 10);
    if (!d) continue;
    const p = map.get(d) ?? { date: d, spend: 0, revenue: 0 };
    p.spend += toNumber(row[spendKey]);
    if (revKey) p.revenue += toNumber(row[revKey]);
    map.set(d, p);
  }
  return Array.from(map.values()).sort((a, b) => (a.date < b.date ? -1 : 1));
}

// ------------------------------------------------------------------
// Component
// ------------------------------------------------------------------
export function MetaAdsDashboard({
  clientCode,
  initialPeriod = "30j",
  hideAds = false,
  hidePeriodToggle = false,
}: Props) {
  const [period, setPeriod] = useState<Period>(initialPeriod);
  const [config, setConfig] = useState<MetaDashboardConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);

  const [data, setData] = useState<MetaDashboardDataResponse | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setConfigLoading(true);
    getMetaDashboardConfig(clientCode)
      .then((r) => {
        if (cancelled) return;
        setConfig(r.config);
        setConfigError(null);
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setConfigError(e.message || "Impossible de charger la configuration");
      })
      .finally(() => !cancelled && setConfigLoading(false));
    return () => {
      cancelled = true;
    };
  }, [clientCode]);

  useEffect(() => {
    if (!config?.active) return;
    let cancelled = false;
    const { from, to } = periodToDates(period);
    setDataLoading(true);
    setDataError(null);
    fetchMetaDashboardData({ client_code: clientCode, date_from: from, date_to: to })
      .then((r) => {
        if (!cancelled) setData(r);
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setData(null);
          setDataError(e.message || "Impossible de charger les données Meta Ads");
        }
      })
      .finally(() => !cancelled && setDataLoading(false));
    return () => {
      cancelled = true;
    };
  }, [clientCode, period, config?.active]);

  const series = useMemo(() => buildSeries(data), [data]);
  const campaigns = useMemo(() => buildCampaigns(data), [data]);
  const ads = useMemo(() => buildAds(data), [data]);

  useEffect(() => {
    if (!data) return;
    const thumbKey = findKey(data.headers, RE_THUMB);
    const samples = data.rows.slice(0, 5).map((r) => (thumbKey ? r[thumbKey] : undefined));
    const withThumb = ads.filter((a) => a.thumbnail).length;
    // eslint-disable-next-line no-console
    console.log("[MetaAds] thumbnail diagnostic", {
      headers: data.headers,
      thumbKeyDetected: thumbKey,
      firstRowSamples: samples,
      adsTotal: ads.length,
      adsWithThumbnail: withThumb,
      firstThumbnailUrl: ads.find((a) => a.thumbnail)?.thumbnail ?? null,
    });
  }, [data, ads]);

  // Empty state — no config OR config not active
  if (configLoading) {
    return (
      <main style={{ maxWidth: 1280, margin: "0 auto", padding: "80px 48px", textAlign: "center" }}>
        <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: ".2em", color: "#8b97ad" }}>
          CHARGEMENT DE VOTRE DASHBOARD META ADS…
        </div>
      </main>
    );
  }

  if (!config || !config.active) {
    return (
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "80px 48px", textAlign: "center" }}>
        <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".24em", color: "#8b97ad" }}>META ADS</div>
        <h1
          style={{
            margin: "12px 0 14px",
            fontSize: 26,
            fontWeight: 400,
            letterSpacing: "-.02em",
            color: "#eef2fa",
          }}
        >
          Dashboard Meta Ads pas encore branché
        </h1>
        <p style={{ fontSize: 13.5, lineHeight: 1.7, color: "#8b97ad", maxWidth: 520, margin: "0 auto" }}>
          Votre account manager est en train de connecter votre compte Meta Business à votre portail.
          Dès que la source est synchronisée, vos KPIs apparaîtront ici — mis à jour chaque matin.
        </p>
        {configError && (
          <div style={{ marginTop: 20, fontSize: 11, color: "#ff9c9c", fontFamily: MONO }}>
            Détail technique : {configError}
          </div>
        )}
      </main>
    );
  }

  const kpis = data?.kpis;
  const lastRefresh = data?.last_refreshed_at
    ? new Date(data.last_refreshed_at).toLocaleString("fr-CA", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <main style={{ maxWidth: 1280, margin: "0 auto", padding: "36px 48px 70px" }}>
      {/* En-tête + toggle période */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 20, marginBottom: 26 }}>
        <div>
          <div style={{ fontSize: 10, color: "#8b97ad", fontFamily: MONO, letterSpacing: ".18em" }}>
            META ADS · {periodLabel(period)}
          </div>
          <h1
            style={{
              margin: "6px 0 0",
              fontSize: 28,
              fontWeight: 400,
              letterSpacing: "-.025em",
              color: "#eef2fa",
            }}
          >
            Vos campagnes{" "}
            <span style={{ fontFamily: SERIF, fontStyle: "italic", color: "#9ec8ff" }}>Meta</span>
          </h1>
        </div>
        {!hidePeriodToggle && <div
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
          {(["7j", "30j", "90j"] as Period[]).map((p) => {
            const active = p === period;
            const label = p === "7j" ? "7 j" : p === "30j" ? "30 j" : "90 j";
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
        </div>}
      </div>

      {dataLoading && (
        <div style={{ fontFamily: MONO, fontSize: 11, color: "#8b97ad", padding: "40px 0" }}>
          Synchronisation en cours…
        </div>
      )}

      {!dataLoading && dataError && (
        <div
          style={{
            padding: "16px 20px",
            borderRadius: 12,
            background: "rgba(255,107,107,.06)",
            border: "1px solid rgba(255,107,107,.3)",
            color: "#ff9c9c",
            fontSize: 13,
          }}
        >
          Nous n'avons pas pu charger vos données Meta Ads. Réessayez dans un instant — si le
          problème persiste, contactez votre account manager.
          <div style={{ marginTop: 8, fontSize: 10.5, fontFamily: MONO, opacity: 0.7 }}>
            Détail technique : {dataError}
          </div>
        </div>
      )}

      {!dataLoading && !dataError && kpis && (
        <>
          {/* KPIs hairline row 1 : Spend / Revenue / ROAS / Purchases / CPA */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.3fr 1fr 1fr 1fr 1fr",
              marginBottom: 20,
              borderTop: "1px solid rgba(148,170,215,.12)",
              borderBottom: "1px solid rgba(148,170,215,.12)",
            }}
          >
            <KpiCell
              label="DÉPENSÉ"
              value={fmtMoney(kpis.spend)}
              note="Investissement publicitaire Meta"
              big
              first
            />
            <KpiCell label="REVENU" value={fmtMoney(kpis.purchase_value)} note="Achats trackés Meta" />
            <KpiCell label="ROAS" value={fmtRoas(kpis.roas)} tone={roasTone(kpis.roas)} note="Cible ≥ 3×" />
            <KpiCell label="ACHATS" value={fmtInt(kpis.purchases)} note="Commandes attribuées" />
            <KpiCell
              label="COÛT PAR ACHAT"
              value={fmtMoney(kpis.cpa)}
              note={kpis.aov ? `Panier moyen ${fmtMoney(kpis.aov)}` : "Coût moyen d'acquisition"}
            />
          </div>

          {/* KPIs hairline row 2 : CTR / CPC / CPM / Impressions / Clicks */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.3fr 1fr 1fr 1fr 1fr",
              marginBottom: 40,
              borderBottom: "1px solid rgba(148,170,215,.12)",
            }}
          >
            <KpiCell
              label="CTR"
              value={fmtPct(kpis.ctr)}
              tone={ctrTone(kpis.ctr)}
              note="Taux de clic sur vos publicités"
              first
            />
            <KpiCell label="CPC" value={fmtMoney(kpis.cpc)} note="Coût par clic moyen" />
            <KpiCell label="CPM" value={fmtMoney(kpis.cpm)} note="Coût pour 1000 impressions" />
            <KpiCell label="IMPRESSIONS" value={fmtInt(kpis.impressions)} note="Vues totales" />
            <KpiCell label="CLICS" value={fmtInt(kpis.clicks)} note="Clics sur vos annonces" />
          </div>

          {/* Chart + Funnel */}
          <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 26, marginBottom: 30 }}>
            <div>
              <SectionHeader
                label="ÉVOLUTION QUOTIDIENNE"
                right={
                  <span style={{ fontSize: 10, color: "#5f6b82", fontFamily: MONO }}>
                    DÉPENSE VS REVENU
                  </span>
                }
              />
              <div
                style={{
                  background: "rgba(255,255,255,.02)",
                  border: "1px solid rgba(148,170,215,.12)",
                  borderRadius: 14,
                  padding: 20,
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,.03)",
                  height: 300,
                }}
              >
                {series.length > 1 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={series} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="metaSpend" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#4d9fff" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#4d9fff" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="metaRev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3ddc97" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#3ddc97" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="rgba(148,170,215,.08)" vertical={false} />
                      <XAxis
                        dataKey="date"
                        stroke="#5f6b82"
                        tick={{ fontSize: 10, fontFamily: MONO }}
                        tickFormatter={(d: string) => d.slice(5)}
                      />
                      <YAxis stroke="#5f6b82" tick={{ fontSize: 10, fontFamily: MONO }} />
                      <Tooltip
                        contentStyle={{
                          background: "#0b1322",
                          border: "1px solid rgba(148,170,215,.2)",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                        labelStyle={{ color: "#c8d2e4", fontFamily: MONO, fontSize: 11 }}
                        formatter={(v: number, name: string) => [
                          fmtMoney(v),
                          name === "spend" ? "Dépensé" : "Revenu",
                        ]}
                      />
                      <Area
                        type="monotone"
                        dataKey="spend"
                        stroke="#4d9fff"
                        strokeWidth={2}
                        fill="url(#metaSpend)"
                      />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke="#3ddc97"
                        strokeWidth={2}
                        fill="url(#metaRev)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div
                    style={{
                      height: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                      color: "#5f6b82",
                      fontFamily: MONO,
                    }}
                  >
                    PAS ASSEZ DE DONNÉES POUR AFFICHER UNE COURBE
                  </div>
                )}
              </div>
            </div>

            <div>
              <SectionHeader label="ENTONNOIR DE CONVERSION" />
              <Funnel kpis={kpis} />
            </div>
          </div>

          {/* Campagnes */}
          {campaigns.length > 0 && (
            <div style={{ marginBottom: 30 }}>
              <SectionHeader
                label="CAMPAGNES"
                right={
                  <span style={{ fontSize: 10, color: "#5f6b82", fontFamily: MONO }}>
                    {campaigns.length} CAMPAGNE{campaigns.length > 1 ? "S" : ""}
                  </span>
                }
              />
              <CampaignsTable rows={campaigns} />
            </div>
          )}

          {/* Ads (créatifs) */}
          {!hideAds && ads.length > 0 && (
            <div style={{ marginBottom: 30 }}>
              <SectionHeader
                label="PUBLICITÉS"
                right={
                  <span style={{ fontSize: 10, color: "#5f6b82", fontFamily: MONO }}>
                    {ads.length} PUBLICITÉ{ads.length > 1 ? "S" : ""}
                  </span>
                }
              />
              <AdsGrid rows={ads} />
            </div>
          )}

          {/* Hint quand ni campagne ni ad détecté */}
          {campaigns.length === 0 && ads.length === 0 && (
            <div
              style={{
                marginBottom: 30,
                padding: "14px 20px",
                borderRadius: 12,
                border: "1px dashed rgba(148,170,215,.18)",
                background: "rgba(255,255,255,.015)",
                fontSize: 12,
                color: "#8b97ad",
              }}
            >
              <span style={{ color: "#c8d2e4", fontFamily: MONO, fontSize: 10, letterSpacing: ".18em" }}>
                DÉTAIL PAR CAMPAGNE/AD INDISPONIBLE
              </span>
              <div style={{ marginTop: 6, lineHeight: 1.6 }}>
                Ajoutez les colonnes <code style={{ fontFamily: MONO, color: "#9ec8ff" }}>Campaign name</code>,{" "}
                <code style={{ fontFamily: MONO, color: "#9ec8ff" }}>Ad name</code> et{" "}
                <code style={{ fontFamily: MONO, color: "#9ec8ff" }}>Ad thumbnail URL</code> dans votre template Porter
                Metrics pour afficher ici les campagnes, les publicités et leurs créatifs.
              </div>
            </div>
          )}

          {/* Notes + last refresh */}
          {data?.notes && Object.keys(data.notes).length > 0 && (
            <div
              style={{
                padding: "13px 18px",
                background: "linear-gradient(135deg,rgba(77,159,255,.06),rgba(47,107,255,.02))",
                border: "1px solid rgba(77,159,255,.16)",
                borderRadius: 12,
                marginBottom: 16,
              }}
            >
              {Object.entries(data.notes).map(([k, v]) => (
                <div key={k} style={{ fontSize: 11.5, color: "#c8d2e4", lineHeight: 1.6 }}>
                  <span style={{ color: "#9ec8ff", fontFamily: MONO, fontSize: 10, marginRight: 8 }}>
                    {k.toUpperCase()}
                  </span>
                  {v}
                </div>
              ))}
            </div>
          )}

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 10.5,
              color: "#5f6b82",
              fontFamily: MONO,
            }}
          >
            SOURCE : META BUSINESS MANAGER · SYNCHRO QUOTIDIENNE
            {lastRefresh && <span> · DERNIÈRE MISE À JOUR {lastRefresh.toUpperCase()}</span>}
          </div>
        </>
      )}
    </main>
  );
}

function periodLabel(p: Period): string {
  return p === "7j" ? "7 DERNIERS JOURS" : p === "30j" ? "30 DERNIERS JOURS" : "90 DERNIERS JOURS";
}

function KpiCell({
  label,
  value,
  note,
  tone,
  big,
  first,
}: {
  label: string;
  value: string;
  note?: string;
  tone?: Tone;
  big?: boolean;
  first?: boolean;
}) {
  const color = tone ? TONE_COLOR[tone] : "#eef2fa";
  return (
    <div
      style={{
        padding: first ? "22px 24px 22px 0" : "22px 24px",
        borderLeft: first ? "none" : "1px solid rgba(148,170,215,.12)",
      }}
    >
      <div style={{ fontSize: 9, letterSpacing: ".2em", color: "#8b97ad", fontFamily: MONO }}>{label}</div>
      <div
        style={{
          marginTop: 9,
          fontFamily: MONO,
          fontSize: big ? 30 : 22,
          fontWeight: 300,
          color,
          letterSpacing: "-.02em",
        }}
      >
        {value}
      </div>
      {note && <div style={{ fontSize: 10.5, color: "#5f6b82", marginTop: 5 }}>{note}</div>}
    </div>
  );
}

function SectionHeader({ label, right }: { label: string; right?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 14 }}>
      <span
        style={{
          fontSize: 9.5,
          letterSpacing: ".28em",
          fontWeight: 600,
          color: "#8b97ad",
          fontFamily: MONO,
        }}
      >
        {label}
      </span>
      <div style={{ height: 1, flex: 1, background: "linear-gradient(90deg,rgba(148,170,215,.15),transparent)" }} />
      {right}
    </div>
  );
}

// Adaptive funnel: hides steps whose value is 0 or undefined (e.g. no
// Checkout event tracked). Steps are ratioed against Clicks (top of funnel).
function Funnel({ kpis }: { kpis: MetaDashboardKpis }) {
  const steps = [
    { key: "clicks", label: "Clics", value: kpis.clicks },
    { key: "atc", label: "Ajouts au panier", value: kpis.add_to_cart },
    { key: "checkout", label: "Checkouts initiés", value: kpis.checkouts_initiated },
    { key: "purchases", label: "Achats", value: kpis.purchases },
  ].filter((s) => typeof s.value === "number" && s.value > 0);

  if (steps.length === 0) {
    return (
      <div
        style={{
          background: "rgba(255,255,255,.02)",
          border: "1px solid rgba(148,170,215,.12)",
          borderRadius: 14,
          padding: 24,
          height: 300,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12,
          color: "#5f6b82",
          fontFamily: MONO,
          textAlign: "center",
        }}
      >
        AUCUN ÉVÉNEMENT DE CONVERSION SUR LA PÉRIODE
      </div>
    );
  }

  const top = steps[0].value ?? 1;
  return (
    <div
      style={{
        background: "rgba(255,255,255,.02)",
        border: "1px solid rgba(148,170,215,.12)",
        borderRadius: 14,
        padding: "22px 24px",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,.03)",
        height: 300,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 12,
      }}
    >
      {steps.map((s, i) => {
        const val = s.value ?? 0;
        const pct = (val / top) * 100;
        const conv = i === 0 ? null : ((val / top) * 100).toFixed(1);
        const colors = ["#4d9fff", "#7bb4ff", "#9cc7ff", "#3ddc97"];
        const color = colors[i] ?? "#8b97ad";
        return (
          <div key={s.key}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 5 }}>
              <span style={{ fontSize: 12, color: "#c8d2e4" }}>{s.label}</span>
              <span
                style={{
                  marginLeft: "auto",
                  fontFamily: MONO,
                  fontSize: 12.5,
                  color: "#eef2fa",
                }}
              >
                {fmtInt(val)}
              </span>
              {conv && (
                <span
                  style={{
                    fontFamily: MONO,
                    fontSize: 10,
                    color: "#5f6b82",
                    width: 50,
                    textAlign: "right",
                  }}
                >
                  {conv}%
                </span>
              )}
            </div>
            <div
              style={{
                height: 6,
                background: "rgba(148,170,215,.08)",
                borderRadius: 99,
                overflow: "hidden",
              }}
            >
              <div
                style={
                  {
                    width: `${pct}%`,
                    height: "100%",
                    background: color,
                    borderRadius: 99,
                    boxShadow: `0 0 8px ${color}55`,
                  } as CSSProperties
                }
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------------
// CampaignsTable — hairline table sorted by spend desc
// ------------------------------------------------------------------
function CampaignsTable({ rows }: { rows: AggRow[] }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,.02)",
        border: "1px solid rgba(148,170,215,.12)",
        borderRadius: 14,
        overflow: "hidden",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,.03)",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2.6fr .9fr .9fr .7fr .8fr .8fr",
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
        <div style={{ textAlign: "right" }}>DÉPENSÉ</div>
        <div style={{ textAlign: "right" }}>REVENU</div>
        <div style={{ textAlign: "right" }}>ROAS</div>
        <div style={{ textAlign: "right" }}>ACHATS</div>
        <div style={{ textAlign: "right" }}>CPA</div>
      </div>
      {rows.map((c) => (
        <div
          key={c.name}
          style={{
            display: "grid",
            gridTemplateColumns: "2.6fr .9fr .9fr .7fr .8fr .8fr",
            gap: 12,
            padding: "12px 22px",
            borderBottom: "1px solid rgba(148,170,215,.06)",
            alignItems: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              minWidth: 0,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: 99,
                background: TONE_COLOR[roasTone(c.roas)],
                boxShadow: `0 0 8px ${TONE_COLOR[roasTone(c.roas)]}80`,
                flex: "none",
              }}
            />
            <span
              style={{
                fontSize: 12.5,
                color: "#eef2fa",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
              title={c.name}
            >
              {c.name}
            </span>
          </div>
          <div style={{ textAlign: "right", fontFamily: MONO, fontSize: 12, color: "#c8d2e4" }}>
            {fmtMoney(c.spend)}
          </div>
          <div style={{ textAlign: "right", fontFamily: MONO, fontSize: 12, color: "#eef2fa" }}>
            {fmtMoney(c.revenue)}
          </div>
          <div
            style={{
              textAlign: "right",
              fontFamily: MONO,
              fontSize: 12,
              color: TONE_COLOR[roasTone(c.roas)],
            }}
          >
            {fmtRoas(c.roas)}
          </div>
          <div style={{ textAlign: "right", fontFamily: MONO, fontSize: 12, color: "#c8d2e4" }}>
            {fmtInt(c.purchases)}
          </div>
          <div style={{ textAlign: "right", fontFamily: MONO, fontSize: 12, color: "#c8d2e4" }}>
            {fmtMoney(c.cpa)}
          </div>
        </div>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------
// AdsGrid — creative cards with thumbnails
// ------------------------------------------------------------------
function AdsGrid({ rows }: { rows: AdAggRow[] }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
        gap: 16,
      }}
    >
      {rows.map((a) => {
        const tone = roasTone(a.roas);
        return (
          <div
            key={a.name}
            style={{
              background: "rgba(255,255,255,.02)",
              border: "1px solid rgba(148,170,215,.12)",
              borderRadius: 14,
              overflow: "hidden",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,.03)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                position: "relative",
                width: "100%",
                aspectRatio: "1 / 1",
                background:
                  "linear-gradient(135deg,rgba(77,159,255,.08),rgba(47,107,255,.02))",
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <AdThumbnail url={a.thumbnail} alt={a.name} />

              <span
                style={{
                  position: "absolute",
                  top: 10,
                  right: 10,
                  padding: "3px 8px",
                  borderRadius: 6,
                  background: "rgba(11,19,34,.75)",
                  border: `1px solid ${TONE_COLOR[tone]}55`,
                  color: TONE_COLOR[tone],
                  fontFamily: MONO,
                  fontSize: 10,
                  fontWeight: 600,
                  backdropFilter: "blur(6px)",
                }}
              >
                {fmtRoas(a.roas)}
              </span>
            </div>
            <div style={{ padding: "14px 16px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                {a.campaign && (
                  <div
                    style={{
                      fontSize: 9.5,
                      letterSpacing: ".16em",
                      color: "#8b97ad",
                      fontFamily: MONO,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                    title={a.campaign}
                  >
                    {a.campaign.toUpperCase()}
                  </div>
                )}
                <div
                  style={{
                    marginTop: 4,
                    fontSize: 13,
                    color: "#eef2fa",
                    fontWeight: 500,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                  title={a.name}
                >
                  {a.name}
                </div>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 8,
                  borderTop: "1px solid rgba(148,170,215,.1)",
                  paddingTop: 10,
                }}
              >
                <MiniStat label="DÉPENSÉ" value={fmtMoney(a.spend)} />
                <MiniStat label="REVENU" value={fmtMoney(a.revenue)} />
                <MiniStat
                  label="CTR"
                  value={fmtPct(a.ctr)}
                  color={TONE_COLOR[ctrTone(a.ctr)]}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AdThumbnail({ url, alt }: { url: string | null; alt: string }) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">(
    url ? "loading" : "error",
  );

  if (!url || status === "error") {
    return (
      <span
        style={{
          fontSize: 9.5,
          letterSpacing: ".2em",
          color: "#5f6b82",
          fontFamily: MONO,
          textAlign: "center",
          padding: "0 12px",
        }}
      >
        {!url ? "PAS D'APERÇU" : "IMAGE INDISPONIBLE"}
      </span>
    );
  }

  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      style={{
        width: "100%",
        height: "100%",
        objectFit: "cover",
        display: "block",
        opacity: status === "loaded" ? 1 : 0.6,
        transition: "opacity .2s",
      }}
      onLoad={() => setStatus("loaded")}
      onError={(e) => {
        const img = e.currentTarget as HTMLImageElement;
        // eslint-disable-next-line no-console
        console.warn("[MetaAds] thumbnail failed to load", {
          url,
          alt,
          currentSrc: img.currentSrc,
          naturalWidth: img.naturalWidth,
        });
        setStatus("error");
      }}
    />
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div
        style={{
          fontSize: 8.5,
          letterSpacing: ".18em",
          color: "#5f6b82",
          fontFamily: MONO,
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: 3,
          fontFamily: MONO,
          fontSize: 12,
          color: color ?? "#eef2fa",
        }}
      >
        {value}
      </div>
    </div>
  );
}
