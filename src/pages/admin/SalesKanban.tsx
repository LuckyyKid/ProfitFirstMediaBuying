import { useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
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
  ArrowLeft,
  LogOut,
  List,
  Plus,
  RefreshCcw,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import {
  useSalesLeads,
  updateLeadStatus,
  LEAD_STATUS_LABEL,
  LEAD_STATUS_CLASS,
  LEAD_STATUS_ORDER,
  type BusinessType,
  type LeadStatus,
  type SalesLead,
} from "@/hooks/useSalesLeads";
import { LeadDialog } from "@/components/admin/sales/LeadDialog";

type PeriodKey = "today" | "week" | "month" | "quarter" | "year" | "all";

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "today", label: "Aujourd'hui" },
  { key: "week", label: "Cette semaine" },
  { key: "month", label: "Ce mois" },
  { key: "quarter", label: "Ce trimestre" },
  { key: "year", label: "Cette année" },
  { key: "all", label: "Tout" },
];

const BUSINESS_TYPES: { key: BusinessType | "all"; label: string }[] = [
  { key: "all", label: "Tous types" },
  { key: "saas", label: "SaaS" },
  { key: "ecom", label: "E-commerce" },
  { key: "service", label: "Service" },
  { key: "other", label: "Autre" },
];

function periodStart(key: PeriodKey): Date | null {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (key) {
    case "today":
      return d;
    case "week": {
      const day = d.getDay();
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

const SalesKanban = () => {
  const { isAuthed, ready, logout } = useAdminAuth();
  const { leads, reps, loading, reload } = useSalesLeads();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<BusinessType | "all">("all");
  const [ownerFilter, setOwnerFilter] = useState<string>("all");
  const [period, setPeriod] = useState<PeriodKey>("all");
  const [editing, setEditing] = useState<SalesLead | null>(null);
  const [creating, setCreating] = useState(false);
  const [activeDrag, setActiveDrag] = useState<SalesLead | null>(null);
  const [moving, setMoving] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const repById = useMemo(() => {
    const m = new Map<string, string>();
    reps.forEach((r) => m.set(r.id, r.name));
    return m;
  }, [reps]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const start = periodStart(period);
    return leads.filter((l) => {
      if (start && new Date(l.created_at) < start) return false;
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
  }, [leads, search, typeFilter, ownerFilter, period]);

  const grouped = useMemo(() => {
    const map: Record<LeadStatus, SalesLead[]> = {
      new: [],
      contacted: [],
      qualified: [],
      proposal: [],
      won: [],
      lost: [],
    };
    filtered.forEach((l) => map[l.status].push(l));
    return map;
  }, [filtered]);

  const onDragStart = (e: DragStartEvent) => {
    const code = e.active.id as string;
    const lead = filtered.find((l) => l.lead_code === code) || null;
    setActiveDrag(lead);
  };

  const onDragEnd = async (e: DragEndEvent) => {
    setActiveDrag(null);
    const lead = filtered.find((l) => l.lead_code === e.active.id);
    if (!lead) return;
    const target = e.over?.id as LeadStatus | undefined;
    if (!target || target === lead.status) return;
    if (!LEAD_STATUS_ORDER.includes(target)) return;

    setMoving(lead.lead_code);
    const { error } = await updateLeadStatus(lead.lead_code, target, lead.converted_at);
    setMoving(null);
    if (error) {
      toast.error(error || "Échec du déplacement");
      return;
    }
    toast.success(`${lead.lead_code} → ${LEAD_STATUS_LABEL[target]}`);
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
              Sales Pipeline — Kanban
            </h1>
            <p className="text-sm text-muted-foreground">
              Glisse-dépose une carte pour changer son statut
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link to="/admin/sales">
                <List className="h-4 w-4 mr-2" /> Vue Liste
              </Link>
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
        </Card>

        <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            {LEAD_STATUS_ORDER.map((status) => (
              <KanbanColumn
                key={status}
                status={status}
                leads={grouped[status]}
                repById={repById}
                moving={moving}
                onOpen={setEditing}
              />
            ))}
          </div>
          <DragOverlay>
            {activeDrag ? (
              <LeadCard
                lead={activeDrag}
                repById={repById}
                isDragging
                moving={null}
                onOpen={() => {}}
              />
            ) : null}
          </DragOverlay>
        </DndContext>
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
    </div>
  );
};

const KanbanColumn = ({
  status,
  leads,
  repById,
  moving,
  onOpen,
}: {
  status: LeadStatus;
  leads: SalesLead[];
  repById: Map<string, string>;
  moving: string | null;
  onOpen: (l: SalesLead) => void;
}) => {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg border p-2 min-h-[300px] flex flex-col gap-2 transition-colors ${
        isOver
          ? "border-primary/60 bg-primary/5"
          : "border-border/40 bg-muted/10"
      }`}
    >
      <div className="flex items-center justify-between px-1 py-1">
        <span
          className={`inline-block px-2 py-0.5 rounded-md text-xs border ${LEAD_STATUS_CLASS[status]}`}
        >
          {LEAD_STATUS_LABEL[status]}
        </span>
        <span className="text-xs text-muted-foreground font-mono">{leads.length}</span>
      </div>
      <div className="flex flex-col gap-2">
        {leads.map((l) => (
          <LeadCard
            key={l.lead_code}
            lead={l}
            repById={repById}
            moving={moving}
            onOpen={onOpen}
          />
        ))}
        {leads.length === 0 && (
          <div className="text-xs text-muted-foreground/60 text-center py-6">
            Aucun lead
          </div>
        )}
      </div>
    </div>
  );
};

const LeadCard = ({
  lead,
  repById,
  moving,
  onOpen,
  isDragging,
}: {
  lead: SalesLead;
  repById: Map<string, string>;
  moving: string | null;
  onOpen: (l: SalesLead) => void;
  isDragging?: boolean;
}) => {
  const { attributes, listeners, setNodeRef, transform, isDragging: dragging } =
    useDraggable({ id: lead.lead_code });
  const overdue = isOverdue(lead.next_followup_at, lead.status);
  const isMoving = moving === lead.lead_code;

  const style: React.CSSProperties = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : {};

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`rounded-md border bg-background/60 p-2 space-y-1.5 cursor-grab active:cursor-grabbing ${
        dragging ? "opacity-40" : ""
      } ${isDragging ? "shadow-lg ring-1 ring-primary/40" : ""} ${
        isMoving ? "opacity-50" : ""
      } ${overdue ? "border-[hsl(var(--bad))]/40" : "border-border/40"}`}
      onDoubleClick={() => onOpen(lead)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">
            {[lead.first_name, lead.last_name].filter(Boolean).join(" ") ||
              lead.company ||
              "—"}
          </div>
          {lead.company && (lead.first_name || lead.last_name) && (
            <div className="text-xs text-muted-foreground truncate">{lead.company}</div>
          )}
        </div>
        <span className="text-[10px] font-mono text-muted-foreground shrink-0">
          {lead.lead_code}
        </span>
      </div>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="truncate">
          {lead.owner_id ? repById.get(lead.owner_id) || "—" : "Non assigné"}
        </span>
        {lead.next_followup_at && (
          <span
            className={
              overdue ? "text-[hsl(var(--bad))] font-medium" : ""
            }
          >
            {fmtDate(lead.next_followup_at)}
          </span>
        )}
      </div>
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onOpen(lead);
        }}
        className="text-[11px] text-primary hover:underline"
      >
        Ouvrir
      </button>
    </div>
  );
};

export default SalesKanban;
