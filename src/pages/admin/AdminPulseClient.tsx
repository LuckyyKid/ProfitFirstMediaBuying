import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Send, Zap, CalendarClock, AlertCircle, CheckCircle2, Circle, Mail, Phone } from "lucide-react";
import { SendManualPulseDialog } from "@/components/admin/SendManualPulseDialog";
import { PulseHistoryCard } from "@/components/admin/PulseHistoryCard";
import {
  scheduledEventsForClient,
  EVENT_LABEL,
  type ClientLite,
  type MeetingLite,
  type OpenSurveyLite,
  type ScheduledPulseEvent,
} from "@/lib/pulseSchedule";

type PulseType = "onboarding" | "monthly" | "relational" | "weekly";

interface ClientRow extends ClientLite {
  email: string | null;
  phone: string | null;
}

interface OpenSurveyRow extends OpenSurveyLite {
  followup_sent_at: string | null;
  sent_channels: string[] | null;
  manual: boolean;
}

interface MeetingRow extends MeetingLite {
  followup_count: number;
}

interface PastPulseLite {
  client_code: string;
  type: "onboarding" | "monthly";
  sent_at: string;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("fr-CA") + " " + d.toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" });
}

function kindTone(kind: ScheduledPulseEvent["kind"]) {
  if (kind.endsWith("_escalation") || kind === "weekly_slack_reminder") {
    return "bg-orange-500/15 text-orange-500 border-orange-500/40";
  }
  if (kind.endsWith("_followup")) return "bg-blue-500/15 text-blue-500 border-blue-500/40";
  return "bg-muted text-muted-foreground";
}

function relativeLabel(ev: ScheduledPulseEvent): string {
  if (ev.hours_until <= 0.5) return "Maintenant";
  if (ev.hours_until < 24) return `Dans ${Math.round(ev.hours_until)}h`;
  return `Dans ${ev.days_until}j`;
}

const TYPE_LABEL: Record<PulseType, string> = {
  onboarding: "Onboarding J+7",
  monthly: "Mensuel",
  relational: "NPS relationnel",
  weekly: "Hebdo (meeting)",
};

export default function AdminPulseClient() {
  const { clientCode } = useParams<{ clientCode: string }>();
  const [client, setClient] = useState<ClientRow | null | undefined>(undefined);
  const [openSurveys, setOpenSurveys] = useState<OpenSurveyRow[] | null>(null);
  const [upcomingMeetings, setUpcomingMeetings] = useState<MeetingRow[] | null>(null);
  const [pastPulses, setPastPulses] = useState<PastPulseLite[] | null>(null);
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!clientCode) return;
    let cancelled = false;
    (async () => {
      setErr(null);
      const nowIso = new Date().toISOString();
      const [clientRes, openRes, meetingRes, pastRes] = await Promise.all([
        supabase
          .from("client_progress")
          .select("client_code, client_name, company_name, email, phone, archived_at, completed_at")
          .eq("client_code", clientCode)
          .maybeSingle(),
        supabase
          .from("pulse_surveys")
          .select("id, client_code, type, sent_at, followup_sent_at, escalated_at, closed_at, expires_at, sent_channels, manual")
          .eq("client_code", clientCode)
          .is("closed_at", null)
          .order("sent_at", { ascending: false })
          .limit(50),
        supabase
          .from("client_meetings")
          .select("id, client_code, scheduled_at, pulse_survey_id, initial_sent_at, last_followup_at, slack_reminded_at, followup_count")
          .eq("client_code", clientCode)
          .is("slack_reminded_at", null)
          .gte("scheduled_at", nowIso)
          .order("scheduled_at", { ascending: true })
          .limit(50),
        supabase
          .from("pulse_surveys")
          .select("client_code, type, sent_at")
          .eq("client_code", clientCode)
          .in("type", ["onboarding", "monthly"])
          .order("sent_at", { ascending: false })
          .limit(50),
      ]);

      if (cancelled) return;
      if (clientRes.error) {
        setErr(clientRes.error.message);
        setClient(null);
        return;
      }
      setClient((clientRes.data as unknown as ClientRow | null) ?? null);
      setOpenSurveys((openRes.data ?? []) as unknown as OpenSurveyRow[]);
      setUpcomingMeetings((meetingRes.data ?? []) as unknown as MeetingRow[]);
      setPastPulses((pastRes.data ?? []) as unknown as PastPulseLite[]);
    })();
    return () => { cancelled = true; };
  }, [clientCode, reloadTick]);

  const scheduledEvents = useMemo<ScheduledPulseEvent[] | null>(() => {
    if (!client || !openSurveys || !upcomingMeetings || !pastPulses) return null;
    return scheduledEventsForClient(client, pastPulses, openSurveys, upcomingMeetings)
      .sort((a, b) => a.next_send_at.getTime() - b.next_send_at.getTime());
  }, [client, openSurveys, upcomingMeetings, pastPulses]);

  const openMonthlyOnboarding = useMemo(
    () => (openSurveys ?? []).filter((s) => s.type === "onboarding" || s.type === "monthly"),
    [openSurveys],
  );

  const onSent = useCallback(() => setReloadTick((t) => t + 1), []);

  if (!clientCode) return null;

  if (client === undefined) {
    return (
      <div className="min-h-screen bg-background p-6 space-y-4">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (client === null) {
    return (
      <div className="min-h-screen bg-background p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Link to="/admin/pulse">
            <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> Retour</Button>
          </Link>
          <h1 className="text-2xl font-bold">Client introuvable</h1>
        </div>
        <Card className="p-6 text-sm text-muted-foreground">
          Le client <code>{clientCode}</code> n'existe pas dans <code>client_progress</code>.
          {err && <div className="mt-2 text-destructive">{err}</div>}
        </Card>
      </div>
    );
  }

  const displayName = client.company_name || client.client_name || client.client_code;
  const canReach = !!client.email || !!client.phone;

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Link to="/admin/pulse">
            <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> Pulse</Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{displayName}</h1>
            <div className="text-xs text-muted-foreground flex items-center gap-3 mt-0.5">
              <span>{client.client_code}</span>
              {client.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {client.email}</span>}
              {client.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {client.phone}</span>}
              {client.archived_at && (
                <Badge variant="outline" className="text-[10px] bg-muted">archivé</Badge>
              )}
              {!client.completed_at && !client.archived_at && (
                <Badge variant="outline" className="text-[10px]">onboarding en cours</Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link to={`/admin/clients/${client.client_code}`}>
            <Button variant="outline" size="sm">Fiche client</Button>
          </Link>
          <Button size="sm" onClick={() => setManualDialogOpen(true)} disabled={!canReach}>
            <Send className="h-4 w-4 mr-1" /> Envoyer pulse manuel
          </Button>
        </div>
      </div>

      {!canReach && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 flex gap-2 items-start text-xs">
          <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
          <div>Aucun email ni téléphone renseigné — les pulses ne pourront pas être envoyés.</div>
        </div>
      )}

      {/* ── PROCHAINS ÉVÈNEMENTS PROGRAMMÉS ────────────────────────────── */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold">Prochains envois programmés</h2>
        </div>
        <p className="text-[11px] text-muted-foreground -mt-2">
          Envois initiaux, relances J+1, escalades J+2, et cycle weekly (T-48h · +24h · ping Slack J-0)
        </p>
        {scheduledEvents === null ? (
          <Skeleton className="h-16 w-full" />
        ) : scheduledEvents.length === 0 ? (
          <div className="text-sm text-muted-foreground py-3 text-center">
            Aucun évènement programmé.
          </div>
        ) : (
          <div className="space-y-1.5">
            {scheduledEvents.map((ev) => {
              const isSlack = ev.kind === "weekly_slack_reminder";
              return (
                <div
                  key={ev.key}
                  className="grid grid-cols-12 gap-2 items-center text-xs rounded-md border border-border/50 bg-background/40 px-3 py-2"
                >
                  <div className="col-span-6">
                    <Badge variant="outline" className={`text-[10px] ${kindTone(ev.kind)}`}>
                      {EVENT_LABEL[ev.kind]}
                    </Badge>
                    {ev.reason && (
                      <div className="text-[10px] text-muted-foreground mt-1">{ev.reason}</div>
                    )}
                  </div>
                  <div className="col-span-3">
                    <div className="font-medium">{relativeLabel(ev)}</div>
                    <div className="text-muted-foreground text-[10px]">
                      {ev.next_send_at.toLocaleDateString("fr-CA")} · {ev.next_send_at.toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                  <div className="col-span-3 flex gap-1 justify-end flex-wrap">
                    {isSlack ? (
                      <Badge variant="outline" className="text-[10px]">Slack</Badge>
                    ) : (
                      <>
                        {ev.channels.email && <Badge variant="outline" className="text-[10px]">email</Badge>}
                        {ev.channels.sms && <Badge variant="outline" className="text-[10px]">SMS</Badge>}
                        {ev.status === "no_channel" && (
                          <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-500 border-red-500/40">
                            aucun canal
                          </Badge>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* ── CYCLES OUVERTS (onboarding + monthly) ──────────────────────── */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-blue-500" />
          <h2 className="text-base font-semibold">Cycles ouverts</h2>
        </div>
        {openSurveys === null ? (
          <Skeleton className="h-16 w-full" />
        ) : openMonthlyOnboarding.length === 0 ? (
          <div className="text-sm text-muted-foreground py-3 text-center">
            Aucun cycle onboarding/mensuel en cours.
          </div>
        ) : (
          <div className="space-y-2">
            {openMonthlyOnboarding.map((s) => (
              <div key={s.id} className="rounded-md border border-border/50 bg-background/40 p-3 text-xs space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-[10px]">{TYPE_LABEL[s.type as PulseType]}</Badge>
                  {s.manual && <Badge variant="outline" className="text-[10px]">manuel</Badge>}
                  <span className="text-muted-foreground">
                    Envoyé le {fmtDate(s.sent_at)} · Canaux : {(s.sent_channels ?? []).join(" + ") || "—"}
                  </span>
                </div>
                <OpenCycleTimeline
                  sentAt={s.sent_at}
                  followupSentAt={s.followup_sent_at}
                  escalatedAt={s.escalated_at}
                />
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ── MEETINGS À VENIR (weekly) ──────────────────────────────────── */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold">Meetings à venir · cycle weekly</h2>
        </div>
        {upcomingMeetings === null ? (
          <Skeleton className="h-16 w-full" />
        ) : upcomingMeetings.length === 0 ? (
          <div className="text-sm text-muted-foreground py-3 text-center">
            Aucun meeting à venir. Le pulse hebdo est déclenché par un meeting programmé
            via l'app externe (endpoint <code>meeting-scheduled</code>).
          </div>
        ) : (
          <div className="space-y-2">
            {upcomingMeetings.map((m) => (
              <div key={m.id} className="rounded-md border border-border/50 bg-background/40 p-3 text-xs space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">Meeting le {fmtDate(m.scheduled_at)}</span>
                  {m.pulse_survey_id && (
                    <Badge variant="outline" className="text-[10px]">survey liée</Badge>
                  )}
                </div>
                <div className="text-muted-foreground">
                  Envoi initial : {fmtDate(m.initial_sent_at)}
                  {" · "}Dernier suivi : {fmtDate(m.last_followup_at)}
                  {" · "}Nb suivis : {m.followup_count ?? 0}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ── HISTORIQUE COMPLET (réutilise PulseHistoryCard) ────────────── */}
      <div>
        <div className="text-base font-semibold mb-2">Historique complet</div>
        <PulseHistoryCard clientCode={client.client_code} />
      </div>

      <SendManualPulseDialog
        open={manualDialogOpen}
        onOpenChange={setManualDialogOpen}
        defaultClientCode={client.client_code}
        onSent={onSent}
      />
    </div>
  );
}

// Timeline visuelle du cycle onboarding/mensuel :
// [Envoyé J+0] → [Relance J+1] → [Escalade Slack J+2]
function OpenCycleTimeline({
  sentAt,
  followupSentAt,
  escalatedAt,
}: {
  sentAt: string;
  followupSentAt: string | null;
  escalatedAt: string | null;
}) {
  const followupDone = !!followupSentAt;
  const escalated = !!escalatedAt;
  const StepIcon = ({ done, active }: { done: boolean; active?: boolean }) =>
    done ? (
      <CheckCircle2 className="h-3 w-3" />
    ) : active ? (
      <Circle className="h-3 w-3 animate-pulse" />
    ) : (
      <Circle className="h-3 w-3" />
    );
  const sep = <span className="text-muted-foreground/60">→</span>;
  return (
    <div className="flex items-center gap-2 text-[11px] pt-1.5 border-t border-border/40">
      <span className="flex items-center gap-1 text-emerald-500">
        <StepIcon done /> Envoyé {fmtDate(sentAt)}
      </span>
      {sep}
      <span className={`flex items-center gap-1 ${followupDone ? "text-blue-500" : "text-muted-foreground"}`}>
        <StepIcon done={followupDone} active={!followupDone} />
        {followupDone ? `Relance ${fmtDate(followupSentAt)}` : "Relance J+1"}
      </span>
      {sep}
      <span className={`flex items-center gap-1 ${escalated ? "text-orange-500 font-medium" : "text-muted-foreground"}`}>
        <StepIcon done={escalated} active={followupDone && !escalated} />
        {escalated ? `Escaladé ${fmtDate(escalatedAt)}` : "Escalade Slack J+2"}
      </span>
    </div>
  );
}
