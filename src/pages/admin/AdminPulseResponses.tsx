import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ArrowLeft, ExternalLink, Copy, Send, Search, ChevronRight, ChevronDown,
  ChevronLeft, AlertTriangle, Check,
} from "lucide-react";
import { toast } from "sonner";
import { SendManualPulseDialog } from "@/components/admin/SendManualPulseDialog";
import {
  computeAllScheduledEvents,
  EVENT_LABEL,
  type ClientLite,
  type MeetingLite,
  type OpenSurveyLite,
  type ScheduledPulseEvent,
  type PulseEventKind,
} from "@/lib/pulseSchedule";

type PulseType = "onboarding" | "monthly" | "relational" | "weekly";
type ChannelFilter = "all" | "email" | "sms" | "slack";
type TabKey = "scheduled" | "responses";

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

const PAGE_SIZE = 10;
const BUCKET_TZ = "America/Toronto";

const TYPE_LABEL: Record<PulseType, string> = {
  onboarding: "Onboarding J+7",
  monthly: "Mensuel",
  relational: "NPS relationnel",
  weekly: "Hebdo (meeting)",
};

// ─── Utilitaires visuels ──────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("fr-CA") + " · " + d.toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" });
}

function fmtDay(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" });
}

function fmtTime(d: Date): string {
  return d.toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" });
}

// Bucket un évènement dans "aujourd'hui" / "demain" / "plus tard"
// (par jour America/Toronto).
type Bucket = "today" | "tomorrow" | "later";
function dayKey(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUCKET_TZ,
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const y = parts.find(p => p.type === "year")?.value ?? "";
  const m = parts.find(p => p.type === "month")?.value ?? "";
  const d = parts.find(p => p.type === "day")?.value ?? "";
  return `${y}-${m}-${d}`;
}
function bucketOf(date: Date, now: Date): Bucket {
  const dk = dayKey(date);
  const today = dayKey(now);
  const tomorrow = dayKey(new Date(now.getTime() + 24 * 3600 * 1000));
  if (dk === today) return "today";
  if (dk === tomorrow) return "tomorrow";
  return "later";
}
const BUCKET_LABEL: Record<Bucket, string> = {
  today: "Aujourd'hui",
  tomorrow: "Demain",
  later: "Plus tard",
};

// Extrait le "family" (onboarding / monthly / weekly) d'un PulseEventKind.
function familyOf(kind: PulseEventKind): "onboarding" | "monthly" | "weekly" {
  if (kind.startsWith("onboarding")) return "onboarding";
  if (kind.startsWith("monthly")) return "monthly";
  return "weekly";
}

function relativeLabel(ev: ScheduledPulseEvent): string {
  if (ev.hours_until <= 0.5) return "maintenant";
  if (ev.hours_until < 24) return `dans ${Math.round(ev.hours_until)} h`;
  return `dans ${ev.days_until} j`;
}

// Initiale pour l'avatar client (2 lettres max, majuscules).
function initialsFor(name: string, code: string): string {
  const src = (name || code || "?").trim();
  const parts = src.split(/\s+/).slice(0, 2);
  return parts.map(p => p.charAt(0)).join("").toUpperCase() || "?";
}

// ─── Composant principal ─────────────────────────────────────────────────

export default function AdminPulseResponses() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [activeClients, setActiveClients] = useState<ClientLite[] | null>(null);
  const [openSurveys, setOpenSurveys] = useState<OpenSurveyLite[] | null>(null);
  const [upcomingMeetings, setUpcomingMeetings] = useState<MeetingLite[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [tab, setTab] = useState<TabKey>("scheduled");
  const [typeFilter, setTypeFilter] = useState<"all" | PulseType>("all");
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>("all");
  const [search, setSearch] = useState("");
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [expandedResponses, setExpandedResponses] = useState<Set<string>>(new Set());
  const [scheduledPage, setScheduledPage] = useState(1);
  const [responsesPage, setResponsesPage] = useState(1);

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
      const nowIso = new Date().toISOString();
      const [surveyRes, activeRes, openSurveyRes, meetingRes] = await Promise.all([
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
        supabase
          .from("pulse_surveys")
          .select("id, client_code, type, sent_at, followup_sent_at, escalated_at, closed_at, expires_at")
          .is("closed_at", null)
          .order("sent_at", { ascending: false })
          .limit(500),
        supabase
          .from("client_meetings")
          .select("id, client_code, scheduled_at, pulse_survey_id, initial_sent_at, last_followup_at, slack_reminded_at")
          .is("slack_reminded_at", null)
          .gte("scheduled_at", nowIso)
          .order("scheduled_at", { ascending: true })
          .limit(200),
      ]);

      if (cancelled) return;
      if (surveyRes.error) {
        setErr(surveyRes.error.message);
        setRows([]);
        setActiveClients([]);
        setOpenSurveys([]);
        setUpcomingMeetings([]);
        return;
      }
      const surveys = surveyRes.data ?? [];
      const activeList = (activeRes.data ?? []) as unknown as ClientLite[];
      setActiveClients(activeList);
      setOpenSurveys((openSurveyRes.data ?? []) as unknown as OpenSurveyLite[]);
      setUpcomingMeetings((meetingRes.data ?? []) as unknown as MeetingLite[]);

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

  // ─── Stats (basées sur tous les rows, pas les filtrés — vue globale) ──
  const stats = useMemo(() => {
    if (!rows) return null;
    const total = rows.length;
    const answered = rows.filter(r => r.response).length;
    const pending = rows.filter(r => !r.response && !r.closed_at).length;
    const escalated = rows.filter(r => r.escalated_at).length;
    const scores = rows.map(r => r.response?.score).filter((s): s is number => s != null);
    const avg = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1).replace(".", ",") : "—";
    const commScores = rows
      .filter(r => r.type === "onboarding")
      .map(r => r.response?.communication_score)
      .filter((s): s is number => s != null);
    const commAvg = commScores.length ? (commScores.reduce((a, b) => a + b, 0) / commScores.length).toFixed(1).replace(".", ",") : "—";
    const pctAnswered = total > 0 ? Math.round((answered / total) * 100) : 0;
    return { total, answered, pending, escalated, avg, commAvg, pctAnswered };
  }, [rows]);

  // ─── Événements programmés + filtres + groupement ─────────────────────
  const allScheduledEvents = useMemo<ScheduledPulseEvent[] | null>(() => {
    if (!activeClients || !rows || !openSurveys || !upcomingMeetings) return null;
    const pastPulses = rows
      .filter(r => r.type === "onboarding" || r.type === "monthly")
      .map(r => ({ client_code: r.client_code, type: r.type as "onboarding" | "monthly", sent_at: r.sent_at }));
    return computeAllScheduledEvents(activeClients, pastPulses, openSurveys, upcomingMeetings);
  }, [activeClients, rows, openSurveys, upcomingMeetings]);

  const filteredEvents = useMemo<ScheduledPulseEvent[] | null>(() => {
    if (!allScheduledEvents) return null;
    const q = search.trim().toLowerCase();
    return allScheduledEvents.filter((ev) => {
      if (typeFilter !== "all" && familyOf(ev.kind) !== typeFilter) return false;
      if (channelFilter === "email" && !ev.channels.email) return false;
      if (channelFilter === "sms" && !ev.channels.sms) return false;
      if (channelFilter === "slack") {
        const isSlackEvent = ev.kind === "weekly_slack_reminder" || ev.kind.endsWith("_escalation");
        if (!isSlackEvent) return false;
      }
      if (q) {
        const haystack = `${ev.client_code} ${ev.display_name}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [allScheduledEvents, typeFilter, channelFilter, search]);

  // Groupement à deux niveaux : bucket (today/tomorrow/later) → client → events.
  interface ClientGroup {
    client_code: string;
    display_name: string;
    events: ScheduledPulseEvent[];
    kindCounts: Partial<Record<PulseEventKind, number>>;
    nextEvent: ScheduledPulseEvent;
    channels: { email: boolean; sms: boolean; slack: boolean };
  }
  interface BucketGroup {
    bucket: Bucket;
    dayLabel: string | null;
    clients: ClientGroup[];
    totalEvents: number;
  }
  const bucketGroups = useMemo<BucketGroup[] | null>(() => {
    if (!filteredEvents) return null;
    const now = new Date();
    const byBucket = new Map<Bucket, Map<string, ClientGroup>>();
    for (const ev of filteredEvents) {
      const b = bucketOf(ev.next_send_at, now);
      let byClient = byBucket.get(b);
      if (!byClient) { byClient = new Map(); byBucket.set(b, byClient); }
      let g = byClient.get(ev.client_code);
      if (!g) {
        g = {
          client_code: ev.client_code,
          display_name: ev.display_name,
          events: [],
          kindCounts: {},
          nextEvent: ev,
          channels: { email: false, sms: false, slack: false },
        };
        byClient.set(ev.client_code, g);
      }
      g.events.push(ev);
      g.kindCounts[ev.kind] = (g.kindCounts[ev.kind] ?? 0) + 1;
      if (ev.next_send_at.getTime() < g.nextEvent.next_send_at.getTime()) g.nextEvent = ev;
      if (ev.channels.email) g.channels.email = true;
      if (ev.channels.sms) g.channels.sms = true;
      if (ev.kind === "weekly_slack_reminder" || ev.kind.endsWith("_escalation")) g.channels.slack = true;
    }
    const order: Bucket[] = ["today", "tomorrow", "later"];
    const out: BucketGroup[] = [];
    for (const b of order) {
      const byClient = byBucket.get(b);
      if (!byClient) continue;
      const clients = Array.from(byClient.values())
        .sort((a, b) => a.nextEvent.next_send_at.getTime() - b.nextEvent.next_send_at.getTime());
      let dayLabel: string | null = null;
      if (clients.length > 0) {
        const firstEv = clients[0].nextEvent;
        if (b === "today" || b === "tomorrow") dayLabel = fmtDay(firstEv.next_send_at.toISOString());
      }
      out.push({
        bucket: b,
        dayLabel,
        clients,
        totalEvents: clients.reduce((n, c) => n + c.events.length, 0),
      });
    }
    return out;
  }, [filteredEvents]);

  // Pagination scheduled : slice sur les client-groups aplatis (ordre bucket→next_send_at).
  interface PaginatedScheduled { paginatedBuckets: BucketGroup[]; totalClients: number; }
  const paginatedScheduled = useMemo<PaginatedScheduled | null>(() => {
    if (!bucketGroups) return null;
    const flatClients: { bucket: Bucket; dayLabel: string | null; group: ClientGroup }[] = [];
    for (const bg of bucketGroups) {
      for (const g of bg.clients) flatClients.push({ bucket: bg.bucket, dayLabel: bg.dayLabel, group: g });
    }
    const total = flatClients.length;
    const start = (scheduledPage - 1) * PAGE_SIZE;
    const slice = flatClients.slice(start, start + PAGE_SIZE);
    const map = new Map<Bucket, BucketGroup>();
    for (const item of slice) {
      let bg = map.get(item.bucket);
      if (!bg) {
        bg = { bucket: item.bucket, dayLabel: item.dayLabel, clients: [], totalEvents: 0 };
        map.set(item.bucket, bg);
      }
      bg.clients.push(item.group);
      bg.totalEvents += item.group.events.length;
    }
    const order: Bucket[] = ["today", "tomorrow", "later"];
    const paginatedBuckets = order.filter(b => map.has(b)).map(b => map.get(b)!);
    return { paginatedBuckets, totalClients: total };
  }, [bucketGroups, scheduledPage]);

  // ─── Réponses filtrées + paginées ─────────────────────────────────────
  const filteredRows = useMemo(() => {
    if (!rows) return null;
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (typeFilter !== "all" && r.type !== typeFilter) return false;
      if (q) {
        const haystack = `${r.client_code} ${r.client_display ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      // Le filtre canal ne s'applique pas aux réponses (c'était le canal d'envoi,
      // pas celui de la réponse) — on l'ignore volontairement.
      return true;
    });
  }, [rows, typeFilter, search]);

  const paginatedRows = useMemo(() => {
    if (!filteredRows) return null;
    const start = (responsesPage - 1) * PAGE_SIZE;
    return { slice: filteredRows.slice(start, start + PAGE_SIZE), total: filteredRows.length };
  }, [filteredRows, responsesPage]);

  const totalScheduledCount = allScheduledEvents?.length ?? 0;
  const totalResponsesCount = rows?.length ?? 0;

  // Reset pagination au changement de filtre / recherche.
  useEffect(() => { setScheduledPage(1); setResponsesPage(1); }, [typeFilter, channelFilter, search, tab]);

  const toggleClient = useCallback((code: string) => {
    setExpandedClients(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code); else next.add(code);
      return next;
    });
  }, []);
  const toggleResponse = useCallback((id: string) => {
    setExpandedResponses(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const copyPulseUrl = () => {
    const url = `${window.location.origin}/pulse`;
    navigator.clipboard.writeText(url).then(
      () => toast.success(`URL copiée : ${url}`),
      () => toast.error("Impossible de copier"),
    );
  };

  const manualTooltip =
    "Un envoi manuel déclenche le même workflow que le cron : relance email + SMS à J+1, escalade Slack #head-of-things à J+2 si pas de réponse.";

  return (
    <TooltipProvider delayDuration={200}>
      <div className="min-h-screen bg-background px-8 py-8 space-y-8">
        {/* ── HEADER ────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <Link to="/admin" className="text-xs text-muted-foreground hover:text-foreground transition">
              ← Admin
            </Link>
            <h1 className="text-2xl font-normal tracking-tight">
              Pulse — suivi <span className="font-bold">NPS</span>
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={copyPulseUrl} className="text-xs">
              <Copy className="h-3.5 w-3.5 mr-1.5" /> Copier URL /pulse
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={() => openManualDialog(null)} className="text-xs">
                  <Send className="h-3.5 w-3.5 mr-1.5" /> Envoi manuel
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs text-xs">
                {manualTooltip}
              </TooltipContent>
            </Tooltip>
            <Link to="/pulse" target="_blank">
              <Button size="sm" className="btn-primary-gradient text-xs">
                Ouvrir /pulse <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
              </Button>
            </Link>
          </div>
        </div>

        {/* ── STATS (rangée hairline, pas de cards) ────────────────── */}
        <StatsRow stats={stats} />

        {/* ── TABS + FILTRES sur une même ligne ─────────────────────── */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <TabPill
              active={tab === "scheduled"}
              label="Envois programmés"
              count={totalScheduledCount}
              onClick={() => setTab("scheduled")}
            />
            <TabPill
              active={tab === "responses"}
              label="Réponses"
              count={totalResponsesCount}
              onClick={() => setTab("responses")}
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="code client ou nom…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-8 pr-2 w-[240px] text-xs bg-transparent border-[rgba(148,170,215,0.12)]"
              />
            </div>
            <CompactSelect
              label="Type"
              value={typeFilter}
              onValueChange={(v) => setTypeFilter(v as any)}
              options={[
                { value: "all", label: "Tous" },
                { value: "onboarding", label: "Onboarding" },
                { value: "monthly", label: "Mensuel" },
                { value: "weekly", label: "Hebdo" },
                { value: "relational", label: "Relationnel" },
              ]}
            />
            {tab === "scheduled" && (
              <CompactSelect
                label="Canal"
                value={channelFilter}
                onValueChange={(v) => setChannelFilter(v as ChannelFilter)}
                options={[
                  { value: "all", label: "Tous" },
                  { value: "email", label: "Email" },
                  { value: "sms", label: "SMS" },
                  { value: "slack", label: "Slack" },
                ]}
              />
            )}
          </div>
        </div>

        {err && (
          <div className="card-alert p-4 text-xs text-[#ff9a9a]">Erreur : {err}</div>
        )}

        {/* ── VUE ACTIVE ────────────────────────────────────────────── */}
        {tab === "scheduled" ? (
          <ScheduledView
            data={paginatedScheduled}
            expandedClients={expandedClients}
            onToggleClient={toggleClient}
            onForce={openManualDialog}
            page={scheduledPage}
            onPageChange={setScheduledPage}
            filteredTotalClients={paginatedScheduled?.totalClients ?? 0}
            filteredTotalEvents={filteredEvents?.length ?? 0}
          />
        ) : (
          <ResponsesView
            data={paginatedRows}
            expanded={expandedResponses}
            onToggle={toggleResponse}
            page={responsesPage}
            onPageChange={setResponsesPage}
          />
        )}

        <SendManualPulseDialog
          open={manualDialogOpen}
          onOpenChange={setManualDialogOpen}
          defaultClientCode={manualDefaultCode}
          onSent={() => setReloadTick((t) => t + 1)}
        />
      </div>
    </TooltipProvider>
  );
}

// ─── Sous-composants ─────────────────────────────────────────────────────

function StatsRow({ stats }: { stats: ReturnType<typeof useMemo> | { total: number; answered: number; pending: number; escalated: number; avg: string; commAvg: string; pctAnswered: number } | null }) {
  if (!stats) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-6 gap-0 border-y border-[rgba(148,170,215,0.12)] py-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="px-5 md:border-l md:border-[rgba(148,170,215,0.12)] first:border-l-0">
            <Skeleton className="h-2 w-16" />
            <Skeleton className="h-6 w-14 mt-3" />
          </div>
        ))}
      </div>
    );
  }
  const s = stats as { total: number; answered: number; pending: number; escalated: number; avg: string; commAvg: string; pctAnswered: number };
  const cells = [
    { label: "Total", value: String(s.total), tone: "text-foreground" },
    { label: "Répondus", value: String(s.answered), tone: "text-[#3ddc97]", extra: `${s.pctAnswered} %` },
    { label: "En attente", value: String(s.pending), tone: "text-[#4d9fff]" },
    { label: "Escaladés", value: String(s.escalated), tone: "text-[#f5b74e]" },
    { label: "Score moyen", value: s.avg, tone: "text-foreground" },
    { label: "Com. moy. (onb.)", value: s.commAvg, tone: "text-foreground" },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-6 gap-0 border-y border-[rgba(148,170,215,0.12)] py-5">
      {cells.map((c, i) => (
        <div key={c.label} className={`px-5 ${i > 0 ? "md:border-l md:border-[rgba(148,170,215,0.12)]" : ""}`}>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{c.label}</div>
          <div className={`font-mono mt-2.5 text-[22px] leading-none ${c.tone}`}>
            {c.value}
            {c.extra && (
              <span className="ml-2 text-[11px] text-muted-foreground font-mono">{c.extra}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function TabPill({ active, label, count, onClick }: { active: boolean; label: string; count: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={
        active
          ? "active-blue px-4 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 transition"
          : "px-4 py-1.5 rounded-full text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition"
      }
    >
      <span>{label}</span>
      <span className="font-mono text-[11px] opacity-80">{count}</span>
    </button>
  );
}

function CompactSelect({
  label, value, onValueChange, options,
}: {
  label: string;
  value: string;
  onValueChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  const current = options.find(o => o.value === value)?.label ?? "Tous";
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="h-8 w-auto min-w-[130px] bg-transparent border-[rgba(148,170,215,0.12)] text-xs px-3 gap-1.5">
        <span className="text-muted-foreground">{label} ·</span>
        <SelectValue placeholder={current} />
      </SelectTrigger>
      <SelectContent>
        {options.map(o => (
          <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ─── Vue "Envois programmés" ─────────────────────────────────────────────
type PaginatedScheduledData = {
  paginatedBuckets: {
    bucket: Bucket;
    dayLabel: string | null;
    clients: {
      client_code: string;
      display_name: string;
      events: ScheduledPulseEvent[];
      kindCounts: Partial<Record<PulseEventKind, number>>;
      nextEvent: ScheduledPulseEvent;
      channels: { email: boolean; sms: boolean; slack: boolean };
    }[];
    totalEvents: number;
  }[];
  totalClients: number;
} | null;

function ScheduledView({
  data, expandedClients, onToggleClient, onForce, page, onPageChange, filteredTotalClients, filteredTotalEvents,
}: {
  data: PaginatedScheduledData;
  expandedClients: Set<string>;
  onToggleClient: (code: string) => void;
  onForce: (code: string) => void;
  page: number;
  onPageChange: (p: number) => void;
  filteredTotalClients: number;
  filteredTotalEvents: number;
}) {
  if (data === null) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  if (data.paginatedBuckets.length === 0) {
    return (
      <div className="card-premium p-12 text-center text-sm text-muted-foreground">
        Aucun envoi programmé — rien dans la file du cron.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {data.paginatedBuckets.map((bg, bgIdx) => {
        const isFirstBucket = bgIdx === 0 && page === 1 && bg.bucket === "today";
        return (
          <section key={bg.bucket} className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                {BUCKET_LABEL[bg.bucket]}
                {bg.dayLabel && <span className="text-[#5f6b82]"> — {bg.dayLabel}</span>}
              </div>
              <div className="hairline-gradient flex-1" />
              <div className="text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                {bg.totalEvents} {bg.totalEvents > 1 ? "envois" : "envoi"} · {bg.clients.length} {bg.clients.length > 1 ? "clients" : "client"}
              </div>
            </div>

            <div className="space-y-3">
              {bg.clients.map((cg) => (
                <ClientEventCard
                  key={`${bg.bucket}-${cg.client_code}`}
                  cg={cg}
                  isExpanded={expandedClients.has(cg.client_code)}
                  onToggle={() => onToggleClient(cg.client_code)}
                  onForce={() => onForce(cg.client_code)}
                  highlight={isFirstBucket && cg === bg.clients[0]}
                />
              ))}
            </div>
          </section>
        );
      })}

      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        totalItems={filteredTotalClients}
        totalLabel={`${filteredTotalEvents} envoi${filteredTotalEvents > 1 ? "s" : ""}`}
        onPageChange={onPageChange}
      />
    </div>
  );
}

function ClientEventCard({
  cg, isExpanded, onToggle, onForce, highlight,
}: {
  cg: {
    client_code: string;
    display_name: string;
    events: ScheduledPulseEvent[];
    kindCounts: Partial<Record<PulseEventKind, number>>;
    nextEvent: ScheduledPulseEvent;
    channels: { email: boolean; sms: boolean; slack: boolean };
  };
  isExpanded: boolean;
  onToggle: () => void;
  onForce: () => void;
  highlight: boolean;
}) {
  const single = cg.events.length === 1;
  const initial = initialsFor(cg.display_name, cg.client_code);
  const wrapperCls = highlight
    ? "card-premium relative overflow-hidden ring-1 ring-[rgba(77,159,255,0.25)] shadow-[0_0_30px_rgba(47,107,255,0.10)]"
    : "card-premium relative overflow-hidden";

  // Ligne compacte pour client à envoi unique
  if (single) {
    const ev = cg.events[0];
    const isSlack = ev.kind === "weekly_slack_reminder";
    const isEscalation = ev.kind.endsWith("_escalation");
    return (
      <div className={wrapperCls}>
        <div className="grid grid-cols-12 items-center px-4 py-3 gap-3 text-xs">
          <div className="col-span-3 flex items-center gap-3">
            <Avatar letter={initial} />
            <div className="min-w-0">
              <Link to={`/admin/pulse/${cg.client_code}`} className="font-medium text-foreground hover:text-[#9ec8ff] transition">
                {cg.display_name}
              </Link>
              <span className="ml-1.5 text-[10px] text-[#5f6b82] font-mono">{cg.client_code}</span>
            </div>
          </div>
          <div className="col-span-4 text-muted-foreground truncate">{EVENT_LABEL[ev.kind]}</div>
          <div className="col-span-2 flex gap-1">
            {isSlack || isEscalation ? <Chip>SLACK</Chip> : null}
            {!isSlack && cg.channels.email && <Chip>EMAIL</Chip>}
            {!isSlack && cg.channels.sms && <Chip>SMS</Chip>}
          </div>
          <div className="col-span-2 text-right font-mono text-[11px] text-muted-foreground">
            {ev.next_send_at.toLocaleDateString("fr-CA")} · {fmtTime(ev.next_send_at)} · {relativeLabel(ev)}
          </div>
          <div className="col-span-1 flex justify-end">
            <ForceButton
              disabled={isSlack || isEscalation || (!cg.channels.email && !cg.channels.sms)}
              onClick={onForce}
              title={isSlack ? "Ping Slack automatique — non forçable" : isEscalation ? "Escalade Slack automatique — non forçable" : "Forcer l'envoi maintenant"}
            />
          </div>
        </div>
      </div>
    );
  }

  const nextEv = cg.nextEvent;
  const summary = `${cg.events.length} envois · prochain ${relativeLabel(nextEv)}`;
  const preview = cg.events.slice(0, 3);
  const hidden = cg.events.length - preview.length;
  const visible = isExpanded ? cg.events : preview;

  return (
    <div className={wrapperCls}>
      <button
        onClick={onToggle}
        className="w-full grid grid-cols-12 items-center px-4 py-3.5 gap-3 text-left hover:bg-white/[0.015] transition"
      >
        <div className="col-span-1 flex items-center gap-2">
          {isExpanded
            ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
          <Avatar letter={initialsFor(cg.display_name, cg.client_code)} />
        </div>
        <div className="col-span-4 min-w-0">
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="font-medium text-sm truncate">{cg.display_name}</span>
            <span className="text-[10px] text-[#5f6b82] font-mono truncate">{cg.client_code}</span>
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">{summary}</div>
        </div>
        <div className="col-span-7 flex flex-wrap gap-1.5 justify-end">
          {Object.entries(cg.kindCounts).map(([k, n]) => (
            <KindCountBadge key={k} kind={k as PulseEventKind} count={n as number} />
          ))}
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-[rgba(148,170,215,0.10)]">
          <div className="divide-y divide-[rgba(148,170,215,0.08)]">
            {visible.map((ev) => (
              <ExpandedEventRow
                key={ev.key}
                ev={ev}
                onForce={onForce}
                clientChannels={cg.channels}
              />
            ))}
          </div>
        </div>
      )}

      {!isExpanded && hidden > 0 && (
        <button
          onClick={onToggle}
          className="w-full text-left px-4 py-2 text-[11px] text-[#9ec8ff] hover:bg-white/[0.02] border-t border-[rgba(148,170,215,0.10)] transition"
        >
          <ChevronRight className="h-3 w-3 inline mr-1.5 -mt-0.5" />
          Afficher les {hidden} autres envois…
        </button>
      )}
    </div>
  );
}

function ExpandedEventRow({
  ev, onForce, clientChannels,
}: {
  ev: ScheduledPulseEvent;
  onForce: () => void;
  clientChannels: { email: boolean; sms: boolean; slack: boolean };
}) {
  const isSlack = ev.kind === "weekly_slack_reminder";
  const isEscalation = ev.kind.endsWith("_escalation");
  const noChannel = ev.status === "no_channel";
  const canForce = !isSlack && !isEscalation && (ev.channels.email || ev.channels.sms);
  return (
    <div className="grid grid-cols-12 items-center px-4 py-2.5 gap-3 text-xs">
      <div className="col-span-2 font-mono text-muted-foreground">
        <div>{fmtTime(ev.next_send_at)}</div>
        <div className="text-[10px] text-[#5f6b82] mt-0.5">{relativeLabel(ev)}</div>
      </div>
      <div className="col-span-5 text-foreground/90 truncate">
        {EVENT_LABEL[ev.kind]}
        {ev.reason && !isEscalation && (
          <span className="text-[10px] text-[#5f6b82] ml-2 font-mono">{ev.reason}</span>
        )}
      </div>
      <div className="col-span-3 flex gap-1 justify-start flex-wrap">
        {isSlack || isEscalation ? <Chip>SLACK</Chip> : (
          <>
            {ev.channels.email && <Chip>EMAIL</Chip>}
            {ev.channels.sms && <Chip>SMS</Chip>}
            {isEscalation && <Chip>SLACK</Chip>}
            {noChannel && <Chip tone="bad">AUCUN CANAL</Chip>}
          </>
        )}
      </div>
      <div className="col-span-2 flex justify-end">
        <ForceButton
          disabled={!canForce}
          onClick={onForce}
          title={
            isSlack ? "Ping Slack automatique — non forçable"
            : isEscalation ? "Escalade Slack automatique — non forçable"
            : canForce ? "Forcer l'envoi maintenant"
            : "Client sans email ni téléphone"
          }
        />
      </div>
    </div>
  );
}

function KindCountBadge({ kind, count }: { kind: PulseEventKind; count: number }) {
  const isEscalation = kind.endsWith("_escalation");
  const isSlack = kind === "weekly_slack_reminder";
  const isFollowup = kind.endsWith("_followup");
  let short: string;
  if (kind === "onboarding_initial") short = "INITIAL ONB.";
  else if (kind === "monthly_initial") short = "INITIAL MENSUEL";
  else if (kind === "weekly_initial") short = "HEBDO T-48H";
  else if (kind === "onboarding_followup") short = "ONB. RELANCE J+1";
  else if (kind === "monthly_followup") short = "RELANCE J+1";
  else if (kind === "weekly_followup") short = "HEBDO +24H";
  else if (kind === "onboarding_escalation") short = "ONB. ESCALADE J+2";
  else if (kind === "monthly_escalation") short = "ESCALADE SLACK J+2";
  else if (kind === "weekly_slack_reminder") short = "SLACK J-0";
  else short = kind;

  const tone = isEscalation || isSlack
    ? "text-[#f5b74e] border-[rgba(245,183,78,0.35)] bg-[rgba(245,183,78,0.06)]"
    : isFollowup
    ? "text-[#9ec8ff] border-[rgba(77,159,255,0.35)] bg-[rgba(77,159,255,0.06)]"
    : "text-muted-foreground border-[rgba(148,170,215,0.18)] bg-transparent";

  return (
    <span className={`font-mono text-[9.5px] tracking-[0.14em] uppercase border rounded px-2 py-1 ${tone}`}>
      {short} <span className="opacity-70">×{count}</span>
    </span>
  );
}

function Chip({ children, tone }: { children: React.ReactNode; tone?: "bad" }) {
  const toneCls = tone === "bad"
    ? "text-[#ff6b6b] border-[rgba(255,107,107,0.35)] bg-[rgba(255,107,107,0.06)]"
    : "text-muted-foreground border-[rgba(148,170,215,0.20)]";
  return (
    <span className={`font-mono text-[9.5px] tracking-[0.14em] uppercase border rounded px-1.5 py-0.5 ${toneCls}`}>
      {children}
    </span>
  );
}

function Avatar({ letter }: { letter: string }) {
  return (
    <div className="h-7 w-7 rounded-md flex items-center justify-center text-[11px] font-medium text-[#9ec8ff] bg-[rgba(77,159,255,0.10)] border border-[rgba(77,159,255,0.25)]">
      {letter}
    </div>
  );
}

function ForceButton({ disabled, onClick, title }: { disabled: boolean; onClick: () => void; title: string }) {
  return (
    <button
      disabled={disabled}
      onClick={(e) => { e.stopPropagation(); if (!disabled) onClick(); }}
      title={title}
      className={
        disabled
          ? "font-mono text-[10.5px] tracking-[0.14em] uppercase text-[#5f6b82] cursor-not-allowed"
          : "font-mono text-[10.5px] tracking-[0.14em] uppercase text-[#9ec8ff] hover:text-[#4d9fff] transition"
      }
    >
      Forcer →
    </button>
  );
}

// ─── Vue "Réponses" ──────────────────────────────────────────────────────
function ResponsesView({
  data, expanded, onToggle, page, onPageChange,
}: {
  data: { slice: Row[]; total: number } | null;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  page: number;
  onPageChange: (p: number) => void;
}) {
  if (data === null) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }
  if (data.total === 0) {
    return (
      <div className="card-premium p-12 text-center text-sm text-muted-foreground">
        Aucune réponse ne correspond à ces filtres.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="card-premium overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[1100px] w-full">
            <thead>
              <tr className="border-b border-[rgba(148,170,215,0.12)]">
                <ColHead>Client</ColHead>
                <ColHead>Type</ColHead>
                <ColHead>Statut</ColHead>
                <ColHead>Progression du workflow</ColHead>
                <ColHead>Score</ColHead>
                <ColHead className="text-right pr-5">Envoyé</ColHead>
              </tr>
            </thead>
            <tbody>
              {data.slice.map((r) => (
                <ResponseRow
                  key={r.id}
                  r={r}
                  expanded={expanded.has(r.id)}
                  onToggle={() => onToggle(r.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        totalItems={data.total}
        totalLabel={`${data.total} réponse${data.total > 1 ? "s" : ""}`}
        onPageChange={onPageChange}
      />
    </div>
  );
}

function ColHead({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`text-xs uppercase tracking-wider text-muted-foreground text-left px-4 py-3 font-normal ${className ?? ""}`}>{children}</th>
  );
}

function ResponseRow({ r, expanded, onToggle }: { r: Row; expanded: boolean; onToggle: () => void }) {
  const escalated = !!r.escalated_at;
  const bgAccent = escalated
    ? "bg-[linear-gradient(90deg,rgba(245,183,78,0.05),transparent_60%)]"
    : "";

  const status = r.response
    ? { dot: "good" as const, label: "Répondu" }
    : escalated
    ? { dot: "watch" as const, label: "Escaladé" }
    : r.closed_at
    ? { dot: "info" as const, label: "Fermé" }
    : { dot: "info" as const, label: "En attente" };

  const scoreChip = r.response?.score != null ? <ScoreChip value={r.response.score} previous={r.previous_score} /> : null;
  const commChip = r.response?.communication_score != null ? <ScoreChip value={r.response.communication_score} previous={null} label="COM" /> : null;
  const paceChip = r.response?.weekly_pace_score != null ? <PaceChip value={r.response.weekly_pace_score} /> : null;

  const verbatim = r.response?.verbatim ?? "";
  const truncated = verbatim.length > 60 ? verbatim.slice(0, 60).trim() + "…" : verbatim;
  const hasVerbatim = verbatim.length > 0;

  return (
    <>
      <tr className={`border-b border-[rgba(148,170,215,0.08)] ${bgAccent} hover:bg-white/[0.015] transition`}>
        <td className="px-4 py-3">
          <Link to={`/admin/pulse/${r.client_code}`} className="font-medium text-sm hover:text-[#9ec8ff] transition">
            {r.client_display}
          </Link>
          <div className="text-[10px] text-[#5f6b82] font-mono mt-0.5">{r.client_code}</div>
        </td>
        <td className="px-4 py-3 text-xs text-muted-foreground">{TYPE_LABEL[r.type]}</td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <span className={`status-dot ${status.dot}`}></span>
            <span className="font-mono text-[10px] tracking-[0.14em] uppercase text-foreground/80">{status.label}</span>
          </div>
        </td>
        <td className="px-4 py-3">
          <WorkflowTimeline r={r} />
        </td>
        <td className="px-4 py-3">
          {r.response ? (
            <div className="flex gap-1.5 flex-wrap">
              {scoreChip}
              {commChip}
              {paceChip}
            </div>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          )}
        </td>
        <td className="px-4 py-3 text-right font-mono text-[11px] text-muted-foreground pr-5">
          {fmtDate(r.sent_at)}
        </td>
      </tr>
      {hasVerbatim && (
        <tr className={`border-b border-[rgba(148,170,215,0.08)] ${bgAccent}`}>
          <td colSpan={6} className="px-4 pb-3">
            <button
              onClick={onToggle}
              className="text-[11px] italic text-muted-foreground hover:text-foreground/90 transition text-left"
            >
              «&nbsp;{expanded ? verbatim : truncated}&nbsp;»
              {verbatim.length > 60 && (
                <span className="ml-1 not-italic text-[10px] text-[#9ec8ff]">
                  {expanded ? "◂ replier" : "▸"}
                </span>
              )}
            </button>
          </td>
        </tr>
      )}
    </>
  );
}

function WorkflowTimeline({ r }: { r: Row }) {
  const responded = !!r.response;
  const followupDone = !!r.followup_sent_at;
  const escalated = !!r.escalated_at;
  const closed = !!r.closed_at && !responded;

  const step = (label: string, state: "done" | "done-good" | "pending" | "future" | "warn") => {
    const iconCls = state === "done" || state === "done-good"
      ? "text-[#3ddc97]"
      : state === "warn"
      ? "text-[#f5b74e]"
      : state === "pending"
      ? "text-[#4d9fff]"
      : "text-[#5f6b82]";
    const textCls = state === "done" || state === "done-good"
      ? "text-foreground/90"
      : state === "warn"
      ? "text-[#f5b74e]"
      : state === "pending"
      ? "text-[#9ec8ff]"
      : "text-[#5f6b82]";
    const icon = state === "warn"
      ? <AlertTriangle className={`h-3 w-3 ${iconCls}`} />
      : state === "done" || state === "done-good"
      ? <Check className={`h-3 w-3 ${iconCls}`} />
      : <div className={`h-2 w-2 rounded-full border ${state === "pending" ? "border-[#4d9fff]" : "border-[#5f6b82]"}`} />;
    return (
      <span className={`inline-flex items-center gap-1 font-mono text-[10px] tracking-[0.06em] ${textCls}`}>
        {icon} {label}
      </span>
    );
  };
  const sep = <span className="text-[#5f6b82] text-[10px] mx-1">→</span>;

  return (
    <div className="flex items-center flex-wrap gap-y-1">
      {step("J+0", "done-good")}
      {sep}
      {responded
        ? step("répondu", "done-good")
        : followupDone
        ? step("J+1", "done")
        : step("J+1", closed ? "future" : "pending")}
      {!responded && sep}
      {!responded && (
        escalated
          ? step("Slack #head-of-things", "warn")
          : step("J+2 escalade", followupDone && !closed ? "pending" : "future")
      )}
    </div>
  );
}

function ScoreChip({ value, previous, label }: { value: number; previous: number | null; label?: string }) {
  const dropped = previous != null && (previous - value) >= 2;
  const tone = dropped
    ? "text-[#f5b74e] border-[rgba(245,183,78,0.35)] bg-[rgba(245,183,78,0.06)]"
    : value <= 6
    ? "text-[#ff6b6b] border-[rgba(255,107,107,0.35)] bg-[rgba(255,107,107,0.06)]"
    : value <= 8
    ? "text-[#f5b74e] border-[rgba(245,183,78,0.35)] bg-[rgba(245,183,78,0.06)]"
    : "text-[#3ddc97] border-[rgba(61,220,151,0.35)] bg-[rgba(61,220,151,0.06)]";
  return (
    <span className={`font-mono text-[10px] tracking-[0.10em] border rounded px-1.5 py-0.5 ${tone}`}>
      {label ? `${label} ` : ""}{value}{label ? "" : "/10"}
    </span>
  );
}

function PaceChip({ value }: { value: number }) {
  const tone = value <= 2
    ? "text-[#ff6b6b] border-[rgba(255,107,107,0.35)] bg-[rgba(255,107,107,0.06)]"
    : value === 3
    ? "text-[#f5b74e] border-[rgba(245,183,78,0.35)] bg-[rgba(245,183,78,0.06)]"
    : "text-[#3ddc97] border-[rgba(61,220,151,0.35)] bg-[rgba(61,220,151,0.06)]";
  return (
    <span className={`font-mono text-[10px] tracking-[0.10em] border rounded px-1.5 py-0.5 ${tone}`}>
      PACE {value}/5
    </span>
  );
}

// ─── Pagination ─────────────────────────────────────────────────────────
function Pagination({
  page, pageSize, totalItems, totalLabel, onPageChange,
}: {
  page: number;
  pageSize: number;
  totalItems: number;
  totalLabel: string;
  onPageChange: (p: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(totalItems / pageSize));
  if (totalItems === 0) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);
  const canPrev = page > 1;
  const canNext = page < pages;

  return (
    <div className="flex items-center justify-between pt-2">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">
        {start}–{end} sur {totalItems}
        <span className="text-[#5f6b82] normal-case tracking-normal ml-2">· {totalLabel}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          disabled={!canPrev}
          onClick={() => onPageChange(page - 1)}
          className={`h-7 w-7 rounded-md flex items-center justify-center transition ${canPrev ? "text-muted-foreground hover:text-foreground hover:bg-white/[0.03]" : "text-[#5f6b82] cursor-not-allowed"}`}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        {Array.from({ length: pages }).map((_, i) => {
          const p = i + 1;
          const active = p === page;
          return (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={
                active
                  ? "active-blue h-7 w-7 rounded-md flex items-center justify-center text-xs font-mono"
                  : "h-7 w-7 rounded-md flex items-center justify-center text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-white/[0.03] transition"
              }
            >
              {p}
            </button>
          );
        })}
        <button
          disabled={!canNext}
          onClick={() => onPageChange(page + 1)}
          className={`h-7 w-7 rounded-md flex items-center justify-center transition ${canNext ? "text-muted-foreground hover:text-foreground hover:bg-white/[0.03]" : "text-[#5f6b82] cursor-not-allowed"}`}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
