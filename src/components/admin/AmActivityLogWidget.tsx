import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Scissors,
  Rocket,
  DollarSign,
  ExternalLink,
  Users,
  Tag,
  StickyNote,
  Trash2,
  Plus,
  ClipboardList,
  Loader2,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────

type EventType =
  | "creative_coupee"
  | "creative_lancee"
  | "changement_budget"
  | "changement_destination"
  | "changement_audience"
  | "changement_offre"
  | "note";

interface ActivityEntry {
  id: string;
  client_code: string;
  event_date: string;
  event_type: EventType;
  description: string;
  created_at: string;
}

interface Props {
  clientCode: string | null;
  clientLabel?: string | null;
}

// ─── UI config ────────────────────────────────────────────────────────

const EVENT_META: Record<EventType, { label: string; Icon: typeof Scissors; tone: string }> = {
  creative_coupee: {
    label: "Créative coupée",
    Icon: Scissors,
    tone: "bg-red-500/15 text-red-500 border-red-500/40",
  },
  creative_lancee: {
    label: "Créative lancée",
    Icon: Rocket,
    tone: "bg-emerald-500/15 text-emerald-500 border-emerald-500/40",
  },
  changement_budget: {
    label: "Changement de budget",
    Icon: DollarSign,
    tone: "bg-yellow-500/15 text-yellow-500 border-yellow-500/40",
  },
  changement_destination: {
    label: "Changement de landing page",
    Icon: ExternalLink,
    tone: "bg-orange-500/15 text-orange-500 border-orange-500/40",
  },
  changement_audience: {
    label: "Changement d'audience",
    Icon: Users,
    tone: "bg-blue-500/15 text-blue-500 border-blue-500/40",
  },
  changement_offre: {
    label: "Changement d'offre",
    Icon: Tag,
    tone: "bg-purple-500/15 text-purple-500 border-purple-500/40",
  },
  note: {
    label: "Note libre",
    Icon: StickyNote,
    tone: "bg-muted text-muted-foreground",
  },
};

const EVENT_ORDER: EventType[] = [
  "creative_coupee",
  "creative_lancee",
  "changement_budget",
  "changement_destination",
  "changement_audience",
  "changement_offre",
  "note",
];

// ─── Helpers ──────────────────────────────────────────────────────────

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function fmtRelDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const diffDays = Math.floor(
    (today.getTime() - new Date(iso.slice(0, 10)).getTime()) / 86_400_000,
  );
  if (diffDays === 0) return "aujourd'hui";
  if (diffDays === 1) return "hier";
  if (diffDays < 7) return `il y a ${diffDays} j`;
  return d.toLocaleDateString("fr-CA");
}

// Distingue une function non déployée d'une vraie erreur.
function isFunctionMissing(err: unknown): boolean {
  const msg = ((err as Error)?.message ?? "").toLowerCase();
  return (
    msg.includes("not found") ||
    msg.includes("404") ||
    msg.includes("failed to send a request") ||
    msg.includes("function") && msg.includes("not exist")
  );
}

// ─── Component ────────────────────────────────────────────────────────

export function AmActivityLogWidget({ clientCode, clientLabel }: Props) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<ActivityEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [backendMissing, setBackendMissing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [eventDate, setEventDate] = useState(todayIso());
  const [eventType, setEventType] = useState<EventType>("changement_budget");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = !!clientCode && description.trim().length > 0 && !submitting;

  const load = useCallback(async () => {
    if (!clientCode) {
      setEntries(null);
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const { data, error } = await supabase.functions.invoke("am-activity-log-list", {
        body: { client_code: clientCode, limit: 20 },
      });
      if (error) throw error;
      const list = (data?.entries ?? []) as ActivityEntry[];
      setEntries(list);
      setBackendMissing(false);
    } catch (e) {
      if (isFunctionMissing(e)) {
        setBackendMissing(true);
        setEntries([]);
      } else {
        setErr((e as Error).message || "Impossible de charger le journal.");
        setEntries([]);
      }
    } finally {
      setLoading(false);
    }
  }, [clientCode]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const submit = async () => {
    if (!clientCode || !canSubmit) return;
    setSubmitting(true);
    const t = toast.loading("Enregistrement…");
    try {
      const { data, error } = await supabase.functions.invoke(
        "am-activity-log-create",
        {
          body: {
            client_code: clientCode,
            event_date: eventDate,
            event_type: eventType,
            description: description.trim(),
          },
        },
      );
      if (error) throw error;
      toast.dismiss(t);
      toast.success("Événement enregistré.");
      const created = (data?.entry as ActivityEntry) ?? null;
      if (created) {
        setEntries((prev) => [created, ...(prev ?? [])]);
      } else {
        load();
      }
      setDescription("");
      setEventDate(todayIso());
    } catch (e) {
      toast.dismiss(t);
      if (isFunctionMissing(e)) {
        setBackendMissing(true);
        toast.error("Le backend n'est pas encore déployé.");
      } else {
        toast.error(
          (e as Error).message ||
            "Impossible d'enregistrer l'événement pour l'instant.",
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const del = async (id: string) => {
    const prev = entries;
    setEntries((cur) => (cur ?? []).filter((e) => e.id !== id));
    try {
      const { error } = await supabase.functions.invoke(
        "am-activity-log-delete",
        { body: { id } },
      );
      if (error) throw error;
      toast.success("Supprimé.");
    } catch (e) {
      setEntries(prev);
      toast.error(
        (e as Error).message || "Impossible de supprimer cet événement.",
      );
    }
  };

  const groupedByDate = useMemo(() => {
    const list = entries ?? [];
    const map = new Map<string, ActivityEntry[]>();
    for (const e of list) {
      const k = e.event_date;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(e);
    }
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [entries]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* Floating action button — visible only when a client is selected */}
      {clientCode && (
        <DialogTrigger asChild>
          <Button
            size="lg"
            className="fixed bottom-6 right-6 shadow-lg z-40 gap-2"
          >
            <ClipboardList className="h-4 w-4" />
            Logger un changement
          </Button>
        </DialogTrigger>
      )}

      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Journal d'activité</DialogTitle>
          <DialogDescription>
            Note chaque changement fait sur le compte au moment où il est fait.
            Ce journal servira à expliquer les variations dans le prochain
            rapport hebdomadaire.
            {clientLabel && (
              <span className="block mt-1 text-foreground">
                Client : <b>{clientLabel}</b>{" "}
                <span className="text-muted-foreground">({clientCode})</span>
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {backendMissing && (
          <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3 text-xs">
            Le backend du journal n'est pas encore déployé. Les événements que
            tu enregistres ne seront pas persistés tant que Lovable n'a pas
            créé les tables et edge functions.
          </div>
        )}

        {err && !backendMissing && (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-500">
            {err}
          </div>
        )}

        {/* ── Form ────────────────────────────────────────────────── */}
        <div className="space-y-3 border border-border/60 rounded-lg p-4 bg-background/40">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="event_date" className="text-xs">
                Date de l'événement
              </Label>
              <Input
                id="event_date"
                type="date"
                value={eventDate}
                max={todayIso()}
                onChange={(e) => setEventDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="event_type" className="text-xs">
                Type
              </Label>
              <Select
                value={eventType}
                onValueChange={(v) => setEventType(v as EventType)}
              >
                <SelectTrigger id="event_type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_ORDER.map((t) => {
                    const meta = EVENT_META[t];
                    const Icon = meta.Icon;
                    return (
                      <SelectItem key={t} value={t}>
                        <span className="flex items-center gap-2">
                          <Icon className="h-3.5 w-3.5" />
                          {meta.label}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description" className="text-xs">
              Détail (ex. « Ad set Ontario passé de LP-A à LP-B »)
            </Label>
            <Textarea
              id="description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Décris précisément ce qui a été changé et pourquoi."
            />
          </div>

          <div className="flex justify-end">
            <Button onClick={submit} disabled={!canSubmit} className="gap-1.5">
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Enregistrer
            </Button>
          </div>
        </div>

        {/* ── Historique ──────────────────────────────────────────── */}
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Derniers événements
          </div>

          {loading && entries === null && (
            <div className="text-xs text-muted-foreground py-6 text-center">
              Chargement…
            </div>
          )}

          {!loading && entries && entries.length === 0 && (
            <div className="text-xs text-muted-foreground py-6 text-center">
              Aucun événement pour ce client.
            </div>
          )}

          {groupedByDate.map(([date, list]) => (
            <div key={date} className="space-y-1">
              <div className="text-[11px] text-muted-foreground pl-1">
                {fmtRelDate(date)}
                {" · "}
                {new Date(date).toLocaleDateString("fr-CA")}
              </div>
              {list.map((entry) => {
                const meta = EVENT_META[entry.event_type];
                const Icon = meta.Icon;
                return (
                  <div
                    key={entry.id}
                    className="flex items-start gap-2 rounded-md border border-border/50 bg-background/40 px-3 py-2"
                  >
                    <div className="mt-0.5">
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${meta.tone} gap-1`}
                      >
                        <Icon className="h-3 w-3" />
                        {meta.label}
                      </Badge>
                    </div>
                    <div className="flex-1 text-xs leading-snug">
                      {entry.description}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-red-500"
                      onClick={() => del(entry.id)}
                      aria-label="Supprimer cet événement"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
