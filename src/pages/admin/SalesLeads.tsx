import { useMemo, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  BellRing,
  LogOut,
  Mail,
  MessageSquare,
  Plus,
  RefreshCcw,
  Search,
  Users,
} from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { useSalesLeads, type BusinessType, type LeadStatus, type SalesLead } from "@/hooks/useSalesLeads";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { LeadDialog } from "@/components/admin/sales/LeadDialog";
import { SalesRepsDialog } from "@/components/admin/sales/SalesRepsDialog";

type PeriodKey = "today" | "week" | "month" | "quarter" | "year" | "all";

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "today", label: "Aujourd'hui" },
  { key: "week", label: "Cette semaine" },
  { key: "month", label: "Ce mois" },
  { key: "quarter", label: "Ce trimestre" },
  { key: "year", label: "Cette année" },
  { key: "all", label: "Tout" },
];

const BUSINESS_TYPE_LABEL: Record<BusinessType, string> = {
  saas: "SaaS",
  ecom: "E-commerce",
  service: "Service",
  other: "Autre",
};

const BUSINESS_TYPES: { key: BusinessType | "all"; label: string }[] = [
  { key: "all", label: "Tous types" },
  { key: "saas", label: "SaaS" },
  { key: "ecom", label: "E-commerce" },
  { key: "service", label: "Service" },
  { key: "other", label: "Autre" },
];

const STATUSES: { key: LeadStatus | "all"; label: string }[] = [
  { key: "all", label: "Tous statuts" },
  { key: "new", label: "Nouveau" },
  { key: "contacted", label: "Contacté" },
  { key: "qualified", label: "Qualifié" },
  { key: "proposal", label: "Proposition" },
  { key: "won", label: "Gagné" },
  { key: "lost", label: "Perdu" },
];

const STATUS_LABEL: Record<LeadStatus, string> = {
  new: "Nouveau",
  contacted: "Contacté",
  qualified: "Qualifié",
  proposal: "Proposition",
  won: "Gagné",
  lost: "Perdu",
};

const STATUS_CLASS: Record<LeadStatus, string> = {
  new: "border-[rgba(148,170,215,0.4)] bg-[rgba(148,170,215,0.08)] text-[#c8d5f2]",
  contacted: "border-[rgba(77,159,255,0.4)] bg-[rgba(77,159,255,0.08)] text-[#9ec8ff]",
  qualified: "border-[rgba(200,120,255,0.4)] bg-[rgba(200,120,255,0.08)] text-[#e0b3ff]",
  proposal: "border-[rgba(255,184,77,0.4)] bg-[rgba(255,184,77,0.08)] text-[hsl(var(--watch))]",
  won: "border-[rgba(122,232,180,0.4)] bg-[rgba(122,232,180,0.08)] text-[hsl(var(--good))]",
  lost: "border-[rgba(255,110,110,0.4)] bg-[rgba(255,110,110,0.08)] text-[hsl(var(--bad))]",
};

function periodStart(key: PeriodKey): Date | null {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (key) {
    case "today":
      return d;
    case "week": {
      const day = d.getDay(); // 0 = Sun
      const diff = day === 0 ? 6 : day - 1;
      d.setDate(d.getDate() - diff);
      return d;
    }
    case "month":
      return new Date(now.getFullYear(), now.getMonth(), 1);
    case "quarter": {
      const q = Math.floor(now.getMonth() / 3);
      return new Date(now.getFullYear(), q * 3, 1);
    }
    case "year":
      return new Date(now.getFullYear(), 0, 1);
    case "all":
    default:
      return null;
  }
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("fr-CA", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function isOverdue(iso: string | null, status: LeadStatus): boolean {
  if (!iso) return false;
  if (status === "won" || status === "lost") return false;
  return new Date(iso).getTime() < Date.now();
}

const SalesLeads = () => {
  const { isAuthed, ready, logout } = useAdminAuth();
  const { leads, reps, loading, reload } = useSalesLeads();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<BusinessType | "all">("all");
  const [ownerFilter, setOwnerFilter] = useState<string>("all");
  const [period, setPeriod] = useState<PeriodKey>("month");
  const [editing, setEditing] = useState<SalesLead | null>(null);
  const [creating, setCreating] = useState(false);
  const [repsOpen, setRepsOpen] = useState(false);
  const [followingUp, setFollowingUp] = useState<string | null>(null);
  // `followingUp` = `${lead_code}:${channel}` pendant l'envoi.

  const sources = useMemo(() => {
    const set = new Set<string>();
    leads.forEach((l) => l.source && set.add(l.source));
    return Array.from(set).sort();
  }, [leads]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const start = periodStart(period);
    return leads.filter((l) => {
      if (start && new Date(l.created_at) < start) return false;
      if (statusFilter !== "all" && l.status !== statusFilter) return false;
      if (sourceFilter !== "all" && l.source !== sourceFilter) return false;
      if (typeFilter !== "all" && l.business_type !== typeFilter) return false;
      if (ownerFilter !== "all") {
        if (ownerFilter === "unassigned" ? !!l.owner_id : l.owner_id !== ownerFilter)
          return false;
      }
      if (!q) return true;
      const hay = [
        l.lead_code,
        l.first_name,
        l.last_name,
        l.company,
        l.email,
        l.phone,
        l.industry,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [leads, search, statusFilter, sourceFilter, typeFilter, ownerFilter, period]);

  const kpis = useMemo(() => {
    const total = filtered.length;
    const qualified = filtered.filter(
      (l) => l.status === "qualified" || l.status === "proposal" || l.status === "won"
    ).length;
    const won = filtered.filter((l) => l.status === "won").length;
    const closeRate = total > 0 ? Math.round((won / total) * 100) : 0;
    const dueToday = leads.filter((l) => isOverdue(l.next_followup_at, l.status)).length;
    return { total, qualified, won, closeRate, dueToday };
  }, [filtered, leads]);

  const repById = useMemo(() => {
    const m = new Map<string, string>();
    reps.forEach((r) => m.set(r.id, r.name));
    return m;
  }, [reps]);

  const onFollowUpNow = async (lead: SalesLead, channel: "email" | "sms") => {
    if (channel === "email" && !lead.email) {
      toast.error("Ce lead n'a pas d'email");
      return;
    }
    if (channel === "sms" && !lead.phone) {
      toast.error("Ce lead n'a pas de téléphone");
      return;
    }
    setFollowingUp(`${lead.lead_code}:${channel}`);
    const t = toast.loading(channel === "email" ? "Envoi de l'email…" : "Envoi du SMS…");
    const { data, error } = await supabase.functions.invoke("follow-up-leads", {
      body: { lead_code: lead.lead_code, manual: true, channel },
    });
    setFollowingUp(null);
    toast.dismiss(t);
    if (error) {
      toast.error(error.message || "Échec de l'envoi");
      return;
    }
    const r = data as {
      emailSent?: boolean;
      smsSent?: boolean;
      smsSkipped?: boolean;
      error?: string;
    };
    if (channel === "email") {
      if (r?.emailSent) toast.success(`Email envoyé à ${lead.email}`);
      else toast.error(r?.error || "Échec de l'envoi de l'email");
    } else {
      if (r?.smsSent) toast.success(`SMS envoyé au ${lead.phone}`);
      else if (r?.smsSkipped) toast.error("SMS non envoyé (Twilio non configuré)");
      else toast.error(r?.error || "Échec de l'envoi du SMS");
    }
    reload();
  };

  if (!ready) return <div className="min-h-screen" />;
  if (!isAuthed) return <Navigate to="/admin/login" replace />;

  return (
    <div className="premium-shell min-h-screen px-3 sm:px-4 md:px-8 py-6 sm:py-8">
      <div className="w-full mx-auto space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <Button asChild size="sm" variant="ghost" className="h-8 px-2">
                <Link to="/admin">
                  <ArrowLeft className="h-4 w-4 mr-1" /> Dashboard
                </Link>
              </Button>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-2">
              Sales Pipeline
            </h1>
            <p className="text-sm text-muted-foreground">
              TDIA — leads, qualification, closing
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setRepsOpen(true)}>
              <Users className="h-4 w-4 mr-2" /> Vendeurs
            </Button>
            <Button size="sm" variant="hero" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4 mr-2" /> Nouveau lead
            </Button>
            <Button variant="outline" size="sm" onClick={reload} disabled={loading}>
              <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Rafraîchir
            </Button>
            <Button variant="ghost" size="sm" onClick={logout}>
              <LogOut className="h-4 w-4 mr-2" /> Logout
            </Button>
          </div>
        </header>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard label="Leads (période)" value={kpis.total} />
          <StatCard label="Qualifiés" value={kpis.qualified} tone="amber" />
          <StatCard label="Gagnés" value={kpis.won} tone="green" />
          <StatCard label="Taux de close" value={`${kpis.closeRate}%`} tone="green" />
          <StatCard
            label="Relances dues"
            value={kpis.dueToday}
            tone="red"
            onClick={() => {
              setStatusFilter("all");
              setPeriod("all");
              setSearch("");
            }}
          />
        </div>

        <Card className="p-4 space-y-4 glass-card">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher (code, nom, entreprise, email, tel)…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={period} onValueChange={(v) => setPeriod(v as PeriodKey)}>
              <SelectTrigger className="w-full sm:w-[170px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIODS.map((p) => (
                  <SelectItem key={p.key} value={p.key}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as LeadStatus | "all")}
            >
              <SelectTrigger className="w-full sm:w-[170px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s.key} value={s.key}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as BusinessType | "all")}>
              <SelectTrigger className="w-full sm:w-[170px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                {BUSINESS_TYPES.map((t) => (
                  <SelectItem key={t.key} value={t.key}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-full sm:w-[170px]">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes sources</SelectItem>
                {sources.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={ownerFilter} onValueChange={setOwnerFilter}>
              <SelectTrigger className="w-full sm:w-[170px]">
                <SelectValue placeholder="Vendeur" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous vendeurs</SelectItem>
                <SelectItem value="unassigned">Non assigné</SelectItem>
                {reps
                  .filter((r) => r.active)
                  .map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <div className="text-xs text-muted-foreground">
              {filtered.length} / {leads.length}
            </div>
          </div>

          <div className="admin-clients-scroll">
            <Table className="min-w-[1400px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap w-[130px]">Lead</TableHead>
                  <TableHead className="whitespace-nowrap">Contact</TableHead>
                  <TableHead className="whitespace-nowrap">Entreprise</TableHead>
                  <TableHead className="whitespace-nowrap">Industrie</TableHead>
                  <TableHead className="whitespace-nowrap">Type</TableHead>
                  <TableHead className="whitespace-nowrap">Source</TableHead>
                  <TableHead className="whitespace-nowrap">Statut</TableHead>
                  <TableHead className="whitespace-nowrap">Qualif.</TableHead>
                  <TableHead className="whitespace-nowrap">Vendeur</TableHead>
                  <TableHead className="whitespace-nowrap">Onboarding</TableHead>
                  <TableHead className="whitespace-nowrap">Créé</TableHead>
                  <TableHead className="whitespace-nowrap">Relance</TableHead>
                  <TableHead className="whitespace-nowrap">Suivi</TableHead>
                  <TableHead className="w-[140px] whitespace-nowrap">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={14} className="text-center py-8 text-muted-foreground">
                      Chargement…
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={14} className="text-center py-8 text-muted-foreground">
                      Aucun lead
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((l) => {
                    const overdue = isOverdue(l.next_followup_at, l.status);
                    return (
                      <TableRow
                        key={l.lead_code}
                        className={`cursor-pointer ${overdue ? "bg-[rgba(255,110,110,0.05)]" : ""}`}
                        onClick={() => setEditing(l)}
                      >
                        <TableCell className="font-mono text-xs">{l.lead_code}</TableCell>
                        <TableCell>
                          <div className="text-sm font-medium">
                            {[l.first_name, l.last_name].filter(Boolean).join(" ") || "—"}
                          </div>
                          <div className="text-xs text-muted-foreground">{l.email || l.phone || ""}</div>
                        </TableCell>
                        <TableCell>{l.company || "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {l.industry || "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {l.business_type ? BUSINESS_TYPE_LABEL[l.business_type] : "—"}
                        </TableCell>
                        <TableCell className="text-sm">{l.source || "—"}</TableCell>
                        <TableCell>
                          <span
                            className={`inline-block px-2 py-0.5 rounded-md text-xs border ${STATUS_CLASS[l.status]}`}
                          >
                            {STATUS_LABEL[l.status]}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm">
                          {l.qualification_score ? `${l.qualification_score}/5` : "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {l.owner_id ? repById.get(l.owner_id) || "—" : "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {l.onboarding_booked_at ? fmtDate(l.onboarding_booked_at) : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {fmtDate(l.created_at)}
                        </TableCell>
                        <TableCell className="text-xs">
                          {l.next_followup_at ? (
                            <span
                              className={
                                overdue
                                  ? "text-[hsl(var(--bad))] font-medium"
                                  : "text-muted-foreground"
                              }
                            >
                              {fmtDate(l.next_followup_at)}
                            </span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          {l.responded_at ? (
                            <span className="inline-block px-2 py-0.5 rounded-md text-[10px] border border-[rgba(122,232,180,0.4)] bg-[rgba(122,232,180,0.08)] text-[hsl(var(--good))]">
                              Répondu
                            </span>
                          ) : l.followup_count >= 6 ? (
                            <span className="text-muted-foreground">6/6 (stop)</span>
                          ) : (
                            <span className="text-muted-foreground">{l.followup_count}/6</span>
                          )}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditing(l)}
                            >
                              Ouvrir
                            </Button>
                            {(() => {
                              const seqBlocked =
                                l.status === "won" ||
                                l.status === "lost" ||
                                !!l.responded_at ||
                                l.followup_count >= 6;
                              const emailBusy = followingUp === `${l.lead_code}:email`;
                              const smsBusy = followingUp === `${l.lead_code}:sms`;
                              return (
                                <>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8"
                                    disabled={emailBusy || smsBusy || seqBlocked || !l.email}
                                    onClick={() => onFollowUpNow(l, "email")}
                                    title={l.email ? `Envoyer un email à ${l.email}` : "Aucun email"}
                                  >
                                    {emailBusy ? (
                                      <BellRing className="h-4 w-4 animate-pulse" />
                                    ) : (
                                      <Mail className="h-4 w-4" />
                                    )}
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8"
                                    disabled={emailBusy || smsBusy || seqBlocked || !l.phone}
                                    onClick={() => onFollowUpNow(l, "sms")}
                                    title={l.phone ? `Envoyer un SMS au ${l.phone}` : "Aucun téléphone"}
                                  >
                                    {smsBusy ? (
                                      <BellRing className="h-4 w-4 animate-pulse" />
                                    ) : (
                                      <MessageSquare className="h-4 w-4" />
                                    )}
                                  </Button>
                                </>
                              );
                            })()}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      {(creating || editing) && (
        <LeadDialog
          lead={editing}
          reps={reps}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
          onSaved={() => {
            setEditing(null);
            setCreating(false);
            reload();
          }}
        />
      )}
      {repsOpen && (
        <SalesRepsDialog
          reps={reps}
          onClose={() => setRepsOpen(false)}
          onSaved={reload}
        />
      )}
    </div>
  );
};

const StatCard = ({
  label,
  value,
  tone,
  onClick,
}: {
  label: string;
  value: number | string;
  tone?: "red" | "green" | "amber";
  onClick?: () => void;
}) => (
  <Card
    className={`p-4 glass-card ${onClick ? "cursor-pointer hover:ring-1 hover:ring-primary/40 transition" : ""}`}
    onClick={onClick}
  >
    <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
    <div
      className={`text-2xl font-mono font-medium mt-1 ${
        tone === "red"
          ? "text-[hsl(var(--bad))]"
          : tone === "green"
          ? "text-[hsl(var(--good))]"
          : tone === "amber"
          ? "text-[hsl(var(--watch))]"
          : "text-foreground"
      }`}
    >
      {value}
    </div>
  </Card>
);

export default SalesLeads;
