import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  clientCode: string;
}

interface Row {
  id: string;
  type: "onboarding" | "monthly" | "relational" | "weekly";
  sent_at: string;
  closed_at: string | null;
  escalated_at: string | null;
  followup_sent_at: string | null;
  previous_score: number | null;
  sent_channels: string[] | null;
  manual: boolean;
  slack_posted_at: string | null;
  clickup_commented_at: string | null;
  response: {
    score: number | null;
    communication_score: number | null;
    verbatim: string | null;
    responded_at: string;
    source: string;
    nps_score: number | null;
    confidence_next_month: number | null;
    collab_health: "very_healthy" | "good" | "fragile" | "at_risk" | null;
    improvement_one_thing: string | null;
    keep_doing: string | null;
    difficulties: string[] | null;
    difficulties_other: string | null;
    business_impact: number | null;
    next_month_priority: string | null;
    next_month_priority_other: string | null;
    monthly_completed_at: string | null;
    weekly_pace_score: number | null;
    weekly_blocker: string | null;
    weekly_next_priority: string | null;
    weekly_completed_at: string | null;
  } | null;
}

const COLLAB_LABEL: Record<string, string> = {
  very_healthy: "Très sain",
  good: "Bon",
  fragile: "Fragile",
  at_risk: "À risque",
};
const COLLAB_TONE: Record<string, string> = {
  very_healthy: "bg-emerald-500/15 text-emerald-500 border-emerald-500/40",
  good: "bg-yellow-500/15 text-yellow-500 border-yellow-500/40",
  fragile: "bg-orange-500/15 text-orange-500 border-orange-500/40",
  at_risk: "bg-red-500/15 text-red-500 border-red-500/40",
};
const PRIORITY_LABEL: Record<string, string> = {
  volume: "Volume",
  profitability: "Rentabilité",
  test_angles: "Nouveaux angles",
  creatives: "Créas",
  foundation: "Fondations",
  stabilize: "Stabiliser",
  other: "Autre",
};
const DIFF_LABEL: Record<string, string> = {
  communication: "Communication",
  creative_quality: "Qualité créa",
  creative_volume: "Volume créa",
  strategy: "Stratégie",
  timelines: "Délais",
  reporting: "Reporting",
  brand_understanding: "Compréhension marque",
  other: "Autre",
};

const TRAJECTORY_DROP = 2;

function typeLabel(t: Row["type"]): string {
  if (t === "onboarding") return "Onboarding J+7";
  if (t === "monthly") return "Mensuel";
  if (t === "weekly") return "Hebdo (meeting)";
  return "NPS relationnel";
}

function paceTone(pace: number): string {
  if (pace <= 2) return "bg-red-500/15 text-red-500 border-red-500/40";
  if (pace === 3) return "bg-yellow-500/15 text-yellow-500 border-yellow-500/40";
  return "bg-green-500/15 text-green-500 border-green-500/40";
}

function scoreTone(score: number, previous_score: number | null): string {
  const dropped = previous_score != null && (previous_score - score) >= TRAJECTORY_DROP;
  if (dropped) return "bg-orange-500/15 text-orange-500 border-orange-500/40";
  if (score <= 6) return "bg-red-500/15 text-red-500 border-red-500/40";
  if (score <= 8) return "bg-yellow-500/15 text-yellow-500 border-yellow-500/40";
  return "bg-green-500/15 text-green-500 border-green-500/40";
}

function statusLabel(r: Row): { label: string; className: string } {
  if (r.response) return { label: "Répondu", className: "bg-emerald-500/15 text-emerald-500 border-emerald-500/40" };
  if (r.escalated_at) return { label: "Escaladé Slack", className: "bg-orange-500/15 text-orange-500 border-orange-500/40" };
  if (r.closed_at) return { label: "Fermé", className: "bg-muted text-muted-foreground" };
  return { label: "En attente", className: "bg-blue-500/15 text-blue-500 border-blue-500/40" };
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("fr-CA") + " " + d.toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" });
}

export function PulseHistoryCard({ clientCode }: Props) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setErr(null);
      const { data: surveys, error } = await supabase
        .from("pulse_surveys")
        .select("id, type, sent_at, closed_at, escalated_at, followup_sent_at, previous_score, sent_channels, manual, slack_posted_at, clickup_commented_at")
        .eq("client_code", clientCode)
        .order("sent_at", { ascending: false })
        .limit(50);
      if (cancelled) return;
      if (error) {
        setErr(error.message);
        setRows([]);
        return;
      }
      const ids = (surveys ?? []).map((s: any) => s.id);
      const respByS = new Map<string, Row["response"]>();
      if (ids.length > 0) {
        const { data: responses, error: rErr } = await supabase
          .from("pulse_responses")
          .select(`
            survey_id, score, communication_score, verbatim, responded_at, source,
            nps_score, confidence_next_month, collab_health,
            improvement_one_thing, keep_doing, difficulties, difficulties_other,
            business_impact, next_month_priority, next_month_priority_other,
            monthly_completed_at,
            weekly_pace_score, weekly_blocker, weekly_next_priority, weekly_completed_at
          `)
          .in("survey_id", ids);
        if (rErr) {
          setErr(rErr.message);
          setRows([]);
          return;
        }
        for (const r of responses ?? []) {
          respByS.set(r.survey_id, {
            score: r.score,
            communication_score: (r as any).communication_score ?? null,
            verbatim: r.verbatim,
            responded_at: r.responded_at,
            source: r.source,
            nps_score: (r as any).nps_score ?? null,
            confidence_next_month: (r as any).confidence_next_month ?? null,
            collab_health: (r as any).collab_health ?? null,
            improvement_one_thing: (r as any).improvement_one_thing ?? null,
            keep_doing: (r as any).keep_doing ?? null,
            difficulties: (r as any).difficulties ?? null,
            difficulties_other: (r as any).difficulties_other ?? null,
            business_impact: (r as any).business_impact ?? null,
            next_month_priority: (r as any).next_month_priority ?? null,
            next_month_priority_other: (r as any).next_month_priority_other ?? null,
            monthly_completed_at: (r as any).monthly_completed_at ?? null,
            weekly_pace_score: (r as any).weekly_pace_score ?? null,
            weekly_blocker: (r as any).weekly_blocker ?? null,
            weekly_next_priority: (r as any).weekly_next_priority ?? null,
            weekly_completed_at: (r as any).weekly_completed_at ?? null,
          });
        }
      }
      setRows(
        (surveys ?? []).map((s: any) => ({
          ...s,
          response: respByS.get(s.id) ?? null,
        })),
      );
    })();
    return () => { cancelled = true; };
  }, [clientCode]);

  if (rows === null) {
    return (
      <Card className="p-6 glass-card space-y-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-16 w-full" />
      </Card>
    );
  }

  if (err) {
    return (
      <Card className="p-6 glass-card text-sm text-destructive">
        Impossible de charger l'historique pulse&nbsp;: {err}
      </Card>
    );
  }

  if (rows.length === 0) {
    return (
      <Card className="p-6 glass-card text-sm text-muted-foreground">
        Aucun pulse envoyé pour ce client — les envois automatiques démarrent à J+7 après onboarding
        et chaque dernier jour ouvrable du mois. Tu peux aussi en lancer un manuel depuis la fiche Admin.
      </Card>
    );
  }

  return (
    <Card className="p-4 glass-card space-y-3">
      <div className="text-sm font-medium">Historique pulse ({rows.length})</div>
      <div className="space-y-2">
        {rows.map((r) => {
          const status = statusLabel(r);
          const channels = (r.sent_channels ?? []).join(" + ") || "—";
          return (
            <div key={r.id} className="rounded-lg border border-border/60 bg-background/40 p-3 text-xs space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm">{typeLabel(r.type)}</span>
                {r.manual && <Badge variant="outline" className="text-[10px]">manuel</Badge>}
                <Badge variant="outline" className={`text-[10px] ${status.className}`}>{status.label}</Badge>
                {r.response && r.response.score != null && (
                  <Badge variant="outline" className={`text-[10px] ${scoreTone(r.response.score, r.previous_score)}`}>
                    {r.response.score}/10
                    {r.previous_score != null && ` (dernier : ${r.previous_score})`}
                  </Badge>
                )}
                {r.type === "weekly" && r.response?.weekly_pace_score != null && (
                  <Badge variant="outline" className={`text-[10px] ${paceTone(r.response.weekly_pace_score)}`}>
                    pace {r.response.weekly_pace_score}/5
                  </Badge>
                )}
                {r.response?.communication_score != null && (
                  <Badge variant="outline" className={`text-[10px] ${scoreTone(r.response.communication_score, null)}`}>
                    com {r.response.communication_score}/10
                  </Badge>
                )}
                {r.type === "onboarding" && r.response && r.response.communication_score == null && (
                  <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground">
                    com : —
                  </Badge>
                )}
                {r.followup_sent_at && !r.response && (
                  <Badge variant="outline" className="text-[10px]">relance envoyée</Badge>
                )}
              </div>
              <div className="text-muted-foreground">
                Envoyé le {fmtDate(r.sent_at)} · Canaux : {channels}
                {r.response && ` · Répondu le ${fmtDate(r.response.responded_at)}`}
              </div>
              {r.response && r.type === "monthly" && (
                <MonthlyDetail response={r.response} />
              )}
              {r.response && r.type === "weekly" && (
                <WeeklyDetail response={r.response} />
              )}
              {r.response?.verbatim && r.type !== "monthly" && r.type !== "weekly" && (
                <div className="italic text-foreground/90 pt-1 border-t border-border/40">
                  &ldquo;{r.response.verbatim}&rdquo;
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// Détail des 10 champs mensuels — affiché sous chaque ligne de type "monthly"
function MonthlyDetail({ response }: { response: NonNullable<Row["response"]> }) {
  const r = response;
  const hasAny =
    r.nps_score != null ||
    r.confidence_next_month != null ||
    r.collab_health ||
    r.improvement_one_thing ||
    r.keep_doing ||
    (r.difficulties && r.difficulties.length > 0) ||
    r.business_impact != null ||
    r.next_month_priority ||
    r.verbatim;
  if (!hasAny) return null;

  const diffLabels = (r.difficulties ?? [])
    .filter((c) => c !== "other")
    .map((c) => DIFF_LABEL[c] ?? c);
  if ((r.difficulties ?? []).includes("other") && r.difficulties_other) {
    diffLabels.push(`Autre — ${r.difficulties_other}`);
  }

  const priorityLabel = r.next_month_priority === "other"
    ? `Autre — ${r.next_month_priority_other ?? "(non précisé)"}`
    : (r.next_month_priority ? PRIORITY_LABEL[r.next_month_priority] : null);

  return (
    <div className="mt-2 pt-2 border-t border-border/40 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        {r.monthly_completed_at ? (
          <Badge variant="outline" className="text-[10px] bg-emerald-500/15 text-emerald-500 border-emerald-500/40">
            formulaire complet
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px] bg-yellow-500/15 text-yellow-500 border-yellow-500/40">
            formulaire partiel
          </Badge>
        )}
        {r.nps_score != null && (
          <Badge variant="outline" className={`text-[10px] ${scoreTone(r.nps_score, null)}`}>
            NPS {r.nps_score}/10
          </Badge>
        )}
        {r.confidence_next_month != null && (
          <Badge variant="outline" className="text-[10px]">
            confiance {r.confidence_next_month}/5
          </Badge>
        )}
        {r.business_impact != null && (
          <Badge variant="outline" className="text-[10px]">
            impact {r.business_impact}/5
          </Badge>
        )}
        {r.collab_health && (
          <Badge variant="outline" className={`text-[10px] ${COLLAB_TONE[r.collab_health] ?? ""}`}>
            collab : {COLLAB_LABEL[r.collab_health] ?? r.collab_health}
          </Badge>
        )}
        {priorityLabel && (
          <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/40">
            priorité : {priorityLabel}
          </Badge>
        )}
      </div>

      {diffLabels.length > 0 && (
        <div className="text-[11px] text-muted-foreground">
          <span className="font-medium text-foreground/80">Difficultés : </span>
          {diffLabels.join(", ")}
        </div>
      )}

      {r.verbatim && (
        <div className="italic text-foreground/90 text-xs">
          <span className="not-italic text-muted-foreground font-medium">Raison du score : </span>
          &ldquo;{r.verbatim}&rdquo;
        </div>
      )}
      {r.improvement_one_thing && (
        <div className="italic text-foreground/90 text-xs">
          <span className="not-italic text-muted-foreground font-medium">À améliorer : </span>
          &ldquo;{r.improvement_one_thing}&rdquo;
        </div>
      )}
      {r.keep_doing && (
        <div className="italic text-foreground/90 text-xs">
          <span className="not-italic text-muted-foreground font-medium">À garder : </span>
          &ldquo;{r.keep_doing}&rdquo;
        </div>
      )}
    </div>
  );
}

// Détail des 4 champs weekly (déclenché par meeting-scheduled)
function WeeklyDetail({ response }: { response: NonNullable<Row["response"]> }) {
  const r = response;
  const hasAny = r.weekly_pace_score != null || r.verbatim || r.weekly_blocker || r.weekly_next_priority;
  if (!hasAny) return null;

  return (
    <div className="mt-2 pt-2 border-t border-border/40 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        {r.weekly_completed_at ? (
          <Badge variant="outline" className="text-[10px] bg-emerald-500/15 text-emerald-500 border-emerald-500/40">
            formulaire complet
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px] bg-yellow-500/15 text-yellow-500 border-yellow-500/40">
            formulaire partiel
          </Badge>
        )}
      </div>

      {r.verbatim && (
        <div className="italic text-foreground/90 text-xs">
          <span className="not-italic text-muted-foreground font-medium">Raison du score : </span>
          &ldquo;{r.verbatim}&rdquo;
        </div>
      )}
      {r.weekly_blocker && (
        <div className="italic text-foreground/90 text-xs">
          <span className="not-italic text-muted-foreground font-medium">Blocker : </span>
          &ldquo;{r.weekly_blocker}&rdquo;
        </div>
      )}
      {r.weekly_next_priority && (
        <div className="italic text-foreground/90 text-xs">
          <span className="not-italic text-muted-foreground font-medium">Priorité semaine prochaine : </span>
          &ldquo;{r.weekly_next_priority}&rdquo;
        </div>
      )}
    </div>
  );
}
