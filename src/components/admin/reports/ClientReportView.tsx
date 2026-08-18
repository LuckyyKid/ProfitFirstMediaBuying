// Rendu visuel d'un rapport client, réutilisable :
//   mode="preview" → utilisé dans le wizard admin (banner + bouton publier)
//   mode="live"    → affiché tel quel dans le portail client
//   mode="print"   → styles compacts pour l'export PDF
//
// La DA suit strictement celle du dashboard Meta Ads client
// (src/components/portal/MetaAdsDashboard.tsx) : inline styles, palette
// #060910 / #eef2fa / #9ec8ff, cards translucides, mono uppercase labels.

import { useState, type CSSProperties } from "react";
import type {
  ReportNarrative,
  WhatKpiLine,
  SoWhatHypothesis,
  Certainty,
  PayloadSysteme,
  CreativeRow,
  CreativeStatusValue,
} from "@/lib/reportNarrative";
import { fmt } from "@/lib/reportNarrative";
import { resolveCreativeImageUrl } from "@/lib/creativeThumbnail";
import { CreativeLightbox } from "@/components/CreativeLightbox";

interface Props {
  narrative: ReportNarrative;
  clientLabel: string;
  periode: { debut: string; fin: string; nb_jours: number };
  fraicheur?: { last_refreshed_at?: string };
  // Fourni côté admin (preview + historique) pour rendre les créatives avec
  // leurs vignettes. Absent côté portail client si le rapport a été persisté
  // sans re-serialiser le payload — dans ce cas les sections créatives/notes
  // se dégradent gracieusement en s'appuyant sur creatives_review uniquement.
  payloadSysteme?: PayloadSysteme | null;
  mode?: "preview" | "live" | "print";
}

const MONO = "'JetBrains Mono', ui-monospace, monospace";
const SERIF = "'Instrument Serif', ui-serif, Georgia, serif";

type Tone = WhatKpiLine["tone"];
const TONE_COLOR: Record<Tone, string> = {
  good: "#3ddc97",
  watch: "#f5b74e",
  bad: "#ff6b6b",
  neutral: "#8b97ad",
};

const CREATIVE_STATUS_META: Record<
  CreativeStatusValue,
  { label: string; color: string; bg: string; border: string }
> = {
  keep: { label: "On garde", color: "#3ddc97", bg: "rgba(61,220,151,.10)", border: "rgba(61,220,151,.32)" },
  cut: { label: "Coupée", color: "#ff6b6b", bg: "rgba(255,107,107,.10)", border: "rgba(255,107,107,.32)" },
  test: { label: "En test", color: "#f5b74e", bg: "rgba(245,183,78,.10)", border: "rgba(245,183,78,.32)" },
};

const PREVIOUS_ACTION_STATUS_META: Record<
  "done" | "in_progress" | "blocked" | "pending",
  { label: string; color: string }
> = {
  done: { label: "Faite", color: "#3ddc97" },
  in_progress: { label: "En cours", color: "#9ec8ff" },
  blocked: { label: "Bloquée", color: "#ff6b6b" },
  pending: { label: "En attente", color: "#8b97ad" },
};

const CERTAINTY_META: Record<
  Certainty,
  { label: string; color: string; bg: string; border: string }
> = {
  confirmed: {
    label: "Confirmé",
    color: "#3ddc97",
    bg: "rgba(61,220,151,.10)",
    border: "rgba(61,220,151,.32)",
  },
  probable: {
    label: "Probable",
    color: "#9ec8ff",
    bg: "rgba(77,159,255,.10)",
    border: "rgba(77,159,255,.32)",
  },
  hypothesis: {
    label: "Hypothèse",
    color: "#f5b74e",
    bg: "rgba(245,183,78,.10)",
    border: "rgba(245,183,78,.32)",
  },
  unexplained: {
    label: "Non expliqué",
    color: "#8b97ad",
    bg: "rgba(148,170,215,.06)",
    border: "rgba(148,170,215,.20)",
  },
};

function formatKpiValue(line: WhatKpiLine): string {
  if (line.current == null) return "—";
  switch (line.format) {
    case "money": return fmt.money(line.current);
    case "int": return fmt.num(line.current);
    case "roas": return fmt.roas(line.current);
    case "pct": return fmt.pct(line.current);
  }
}

const cardStyle: CSSProperties = {
  background: "rgba(255,255,255,.02)",
  border: "1px solid rgba(148,170,215,.12)",
  borderRadius: 14,
  padding: "22px 24px",
};

const sectionLabelStyle: CSSProperties = {
  fontFamily: MONO,
  fontSize: 10,
  letterSpacing: ".22em",
  color: "#8b97ad",
  textTransform: "uppercase",
};

export function ClientReportView({
  narrative,
  clientLabel,
  periode,
  fraicheur,
  payloadSysteme,
  mode = "live",
}: Props) {
  const compact = mode === "print";
  const gap = compact ? 16 : 22;

  // Retrouve rapidement les statuts AM par créative via id ou nom.
  const statusByCreativeKey = new Map<string, CreativeStatusValue>();
  for (const s of narrative.creatives_review?.creative_statuses ?? []) {
    const k = s.creative_id ?? s.creative_name;
    if (k) statusByCreativeKey.set(k, s.status);
  }
  // Groupe les créatives à afficher par ad set, dans l'ordre du payload.
  const creativesByAdSet = new Map<string, { name: string; items: CreativeRow[] }>();
  for (const c of payloadSysteme?.creatives_highlight ?? []) {
    const k = c.ad_set_id ?? c.ad_set_name ?? "_orphan";
    const label = c.ad_set_name ?? "Autres créatives";
    if (!creativesByAdSet.has(k)) creativesByAdSet.set(k, { name: label, items: [] });
    creativesByAdSet.get(k)!.items.push(c);
  }
  const adSetNotes = new Map<string, string>();
  for (const n of narrative.creatives_review?.ad_set_notes ?? []) {
    const k = n.ad_set_id ?? n.ad_set_name;
    if (k && n.note?.trim()) adSetNotes.set(k, n.note.trim());
  }
  const hasCreativesSection = creativesByAdSet.size > 0 || adSetNotes.size > 0;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap,
        color: "#eef2fa",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      {mode === "preview" && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            background: "rgba(245,183,78,.08)",
            border: "1px solid rgba(245,183,78,.32)",
            color: "#f5b74e",
            fontFamily: MONO,
            fontSize: 10.5,
            letterSpacing: ".16em",
            textTransform: "uppercase",
          }}
        >
          Prévisualisation — ce rapport n'est pas encore publié au client
        </div>
      )}

      {/* Header */}
      <div>
        <div
          style={{
            fontFamily: MONO,
            fontSize: 10,
            letterSpacing: ".24em",
            color: "#8b97ad",
            textTransform: "uppercase",
          }}
        >
          Rapport hebdomadaire
        </div>
        <h1
          style={{
            margin: "8px 0 6px",
            fontSize: compact ? 22 : 28,
            fontWeight: 400,
            letterSpacing: "-.025em",
            color: "#eef2fa",
          }}
        >
          {clientLabel}{" "}
          <span style={{ fontFamily: SERIF, fontStyle: "italic", color: "#9ec8ff" }}>
            · semaine
          </span>
        </h1>
        <div style={{ fontSize: 12.5, color: "#8b97ad" }}>
          Du {periode.debut} au {periode.fin} · {periode.nb_jours} jours
          {fraicheur?.last_refreshed_at && (
            <>
              {" · "}
              <span style={{ fontFamily: MONO, fontSize: 11 }}>
                données rafraîchies le{" "}
                {new Date(fraicheur.last_refreshed_at).toLocaleDateString("fr-CA")}
              </span>
            </>
          )}
        </div>
      </div>

      {/* WHAT */}
      <section style={cardStyle}>
        <div style={sectionLabelStyle}>Ce qui s'est passé</div>
        <p
          style={{
            margin: "12px 0 18px",
            fontSize: 14,
            lineHeight: 1.65,
            color: "#d8dfec",
          }}
        >
          {narrative.what.resume}
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: compact
              ? "repeat(3, minmax(0,1fr))"
              : "repeat(auto-fill, minmax(160px, 1fr))",
            gap: 10,
          }}
        >
          {narrative.what.kpis.map((k) => (
            <KpiTile key={k.metric} line={k} />
          ))}
        </div>
      </section>

      {/* SO WHAT */}
      <section style={cardStyle}>
        <div style={sectionLabelStyle}>Notre lecture</div>
        <div style={{ marginTop: 12 }}>
          {narrative.so_what.length === 0 ? (
            <div style={{ fontSize: 12.5, color: "#8b97ad" }}>Rien à signaler.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {narrative.so_what.map((h) => (
                <SoWhatCard key={h.id} h={h} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CREATIVES + NOTES AD SET */}
      {hasCreativesSection && (
        <section style={cardStyle}>
          <div style={sectionLabelStyle}>Créatives de la semaine</div>
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 14 }}>
            {Array.from(creativesByAdSet.entries()).map(([key, group]) => {
              const note = adSetNotes.get(key);
              return (
                <div key={key} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div
                    style={{
                      fontFamily: MONO,
                      fontSize: 10,
                      letterSpacing: ".16em",
                      textTransform: "uppercase",
                      color: "#9ec8ff",
                    }}
                  >
                    {group.name}
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: compact
                        ? "repeat(2, minmax(0,1fr))"
                        : "repeat(auto-fill, minmax(180px, 1fr))",
                      gap: 10,
                    }}
                  >
                    {group.items.map((c, idx) => (
                      <CreativeCard
                        key={c.id ?? `${key}_${idx}`}
                        creative={c}
                        status={statusByCreativeKey.get(c.id ?? c.ad_name ?? "")}
                      />
                    ))}
                  </div>
                  {note && (
                    <div
                      style={{
                        marginTop: 2,
                        padding: "10px 12px",
                        borderRadius: 10,
                        background: "rgba(158,200,255,.06)",
                        border: "1px solid rgba(158,200,255,.20)",
                        fontSize: 12.5,
                        lineHeight: 1.55,
                        color: "#d8dfec",
                      }}
                    >
                      <span
                        style={{
                          fontFamily: MONO,
                          fontSize: 9.5,
                          letterSpacing: ".14em",
                          textTransform: "uppercase",
                          color: "#8b97ad",
                          marginRight: 6,
                        }}
                      >
                        Note
                      </span>
                      {note}
                    </div>
                  )}
                </div>
              );
            })}
            {/* Notes orphelines : ad sets pour lesquels aucune créative n'est
                remontée dans creatives_highlight mais l'AM a écrit une note. */}
            {Array.from(adSetNotes.entries())
              .filter(([k]) => !creativesByAdSet.has(k))
              .map(([k, note]) => (
                <div
                  key={`orphan_${k}`}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    background: "rgba(158,200,255,.06)",
                    border: "1px solid rgba(158,200,255,.20)",
                    fontSize: 12.5,
                    lineHeight: 1.55,
                    color: "#d8dfec",
                  }}
                >
                  <span
                    style={{
                      fontFamily: MONO,
                      fontSize: 9.5,
                      letterSpacing: ".14em",
                      textTransform: "uppercase",
                      color: "#8b97ad",
                      marginRight: 6,
                    }}
                  >
                    Note
                  </span>
                  {note}
                </div>
              ))}
          </div>
        </section>
      )}

      {/* SUIVI ACTIONS PRÉCÉDENTES */}
      {narrative.previous_actions_review && narrative.previous_actions_review.entries.length > 0 && (
        <section style={cardStyle}>
          <div style={sectionLabelStyle}>
            Suivi des actions ({narrative.previous_actions_review.periode_debut} → {narrative.previous_actions_review.periode_fin})
          </div>
          <ul
            style={{
              listStyle: "none",
              margin: "12px 0 0",
              padding: 0,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {narrative.previous_actions_review.entries.map((e) => {
              const meta = PREVIOUS_ACTION_STATUS_META[e.status];
              return (
                <li
                  key={e.action_id}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    padding: "10px 12px",
                    borderRadius: 10,
                    background: "rgba(255,255,255,.015)",
                    border: "1px solid rgba(148,170,215,.10)",
                  }}
                >
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      marginTop: 8,
                      borderRadius: 99,
                      background: meta.color,
                      boxShadow: `0 0 6px ${meta.color}66`,
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, lineHeight: 1.5, color: "#eef2fa" }}>{e.action}</div>
                    {e.blocker && (
                      <div style={{ marginTop: 3, fontSize: 12, color: "#ff6b6b", lineHeight: 1.5 }}>
                        <span
                          style={{
                            fontFamily: MONO,
                            fontSize: 9.5,
                            letterSpacing: ".14em",
                            textTransform: "uppercase",
                            color: "#8b97ad",
                            marginRight: 6,
                          }}
                        >
                          Bloquée par
                        </span>
                        {e.blocker}
                      </div>
                    )}
                  </div>
                  <Chip label={meta.label} tone={meta.color} />
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* NOW WHAT */}
      <section style={cardStyle}>
        <div style={sectionLabelStyle}>Plan d'action</div>
        <div style={{ marginTop: 12 }}>
          {narrative.now_what.length === 0 ? (
            <div style={{ fontSize: 12.5, color: "#8b97ad" }}>
              Aucune action décidée pour la semaine à venir.
            </div>
          ) : (
            <ul
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {narrative.now_what.map((a) => (
                <li
                  key={a.id}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    padding: "12px 14px",
                    borderRadius: 10,
                    background: "rgba(255,255,255,.015)",
                    border: "1px solid rgba(148,170,215,.10)",
                  }}
                >
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      marginTop: 8,
                      borderRadius: 99,
                      background: "#4d9fff",
                      boxShadow: "0 0 6px rgba(77,159,255,.6)",
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, lineHeight: 1.5, color: "#eef2fa", fontWeight: 500 }}>
                      {a.action ?? a.text}
                    </div>
                    {a.pourquoi && (
                      <div
                        style={{
                          marginTop: 4,
                          fontSize: 12.5,
                          lineHeight: 1.5,
                          color: "#9ec8ff",
                        }}
                      >
                        <span
                          style={{
                            fontFamily: MONO,
                            fontSize: 9.5,
                            letterSpacing: ".14em",
                            textTransform: "uppercase",
                            color: "#8b97ad",
                            marginRight: 6,
                          }}
                        >
                          Parce que
                        </span>
                        {a.pourquoi}
                      </div>
                    )}
                    {a.attendu && (
                      <div
                        style={{
                          marginTop: 3,
                          fontSize: 12.5,
                          lineHeight: 1.5,
                          color: "#3ddc97",
                        }}
                      >
                        <span
                          style={{
                            fontFamily: MONO,
                            fontSize: 9.5,
                            letterSpacing: ".14em",
                            textTransform: "uppercase",
                            color: "#8b97ad",
                            marginRight: 6,
                          }}
                        >
                          Attendu
                        </span>
                        {a.attendu}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    {a.responsible && (
                      <Chip
                        label={a.responsible === "agence" ? "Agence" : "Client"}
                        tone={a.responsible === "agence" ? "#9ec8ff" : "#8b97ad"}
                      />
                    )}
                    {a.horizon && (
                      <Chip
                        label={
                          a.horizon === "cette_semaine"
                            ? "Cette semaine"
                            : a.horizon === "prochaine"
                            ? "Semaine prochaine"
                            : "Ce mois"
                        }
                        tone="#8b97ad"
                      />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

function KpiTile({ line }: { line: WhatKpiLine }) {
  const color = TONE_COLOR[line.tone];
  const delta = line.delta_pct;
  const arrow = delta == null ? "—" : delta === 0 ? "=" : delta > 0 ? "▲" : "▼";
  return (
    <div
      style={{
        padding: "12px 14px",
        borderRadius: 10,
        background: "rgba(255,255,255,.015)",
        border: "1px solid rgba(148,170,215,.10)",
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
        {line.label}
      </div>
      <div
        style={{
          marginTop: 6,
          fontSize: 20,
          fontWeight: 500,
          letterSpacing: "-.01em",
          color,
        }}
      >
        {formatKpiValue(line)}
      </div>
      <div
        style={{
          marginTop: 4,
          display: "flex",
          alignItems: "center",
          gap: 4,
          fontFamily: MONO,
          fontSize: 10.5,
          color,
        }}
      >
        <span>{arrow}</span>
        <span>{delta == null ? "—" : fmt.signedPct(delta)}</span>
      </div>
    </div>
  );
}

function SoWhatCard({ h }: { h: SoWhatHypothesis }) {
  const meta = CERTAINTY_META[h.certainty];
  return (
    <div
      style={{
        padding: "12px 14px",
        borderRadius: 10,
        background: "rgba(255,255,255,.015)",
        border: "1px solid rgba(148,170,215,.10)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <span
        style={{
          alignSelf: "flex-start",
          padding: "3px 8px",
          borderRadius: 99,
          background: meta.bg,
          border: `1px solid ${meta.border}`,
          color: meta.color,
          fontFamily: MONO,
          fontSize: 9.5,
          letterSpacing: ".16em",
          textTransform: "uppercase",
        }}
      >
        {meta.label}
      </span>
      <div style={{ fontSize: 13.5, lineHeight: 1.6, color: "#d8dfec" }}>{h.text}</div>
    </div>
  );
}

function CreativeCard({
  creative,
  status,
}: {
  creative: CreativeRow;
  status?: CreativeStatusValue;
}) {
  const meta = status ? CREATIVE_STATUS_META[status] : null;
  const name = creative.ad_name ?? "Créative sans nom";
  const spend = typeof creative.spend === "number" ? fmt.money(creative.spend) : null;
  const revenue = typeof creative.purchase_value === "number" ? fmt.money(creative.purchase_value) : null;
  const purchases = typeof creative.purchases === "number" ? fmt.num(creative.purchases) : null;
  const ctr = typeof creative.ctr === "number" ? `${creative.ctr.toFixed(2)} %` : null;
  return (
    <div
      style={{
        borderRadius: 10,
        overflow: "hidden",
        background: "rgba(255,255,255,.015)",
        border: "1px solid rgba(148,170,215,.10)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          position: "relative",
          aspectRatio: "1 / 1",
          background: "rgba(148,170,215,.06)",
          overflow: "hidden",
        }}
      >
        <CreativeThumbnail creative={creative} />
        {meta && (
          <span
            style={{
              position: "absolute",
              top: 8,
              left: 8,
              padding: "3px 8px",
              borderRadius: 99,
              background: meta.bg,
              border: `1px solid ${meta.border}`,
              color: meta.color,
              fontFamily: MONO,
              fontSize: 9,
              letterSpacing: ".16em",
              textTransform: "uppercase",
            }}
          >
            {meta.label}
          </span>
        )}
      </div>
      <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
        <div
          style={{
            fontSize: 12,
            lineHeight: 1.4,
            color: "#eef2fa",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={name}
        >
          {name}
        </div>
        <div
          style={{
            fontFamily: MONO,
            fontSize: 10,
            letterSpacing: ".08em",
            color: "#8b97ad",
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
          }}
        >
          {spend && <span>{spend} dépensés</span>}
          {revenue && purchases && (
            <span>
              · ≈ {revenue} généré · {purchases} vente{purchases === "1" ? "" : "s"}
            </span>
          )}
          {ctr && <span>· CTR {ctr}</span>}
        </div>
      </div>
    </div>
  );
}

function Chip({ label, tone }: { label: string; tone: string }) {
  return (
    <span
      style={{
        padding: "3px 8px",
        borderRadius: 99,
        background: "rgba(255,255,255,.02)",
        border: `1px solid ${tone}33`,
        color: tone,
        fontFamily: MONO,
        fontSize: 9.5,
        letterSpacing: ".14em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

// referrerPolicy="no-referrer" est indispensable pour le CDN Meta
// (scontent.fbcdn.net) qui rejette les requêtes avec un Referer non facebook.
// Sans ça, une URL parfaitement valide retourne 403 côté navigateur.
function CreativeThumbnail({ creative }: { creative: CreativeRow }) {
  const url = resolveCreativeImageUrl(creative as Record<string, unknown>);
  const [errored, setErrored] = useState(false);
  const [open, setOpen] = useState(false);
  if (!url || errored) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: MONO,
          fontSize: 9.5,
          letterSpacing: ".18em",
          color: "#8b97ad",
          textTransform: "uppercase",
          padding: "0 12px",
          textAlign: "center",
        }}
      >
        {url ? "Image indisponible" : "Pas d'aperçu"}
      </div>
    );
  }
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Agrandir ${creative.ad_name ?? "l'aperçu"}`}
        style={{
          all: "unset",
          boxSizing: "border-box",
          position: "absolute",
          inset: 0,
          cursor: "zoom-in",
          display: "block",
        }}
      >
        <img
          src={url}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          onError={(e) => {
            // eslint-disable-next-line no-console
            console.warn("[Report] creative thumbnail failed", {
              url,
              ad_name: creative.ad_name,
              natural: (e.currentTarget as HTMLImageElement).naturalWidth,
            });
            setErrored(true);
          }}
        />
      </button>
      {open && (
        <CreativeLightbox
          url={url}
          name={creative.ad_name}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
