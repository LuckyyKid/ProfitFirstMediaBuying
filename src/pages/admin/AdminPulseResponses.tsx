import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, ExternalLink, Copy, Send, CheckCircle2, Circle, Info, Zap } from "lucide-react";
import { toast } from "sonner";
import { SendManualPulseDialog } from "@/components/admin/SendManualPulseDialog";
import {
  computeAllScheduledPulses,
  type ClientLite,
  type ScheduledPulse,
} from "@/lib/pulseSchedule";

type PulseType = "onboarding" | "monthly" | "relational" | "weekly";

interface Row {
  id: string;
  client_code: string;
  type: PulseType;
  sent_at: string;
  closed_at: string | null;
  escalated_at: string | null;
  followup_sent_at: string | null;
  previous_score: number | null;
  sent_channels: string[] | null;
  manual: boolean;
  created_by: string | null;
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
    business_impact: number | null;
    next_month_priority: string | null;
    monthly_completed_at: string | null;
    weekly_pace_score: number | null;
    weekly_blocker: string | null;
    weekly_next_priority: string | null;
    weekly_completed_at: string | null;
  } | null;
  client_display: string | null;
}

const COLLAB_LABEL_SHORT: Record<string, string> = {
  very_healthy: "sain",
  good: "bon",
  fragile: "fragile",
  at_risk: "à risque",
};
const COLLAB_TONE: Record<string, string> = {
  very_healthy: "bg-emerald-500/15 text-emerald-500 border-emerald-500/40",
  good: "bg-yellow-500/15 text-yellow-500 border-yellow-500/40",
  fragile: "bg-orange-500/15 text-orange-500 border-orange-500/40",
  at_risk: "bg-red-500/15 text-red-500 border-red-500/40",
};

const TRAJECTORY_DROP = 2;

const typeLabel: Record<PulseType, string> = {
  onboarding: "Onboarding J+7",
  monthly: "Mensuel",
  relational: "NPS relationnel",
  weekly: "Hebdo (meeting)",
};

function scoreTone(score: number, previous: number | null): string {
  const dropped = previous != null && (previous - score) >= TRAJECTORY_DROP;
  if (dropped) return "bg-orange-500/15 text-orange-500 border-orange-500/40";
  if (score <= 6) return "bg-red-500/15 text-red-500 border-red-500/40";
  if (score <= 8) return "bg-yellow-500/15 text-yellow-500 border-yellow-500/40";
  return "bg-green-500/15 text-green-500 border-green-500/40";
}

function paceTone(pace: number): string {
  if (pace <= 2) return "bg-red-500/15 text-red-500 border-red-500/40";
  if (pace === 3) return "bg-yellow-500/15 text-yellow-500 border-yellow-500/40";
  return "bg-green-500/15 text-green-500 border-green-500/40";
}

function statusLabel(r: Row): { label: string; className: string } {
  if (r.response) return { label: "Répondu", className: "bg-emerald-500/15 text-emerald-500 border-emerald-500/40" };
  if (r.escalated_at) return { label: "Escaladé", className: "bg-orange-500/15 text-orange-500 border-orange-500/40" };
  if (r.closed_at) return { label: "Fermé", className: "bg-muted text-muted-foreground" };
  return { label: "En attente", className: "bg-blue-500/15 text-blue-500 border-blue-500/40" };
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("fr-CA") + " " + d.toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" });
}

export default function AdminPulseResponses() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [activeClients, setActiveClients] = useState<ClientLite[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<"all" | PulseType>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "answered" | "pending" | "escalated">("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | "auto" | "manual">("all");
  const [search, setSearch] = useState("");
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [manualDefaultCode, setManualDefaultCode] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  const openManualDialog = useCallback((code: string | null) => {
    setManualDefaultCode(code);
    setManualDialogOpen(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setErr(null);
      const [surveyRes, activeRes] = await Promise.all([
        supabase
          .from("pulse_surveys")
          .select("id, client_code, type, sent_at, closed_at, escalated_at, followup_sent_at, previous_score, sent_channels, manual, created_by, slack_posted_at, clickup_commented_at")
          .order("sent_at", { ascending: false })
          .limit(200),
        supabase
          .from("client_progress")
          .select("client_code, client_name, company_name, email, phone, archived_at, completed_at")
          .is("archived_at", null)
          .not("completed_at", "is", null)
          .limit(500),
      ]);

      if (cancelled) return;
      if (surveyRes.error) {
        setErr(surveyRes.error.message);
        setRows([]);
        setActiveClients([]);
        return;
      }
      const surveys = surveyRes.data ?? [];
      const activeList = (activeRes.data ?? []) as ClientLite[];
      setActiveClients(activeList);

      const ids = surveys.map((s: any) => s.id);
      const codes = Array.from(new Set(surveys.map((s: any) => s.client_code)));

      const [respRes, clientRes] = await Promise.all([
        ids.length
          ? supabase.from("pulse_responses").select("survey_id, score, communication_score, verbatim, responded_at, source, nps_score, confidence_next_month, collab_health, business_impact, next_month_priority, monthly_completed_at, weekly_pace_score, weekly_blocker, weekly_next_priority, weekly_completed_at").in("survey_id", ids)
          : Promise.resolve({ data: [], error: null }),
        codes.length
          ? supabase.from("client_progress").select("client_code, client_name, company_name").in("client_code", codes)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (cancelled) return;

      const respByS = new Map<string, Row["response"]>();
      for (const r of (respRes as any).data ?? []) {
        respByS.set(r.survey_id, {
          score: r.score ?? null,
          communication_score: r.communication_score ?? null,
          verbatim: r.verbatim,
          responded_at: r.responded_at,
          source: r.source,
          nps_score: r.nps_score ?? null,
          confidence_next_month: r.confidence_next_month ?? null,
          collab_health: r.collab_health ?? null,
          business_impact: r.business_impact ?? null,
          next_month_priority: r.next_month_priority ?? null,
          monthly_completed_at: r.monthly_completed_at ?? null,
          weekly_pace_score: r.weekly_pace_score ?? null,
          weekly_blocker: r.weekly_blocker ?? null,
          weekly_next_priority: r.weekly_next_priority ?? null,
          weekly_completed_at: r.weekly_completed_at ?? null,
        });
      }
      const displayByCode = new Map<string, string | null>();
      for (const c of (clientRes as any).data ?? []) {
        displayByCode.set(c.client_code, c.company_name || c.client_name || c.client_code);
      }

      setRows(surveys.map((s: any) => ({
        ...s,
        response: respByS.get(s.id) ?? null,
        client_display: displayByCode.get(s.client_code) ?? s.client_code,
      })));
    })();
    return () => { cancelled = true; };
  }, [reloadTick]);

  const scheduled = useMemo<ScheduledPulse[] | null>(() => {
    if (!activeClients || !rows) return null;
    const pulses = rows
      .filter(r => r.type !== "relational")
      .map(r => ({ client_code: r.client_code, type: r.type as "onboarding" | "monthly", sent_at: r.sent_at }));
    return computeAllScheduledPulses(activeClients, pulses);
  }, [activeClients, rows]);

  const upcomingScheduled = useMemo(() => {
    if (!scheduled) return null;
    return scheduled.filter(s => s.status !== "already_sent").slice(0, 12);
  }, [scheduled]);

  const filtered = useMemo(() => {
    if (!rows) return null;
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (typeFilter !== "all" && r.type !== typeFilter) return false;
      if (statusFilter === "answered" && !r.response) return false;
      if (statusFilter === "pending" && (r.response || r.closed_at)) return false;
      if (statusFilter === "escalated" && !r.escalated_at) return false;
      if (sourceFilter === "auto" && r.manual) return false;
      if (sourceFilter === "manual" && !r.manual) return false;
      if (q) {
        const haystack = `${r.client_code} ${r.client_display ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [rows, typeFilter, statusFilter, sourceFilter, search]);

  const stats = useMemo(() => {
    if (!filtered) return null;
    const answered = filtered.filter(r => r.response).length;
    const pending = filtered.filter(r => !r.response && !r.closed_at).length;
    const escalated = filtered.filter(r => r.escalated_at).length;
    const scores = filtered.map(r => r.response?.score).filter((s): s is number => s != null);
    const avg = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : "—";
    const commScores = filtered
      .filter(r => r.type === "onboarding")
      .map(r => r.response?.communication_score)
      .filter((s): s is number => s != null);
    const commAvg = commScores.length ? (commScores.reduce((a, b) => a + b, 0) / commScores.length).toFixed(1) : "—";
    return { total: filtered.length, answered, pending, escalated, avg, commAvg };
  }, [filtered]);

  const copyPulseUrl = () => {
    const url = `${window.location.origin}/pulse`;
    navigator.clipboard.writeText(url).then(
      () => toast.success(`URL copiée : ${url}`),
      () => toast.error("Impossible de copier"),
    );
  };

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Link to="/admin">
            <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> Admin</Button>
          </Link>
          <h1 className="text-2xl font-bold">Pulse — toutes les réponses</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={copyPulseUrl}>
            <Copy className="h-4 w-4 mr-1" /> Copier URL /pulse
          </Button>
          <Button size="sm" variant="outline" onClick={() => openManualDialog(null)}>
            <Send className="h-4 w-4 mr-1" /> Envoyer pulse manuel
          </Button>
          <Link to="/pulse" target="_blank">
            <Button size="sm">
              <ExternalLink className="h-4 w-4 mr-1" /> Ouvrir /pulse
            </Button>
          </Link>
        </div>
      </div>

      <ScheduledPulsesCard
        list={upcomingScheduled}
        totalScheduled={scheduled?.filter(s => s.status !== "already_sent").length ?? 0}
        onForce={(code) => openManualDialog(code)}
      />

      <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3 flex gap-2 items-start text-xs">
        <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
        <div className="text-blue-100/90">
          Un envoi <b>manuel</b> déclenche le même workflow que le cron : relance email + SMS à J+1,
          escalade Slack <code>#head-of-things</code> à J+2 si pas de réponse.
        </div>
      </div>

      <Card className="p-4 grid grid-cols-2 sm:grid-cols-6 gap-3">
        <div><div className="text-xs text-muted-foreground">Total</div><div className="text-2xl font-bold">{stats?.total ?? "—"}</div></div>
        <div><div className="text-xs text-muted-foreground">Répondus</div><div className="text-2xl font-bold text-emerald-500">{stats?.answered ?? "—"}</div></div>
        <div><div className="text-xs text-muted-foreground">En attente</div><div className="text-2xl font-bold text-blue-500">{stats?.pending ?? "—"}</div></div>
        <div><div className="text-xs text-muted-foreground">Escaladés</div><div className="text-2xl font-bold text-orange-500">{stats?.escalated ?? "—"}</div></div>
        <div><div className="text-xs text-muted-foreground">Score moyen</div><div className="text-2xl font-bold">{stats?.avg ?? "—"}</div></div>
        <div><div className="text-xs text-muted-foreground">Com. moy. (onb.)</div><div className="text-2xl font-bold">{stats?.commAvg ?? "—"}</div></div>
      </Card>

      <Card className="p-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs text-muted-foreground">Recherche</label>
          <Input placeholder="code client ou nom..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="w-[180px]">
          <label className="text-xs text-muted-foreground">Type</label>
          <Select value={typeFilter} onValueChange={(v: any) => setTypeFilter(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="onboarding">Onboarding J+7</SelectItem>
              <SelectItem value="monthly">Mensuel</SelectItem>
              <SelectItem value="weekly">Hebdo (meeting)</SelectItem>
              <SelectItem value="relational">NPS relationnel</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-[180px]">
          <label className="text-xs text-muted-foreground">Statut</label>
          <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="answered">Répondus</SelectItem>
              <SelectItem value="pending">En attente</SelectItem>
              <SelectItem value="escalated">Escaladés</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-[160px]">
          <label className="text-xs text-muted-foreground">Source</label>
          <Select value={sourceFilter} onValueChange={(v: any) => setSourceFilter(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes</SelectItem>
              <SelectItem value="auto">Auto (cron)</SelectItem>
              <SelectItem value="manual">Manuel</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {err && (
        <Card className="p-4 text-sm text-destructive">Erreur : {err}</Card>
      )}

      {!filtered && (
        <Card className="p-6 space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </Card>
      )}

      {filtered && filtered.length === 0 && (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Aucune réponse ne correspond à ces filtres.
        </Card>
      )}

      {filtered && filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map((r) => {
            const status = statusLabel(r);
            const channels = (r.sent_channels ?? []).join(" + ") || "—";
            return (
              <Card key={r.id} className="p-4 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link to={`/admin/clients/${r.client_code}`} className="font-semibold hover:underline">
                    {r.client_display}
                  </Link>
                  <span className="text-xs text-muted-foreground">{r.client_code}</span>
                  <Badge variant="outline" className="text-[10px]">{typeLabel[r.type]}</Badge>
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
                  {r.type === "weekly" && r.response && !r.response.weekly_completed_at && (
                    <Badge variant="outline" className="text-[10px] bg-yellow-500/15 text-yellow-500 border-yellow-500/40">
                      formulaire partiel
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
                  {r.type === "monthly" && r.response?.nps_score != null && (
                    <Badge variant="outline" className={`text-[10px] ${scoreTone(r.response.nps_score, null)}`}>
                      NPS {r.response.nps_score}/10
                    </Badge>
                  )}
                  {r.type === "monthly" && r.response?.collab_health && (
                    <Badge variant="outline" className={`text-[10px] ${COLLAB_TONE[r.response.collab_health] ?? ""}`}>
                      collab {COLLAB_LABEL_SHORT[r.response.collab_health] ?? r.response.collab_health}
                    </Badge>
                  )}
                  {r.type === "monthly" && r.response && !r.response.monthly_completed_at && (
                    <Badge variant="outline" className="text-[10px] bg-yellow-500/15 text-yellow-500 border-yellow-500/40">
                      formulaire partiel
                    </Badge>
                  )}
                  {r.followup_sent_at && !r.response && (
                    <Badge variant="outline" className="text-[10px]">relance envoyée</Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  Envoyé le {fmtDate(r.sent_at)} · Canaux : {channels}
                  {r.response && ` · Répondu le ${fmtDate(r.response.responded_at)} (${r.response.source})`}
                  {r.escalated_at && ` · Escaladé le ${fmtDate(r.escalated_at)}`}
                </div>
                <FollowupTimeline r={r} />
                {r.response?.verbatim && (
                  <div className="italic text-sm text-foreground/90 pt-2 border-t border-border/40">
                    &ldquo;{r.response.verbatim}&rdquo;
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <SendManualPulseDialog
        open={manualDialogOpen}
        onOpenChange={setManualDialogOpen}
        defaultClientCode={manualDefaultCode}
        onSent={() => setReloadTick((t) => t + 1)}
      />
    </div>
  );
}

// Timeline visuelle de la relance : [Envoyé] → [Relance J+1] → [Escaladé J+2]
// ou [Envoyé] → [Répondu] quand le client a répondu.
function FollowupTimeline({ r }: { r: Row }) {
  const responded = !!r.response;
  const followupDone = !!r.followup_sent_at;
  const escalated = !!r.escalated_at;
  const closed = !!r.closed_at && !responded;

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
        <StepIcon done /> Envoyé J+0
      </span>
      {sep}
      {responded ? (
        <span className="flex items-center gap-1 text-emerald-500 font-medium">
          <CheckCircle2 className="h-3 w-3" /> Répondu
        </span>
      ) : (
        <>
          <span className={`flex items-center gap-1 ${followupDone ? "text-blue-500" : "text-muted-foreground"}`}>
            <StepIcon done={followupDone} active={!followupDone && !closed} /> Relance J+1
          </span>
          {sep}
          <span className={`flex items-center gap-1 ${escalated ? "text-orange-500 font-medium" : "text-muted-foreground"}`}>
            <StepIcon done={escalated} active={followupDone && !escalated && !closed} /> Escalade J+2
          </span>
          {closed && !escalated && (
            <>
              {sep}
              <span className="text-muted-foreground">Fermé sans réponse</span>
            </>
          )}
        </>
      )}
    </div>
  );
}

// Nouveau bloc en haut de page : liste les prochains envois auto par
// client actif, avec countdown "dans X jours". Chaque ligne a un bouton
// "Forcer envoi" qui pré-remplit le dialog manuel avec ce client.
function ScheduledPulsesCard({
  list,
  totalScheduled,
  onForce,
}: {
  list: ScheduledPulse[] | null;
  totalScheduled: number;
  onForce: (clientCode: string) => void;
}) {
  if (list === null) {
    return (
      <Card className="p-4 space-y-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </Card>
    );
  }

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" /> Prochains envois programmés
          </h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Basé sur le cron pulse-send · fenêtre de dédup 30j (onboarding) / 20j (mensuel) ·
            monthly = dernier jour ouvrable America/Toronto
          </p>
        </div>
        <div className="text-xs text-muted-foreground">
          {totalScheduled} envoi{totalScheduled > 1 ? "s" : ""} planifié{totalScheduled > 1 ? "s" : ""}
        </div>
      </div>

      {list.length === 0 ? (
        <div className="text-sm text-muted-foreground py-4 text-center">
          Aucun envoi programmé pour l'instant.
        </div>
      ) : (
        <div className="space-y-1.5">
          {list.map((s, i) => {
            const canReach = s.channels.email || s.channels.sms;
            return (
              <div
                key={`${s.client_code}-${s.type}-${i}`}
                className="grid grid-cols-12 gap-2 items-center text-xs rounded-md border border-border/50 bg-background/40 px-3 py-2"
              >
                <div className="col-span-4 truncate">
                  <Link to={`/admin/clients/${s.client_code}`} className="font-medium hover:underline">
                    {s.display_name}
                  </Link>
                  <span className="text-muted-foreground ml-1">· {s.client_code}</span>
                </div>
                <div className="col-span-2">
                  <Badge variant="outline" className="text-[10px]">
                    {s.type === "onboarding" ? "Onboarding J+7" : "Mensuel"}
                  </Badge>
                </div>
                <div className="col-span-3">
                  <div className="font-medium">
                    {s.days_until === 0 ? "Aujourd'hui" : `Dans ${s.days_until}j`}
                  </div>
                  <div className="text-muted-foreground text-[10px]">
                    {s.next_send_at.toLocaleDateString("fr-CA")}
                  </div>
                </div>
                <div className="col-span-2 flex gap-1">
                  {s.channels.email && <Badge variant="outline" className="text-[10px]">email</Badge>}
                  {s.channels.sms && <Badge variant="outline" className="text-[10px]">SMS</Badge>}
                  {!canReach && (
                    <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-500 border-red-500/40">
                      aucun canal
                    </Badge>
                  )}
                </div>
                <div className="col-span-1 flex justify-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-[11px]"
                    disabled={!canReach}
                    onClick={() => onForce(s.client_code)}
                    title={canReach ? "Forcer l'envoi maintenant" : "Client sans email ni téléphone"}
                  >
                    <Send className="h-3 w-3 mr-1" /> Forcer
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
