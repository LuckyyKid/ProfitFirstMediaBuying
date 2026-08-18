// Section "Rapports" du portail client : liste des rapports hebdo
// publiés pour le client connecté + vue détaillée d'un rapport
// (rendu identique à ce que l'admin voit en preview / mode "live").
//
// DA strictement alignée sur MetaAdsDashboard : inline styles,
// palette #060910 / #eef2fa / #9ec8ff, cards translucides, mono labels.

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ClientReportView } from "@/components/admin/reports/ClientReportView";
import type { PayloadSysteme, ReportNarrative } from "@/lib/reportNarrative";
import { downloadReportPdf } from "@/lib/reportActions";

const MONO = "'JetBrains Mono', ui-monospace, monospace";
const SERIF = "'Instrument Serif', ui-serif, Georgia, serif";

interface ReportMeta {
  id: string;
  client_code: string;
  periode_debut: string;
  periode_fin: string;
  version: number;
  status: "draft" | "published" | "archived";
  generated_at: string | null;
  published_at: string | null;
}

interface ReportFull extends ReportMeta {
  payload_systeme: PayloadSysteme;
  rapport: ReportNarrative;
}

interface Props {
  clientCode: string;
  clientLabel?: string;
}

function isFunctionMissing(err: unknown): boolean {
  const msg = ((err as Error)?.message ?? "").toLowerCase();
  return (
    msg.includes("not found") ||
    msg.includes("404") ||
    msg.includes("failed to send a request")
  );
}

// supabase.functions.invoke enveloppe les erreurs HTTP dans un FunctionsHttpError
// qui expose la Response brute sous .context. On extrait le status + body pour
// aider au diagnostic (accès en console + éventuellement dans un toast).
async function extractFunctionError(err: unknown): Promise<{
  status: number | null;
  bodyText: string | null;
  originalMessage: string;
}> {
  const originalMessage = (err as Error)?.message ?? String(err);
  const context = (err as { context?: unknown }).context;
  if (context instanceof Response) {
    let bodyText: string | null = null;
    try {
      bodyText = await context.clone().text();
    } catch {
      bodyText = null;
    }
    return { status: context.status, bodyText, originalMessage };
  }
  return { status: null, bodyText: null, originalMessage };
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-CA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function PortalReports({ clientCode, clientLabel }: Props) {
  const [reports, setReports] = useState<ReportMeta[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [backendMissing, setBackendMissing] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ReportFull | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const [resolvedLabel, setResolvedLabel] = useState<string | null>(
    clientLabel ?? null,
  );

  useEffect(() => {
    if (clientLabel) {
      setResolvedLabel(clientLabel);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from("client_progress")
          .select("company_name, brand_name, client_name")
          .eq("client_code", clientCode)
          .maybeSingle();
        if (cancelled || !data) return;
        const label =
          (data.company_name as string | null) ||
          (data.brand_name as string | null) ||
          (data.client_name as string | null) ||
          null;
        setResolvedLabel(label);
      } catch {
        // Fallback silencieux — on affichera "Votre rapport" côté rendu.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientCode, clientLabel]);

  const displayLabel = resolvedLabel ?? "Votre rapport";

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        "report-list",
        { body: { client_code: clientCode, limit: 100 } },
      );
      if (fnError) throw fnError;
      const all = (data?.reports ?? []) as ReportMeta[];
      const published = all
        .filter((r) => r.status === "published")
        .sort((a, b) => (b.periode_debut < a.periode_debut ? -1 : 1));
      setReports(published);
      setBackendMissing(false);
    } catch (e) {
      if (isFunctionMissing(e)) {
        setBackendMissing(true);
        setReports([]);
      } else {
        const detail = await extractFunctionError(e);
        // eslint-disable-next-line no-console
        console.error("[PortalReports] report-list failed", {
          status: detail.status,
          body: detail.bodyText,
          message: detail.originalMessage,
        });
        setError(
          detail.status === 401 || detail.status === 403
            ? "Votre session n'a pas les droits d'accès aux rapports. Reconnectez-vous ou contactez votre account manager si le problème persiste."
            : detail.status
            ? `Impossible de charger vos rapports (code ${detail.status}). Réessayez dans quelques minutes ou contactez votre account manager.`
            : "Impossible de charger vos rapports pour le moment. Réessayez dans quelques minutes.",
        );
        setReports([]);
      }
    } finally {
      setLoading(false);
    }
  }, [clientCode]);

  useEffect(() => {
    void load();
  }, [load]);

  const openReport = useCallback(async (id: string) => {
    setSelectedId(id);
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        "report-get",
        { body: { id } },
      );
      if (fnError) throw fnError;
      const full = data?.report as ReportFull | undefined;
      if (!full) throw new Error("Rapport introuvable.");
      setDetail(full);
    } catch (e) {
      const detail = await extractFunctionError(e);
      // eslint-disable-next-line no-console
      console.error("[PortalReports] report-get failed", {
        status: detail.status,
        body: detail.bodyText,
        message: detail.originalMessage,
      });
      setDetailError(
        detail.status === 401 || detail.status === 403
          ? "Vous n'avez pas accès à ce rapport."
          : detail.status
          ? `Impossible d'ouvrir ce rapport (code ${detail.status}).`
          : "Impossible d'ouvrir ce rapport. Réessayez dans quelques minutes.",
      );
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const closeDetail = () => {
    setSelectedId(null);
    setDetail(null);
    setDetailError(null);
    setDownloadError(null);
  };

  const handleDownload = async () => {
    if (!detail) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      await downloadReportPdf({
        reportId: detail.id,
        clientLabel: displayLabel,
        periodeDebut: detail.periode_debut,
        periodeFin: detail.periode_fin,
      });
    } catch (e) {
      setDownloadError((e as Error).message);
    } finally {
      setDownloading(false);
    }
  };

  const stats = useMemo(() => {
    if (!reports) return null;
    const latest = reports[0];
    return {
      total: reports.length,
      latestLabel: latest ? fmtDate(latest.published_at) : "—",
    };
  }, [reports]);

  // Detail view — full-width rapport en mode "live"
  if (selectedId) {
    return (
      <main style={{ maxWidth: 960, margin: "0 auto", padding: "36px 48px 70px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 24,
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={closeDetail}
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
            ← Retour aux rapports
          </button>

          {detail && (
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              style={{
                padding: "8px 16px",
                borderRadius: 9,
                background: downloading
                  ? "rgba(255,255,255,.02)"
                  : "linear-gradient(135deg,rgba(77,159,255,.16),rgba(47,107,255,.06))",
                border: "1px solid rgba(77,159,255,.32)",
                color: downloading ? "#8b97ad" : "#9ec8ff",
                fontSize: 12.5,
                fontWeight: 500,
                cursor: downloading ? "not-allowed" : "pointer",
                fontFamily: "inherit",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              {downloading ? "Préparation du PDF…" : "↓  Télécharger le PDF"}
            </button>
          )}
        </div>

        {downloadError && (
          <div
            style={{
              marginBottom: 16,
              padding: "12px 16px",
              borderRadius: 10,
              background: "rgba(255,107,107,.06)",
              border: "1px solid rgba(255,107,107,.3)",
              color: "#ff9c9c",
              fontSize: 12.5,
            }}
          >
            {downloadError}
          </div>
        )}

        {detailLoading && (
          <div style={{ fontFamily: MONO, fontSize: 11, color: "#8b97ad", padding: "40px 0" }}>
            Chargement du rapport…
          </div>
        )}

        {detailError && !detailLoading && (
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
            {detailError}
          </div>
        )}

        {detail && !detailLoading && (
          <ClientReportView
            narrative={detail.rapport}
            clientLabel={displayLabel}
            periode={{
              debut: detail.periode_debut,
              fin: detail.periode_fin,
              nb_jours:
                detail.payload_systeme?.periode?.nb_jours ??
                Math.max(
                  1,
                  Math.round(
                    (new Date(detail.periode_fin).getTime() -
                      new Date(detail.periode_debut).getTime()) /
                      86_400_000,
                  ) + 1,
                ),
            }}
            fraicheur={detail.payload_systeme?.fraicheur}
            payloadSysteme={detail.payload_systeme}
            mode="live"
          />
        )}
      </main>
    );
  }

  // List view
  return (
    <main style={{ maxWidth: 1280, margin: "0 auto", padding: "36px 48px 70px" }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 20, marginBottom: 26 }}>
        <div>
          <div style={{ fontSize: 10, color: "#8b97ad", fontFamily: MONO, letterSpacing: ".18em" }}>
            RAPPORTS HEBDOMADAIRES
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
            Vos rapports{" "}
            <span style={{ fontFamily: SERIF, fontStyle: "italic", color: "#9ec8ff" }}>
              de performance
            </span>
          </h1>
          <p style={{ margin: "8px 0 0", fontSize: 13, color: "#8b97ad", maxWidth: 640 }}>
            Chaque semaine, votre account manager rédige une lecture de vos performances
            publicitaires — ce qui s'est passé, notre interprétation, et le plan pour la
            semaine à venir.
          </p>
        </div>

        {stats && stats.total > 0 && (
          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              gap: 10,
            }}
          >
            <StatTile label="Rapports publiés" value={String(stats.total)} />
            <StatTile label="Dernier envoi" value={stats.latestLabel} mono />
          </div>
        )}
      </div>

      {loading && (
        <div style={{ fontFamily: MONO, fontSize: 11, color: "#8b97ad", padding: "40px 0" }}>
          Chargement de vos rapports…
        </div>
      )}

      {backendMissing && !loading && (
        <EmptyCard
          title="Les rapports arrivent bientôt"
          body="Votre account manager n'a pas encore publié de rapport pour votre compte. Vous recevrez un courriel dès que le premier sera disponible."
        />
      )}

      {error && !backendMissing && !loading && (
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
          {error}
        </div>
      )}

      {reports && reports.length === 0 && !loading && !backendMissing && (
        <EmptyCard
          title="Aucun rapport pour le moment"
          body="Votre premier rapport hebdomadaire sera publié ici dès que votre account manager l'aura finalisé."
        />
      )}

      {reports && reports.length > 0 && !loading && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            background: "rgba(255,255,255,.02)",
            border: "1px solid rgba(148,170,215,.12)",
            borderRadius: 14,
            padding: 10,
          }}
        >
          {reports.map((r) => (
            <ReportRow key={r.id} r={r} onOpen={openReport} />
          ))}
        </div>
      )}
    </main>
  );
}

function StatTile({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div
      style={{
        padding: "12px 16px",
        borderRadius: 12,
        background: "rgba(255,255,255,.02)",
        border: "1px solid rgba(148,170,215,.12)",
        minWidth: 140,
      }}
    >
      <div
        style={{
          fontFamily: MONO,
          fontSize: 9,
          letterSpacing: ".18em",
          color: "#8b97ad",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: 4,
          fontSize: mono ? 14 : 20,
          fontFamily: mono ? MONO : undefined,
          fontWeight: mono ? 400 : 500,
          color: "#eef2fa",
          letterSpacing: mono ? undefined : "-.01em",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function ReportRow({ r, onOpen }: { r: ReportMeta; onOpen: (id: string) => void }) {
  const [hover, setHover] = useState(false);
  const rowStyle: CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1fr auto auto",
    alignItems: "center",
    gap: 16,
    padding: "14px 16px",
    borderRadius: 10,
    background: hover ? "rgba(77,159,255,.05)" : "rgba(255,255,255,.015)",
    border: `1px solid ${hover ? "rgba(77,159,255,.25)" : "rgba(148,170,215,.10)"}`,
    cursor: "pointer",
    transition: "background 120ms, border-color 120ms",
    textAlign: "left",
    color: "#eef2fa",
    fontFamily: "inherit",
  };
  return (
    <button
      type="button"
      onClick={() => onOpen(r.id)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={rowStyle}
    >
      <div>
        <div style={{ fontSize: 14.5, color: "#eef2fa", letterSpacing: "-.005em" }}>
          Semaine du {fmtDate(r.periode_debut)} au {fmtDate(r.periode_fin)}
        </div>
        <div
          style={{
            marginTop: 3,
            fontFamily: MONO,
            fontSize: 10.5,
            color: "#8b97ad",
            letterSpacing: ".12em",
          }}
        >
          PUBLIÉ LE {fmtDate(r.published_at).toUpperCase()} · VERSION {r.version}
        </div>
      </div>
      <span
        style={{
          padding: "3px 9px",
          borderRadius: 99,
          background: "rgba(61,220,151,.10)",
          border: "1px solid rgba(61,220,151,.32)",
          color: "#3ddc97",
          fontFamily: MONO,
          fontSize: 9.5,
          letterSpacing: ".18em",
          textTransform: "uppercase",
        }}
      >
        Publié
      </span>
      <span
        style={{
          color: hover ? "#9ec8ff" : "#8b97ad",
          fontSize: 12,
          fontFamily: MONO,
          letterSpacing: ".12em",
        }}
      >
        LIRE →
      </span>
    </button>
  );
}

function EmptyCard({ title, body }: { title: string; body: string }) {
  return (
    <div
      style={{
        padding: "48px 32px",
        textAlign: "center",
        borderRadius: 14,
        background: "rgba(255,255,255,.02)",
        border: "1px solid rgba(148,170,215,.12)",
      }}
    >
      <div
        style={{
          fontSize: 20,
          fontWeight: 400,
          letterSpacing: "-.02em",
          color: "#eef2fa",
        }}
      >
        {title}
      </div>
      <p
        style={{
          marginTop: 10,
          fontSize: 13.5,
          lineHeight: 1.65,
          color: "#8b97ad",
          maxWidth: 520,
          marginLeft: "auto",
          marginRight: "auto",
        }}
      >
        {body}
      </p>
    </div>
  );
}
