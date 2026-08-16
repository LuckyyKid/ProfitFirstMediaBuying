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
  type: "onboarding" | "monthly" | "relational";
  sent_at: string;
  closed_at: string | null;
  escalated_at: string | null;
  followup_sent_at: string | null;
  previous_score: number | null;
  sent_channels: string[] | null;
  manual: boolean;
  slack_posted_at: string | null;
  clickup_commented_at: string | null;
  response: { score: number; verbatim: string | null; responded_at: string; source: string } | null;
}

const TRAJECTORY_DROP = 2;

function typeLabel(t: Row["type"]): string {
  if (t === "onboarding") return "Onboarding J+7";
  if (t === "monthly") return "Mensuel";
  return "NPS relationnel";
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
          .select("survey_id, score, verbatim, responded_at, source")
          .in("survey_id", ids);
        if (rErr) {
          setErr(rErr.message);
          setRows([]);
          return;
        }
        for (const r of responses ?? []) {
          respByS.set(r.survey_id, {
            score: r.score,
            verbatim: r.verbatim,
            responded_at: r.responded_at,
            source: r.source,
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
                {r.response && (
                  <Badge variant="outline" className={`text-[10px] ${scoreTone(r.response.score, r.previous_score)}`}>
                    {r.response.score}/10
                    {r.previous_score != null && ` (dernier : ${r.previous_score})`}
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
              {r.response?.verbatim && (
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
