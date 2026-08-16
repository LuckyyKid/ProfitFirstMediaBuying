import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, ExternalLink, Copy } from "lucide-react";
import { toast } from "sonner";

type PulseType = "onboarding" | "monthly" | "relational";

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
    score: number;
    verbatim: string | null;
    responded_at: string;
    source: string;
  } | null;
  client_display: string | null;
}

const TRAJECTORY_DROP = 2;

const typeLabel: Record<PulseType, string> = {
  onboarding: "Onboarding J+7",
  monthly: "Mensuel",
  relational: "NPS relationnel",
};

function scoreTone(score: number, previous: number | null): string {
  const dropped = previous != null && (previous - score) >= TRAJECTORY_DROP;
  if (dropped) return "bg-orange-500/15 text-orange-500 border-orange-500/40";
  if (score <= 6) return "bg-red-500/15 text-red-500 border-red-500/40";
  if (score <= 8) return "bg-yellow-500/15 text-yellow-500 border-yellow-500/40";
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
  const [err, setErr] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<"all" | PulseType>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "answered" | "pending" | "escalated">("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setErr(null);
      const { data: surveys, error } = await supabase
        .from("pulse_surveys")
        .select("id, client_code, type, sent_at, closed_at, escalated_at, followup_sent_at, previous_score, sent_channels, manual, created_by, slack_posted_at, clickup_commented_at")
        .order("sent_at", { ascending: false })
        .limit(200);
      if (cancelled) return;
      if (error) {
        setErr(error.message);
        setRows([]);
        return;
      }

      const ids = (surveys ?? []).map((s: any) => s.id);
      const codes = Array.from(new Set((surveys ?? []).map((s: any) => s.client_code)));

      const [respRes, clientRes] = await Promise.all([
        ids.length
          ? supabase.from("pulse_responses").select("survey_id, score, verbatim, responded_at, source").in("survey_id", ids)
          : Promise.resolve({ data: [], error: null }),
        codes.length
          ? supabase.from("client_progress").select("client_code, client_name, company_name").in("client_code", codes)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (cancelled) return;

      const respByS = new Map<string, Row["response"]>();
      for (const r of (respRes as any).data ?? []) {
        respByS.set(r.survey_id, {
          score: r.score, verbatim: r.verbatim, responded_at: r.responded_at, source: r.source,
        });
      }
      const displayByCode = new Map<string, string | null>();
      for (const c of (clientRes as any).data ?? []) {
        displayByCode.set(c.client_code, c.company_name || c.client_name || c.client_code);
      }

      setRows((surveys ?? []).map((s: any) => ({
        ...s,
        response: respByS.get(s.id) ?? null,
        client_display: displayByCode.get(s.client_code) ?? s.client_code,
      })));
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    if (!rows) return null;
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (typeFilter !== "all" && r.type !== typeFilter) return false;
      if (statusFilter === "answered" && !r.response) return false;
      if (statusFilter === "pending" && (r.response || r.closed_at)) return false;
      if (statusFilter === "escalated" && !r.escalated_at) return false;
      if (q) {
        const haystack = `${r.client_code} ${r.client_display ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [rows, typeFilter, statusFilter, search]);

  const stats = useMemo(() => {
    if (!filtered) return null;
    const answered = filtered.filter(r => r.response).length;
    const pending = filtered.filter(r => !r.response && !r.closed_at).length;
    const escalated = filtered.filter(r => r.escalated_at).length;
    const scores = filtered.map(r => r.response?.score).filter((s): s is number => s != null);
    const avg = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : "—";
    return { total: filtered.length, answered, pending, escalated, avg };
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
          <Link to="/pulse" target="_blank">
            <Button size="sm">
              <ExternalLink className="h-4 w-4 mr-1" /> Ouvrir /pulse
            </Button>
          </Link>
        </div>
      </div>

      <Card className="p-4 grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div><div className="text-xs text-muted-foreground">Total</div><div className="text-2xl font-bold">{stats?.total ?? "—"}</div></div>
        <div><div className="text-xs text-muted-foreground">Répondus</div><div className="text-2xl font-bold text-emerald-500">{stats?.answered ?? "—"}</div></div>
        <div><div className="text-xs text-muted-foreground">En attente</div><div className="text-2xl font-bold text-blue-500">{stats?.pending ?? "—"}</div></div>
        <div><div className="text-xs text-muted-foreground">Escaladés</div><div className="text-2xl font-bold text-orange-500">{stats?.escalated ?? "—"}</div></div>
        <div><div className="text-xs text-muted-foreground">Score moyen</div><div className="text-2xl font-bold">{stats?.avg ?? "—"}</div></div>
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
                <div className="text-xs text-muted-foreground">
                  Envoyé le {fmtDate(r.sent_at)} · Canaux : {channels}
                  {r.response && ` · Répondu le ${fmtDate(r.response.responded_at)} (${r.response.source})`}
                  {r.escalated_at && ` · Escaladé le ${fmtDate(r.escalated_at)}`}
                </div>
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
    </div>
  );
}
