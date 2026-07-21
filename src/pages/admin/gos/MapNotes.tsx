import { useCallback, useEffect, useState, useMemo } from "react";
import { SectionHeader, EmptyState } from "@/gos/ui";
import { useSelectedClient } from "@/gos/context";
import { toast } from "sonner";
import { Plus, Trash2, Filter, Flag } from "lucide-react";
import {
  createMapNote,
  deleteMapNote,
  fetchMapNotes,
  type MapNote,
} from "@/gos/mapNotesController";

const ROLES = [
  { value: "media_buyer", label: "Media Buyer" },
  { value: "growth_strategist", label: "Growth Strategist" },
  { value: "creative_strategist", label: "Creative Strategist" },
  { value: "ops", label: "Ops" },
  { value: "ceo", label: "CEO" },
  { value: "analyst", label: "Analyst" },
  { value: "other", label: "Other" },
];

const SCOPES = [
  { value: "global", label: "Global" },
  { value: "channel", label: "Channel" },
  { value: "campaign_category", label: "Campaign Category" },
  { value: "campaign", label: "Campaign" },
  { value: "metric", label: "Metric" },
];

const ROLE_COLORS: Record<string, string> = {
  media_buyer: "#3b82f6",
  growth_strategist: "#8b5cf6",
  creative_strategist: "#ec4899",
  ops: "#f59e0b",
  ceo: "#10b981",
  analyst: "#6366f1",
  other: "#6b7280",
};

const todayIso = () => new Date().toISOString().slice(0, 10);

export default function MapNotes() {
  const { selectedClient } = useSelectedClient();
  const clientId = selectedClient?.id ?? null;

  const [notes, setNotes] = useState<MapNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterDate, setFilterDate] = useState(todayIso());
  const [filterRole, setFilterRole] = useState<string>("");
  const [filterScope, setFilterScope] = useState<string>("");
  const [showSignalOnly, setShowSignalOnly] = useState(false);

  const [draft, setDraft] = useState({
    note_date: todayIso(),
    author_role: "media_buyer",
    scope_type: "global",
    scope_key: "",
    scope_label: "",
    what_happened: "",
    so_what: "",
    now_what: "",
    is_signal: false,
  });
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    try {
      setNotes(await fetchMapNotes(clientId, {
        note_date: filterDate,
        author_role: filterRole,
        scope_type: filterScope,
        signal_only: showSignalOnly,
      }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible de charger les notes");
    } finally {
      setLoading(false);
    }
  }, [clientId, filterDate, filterRole, filterScope, showSignalOnly]);

  useEffect(() => {
    load();
  }, [load]);

  async function postNote() {
    if (!clientId) {
      toast.error("No active client");
      return;
    }
    if (!draft.what_happened.trim()) {
      toast.error("What happened is required");
      return;
    }
    setPosting(true);
    try {
      await createMapNote(clientId, draft);
      toast.success("Map note posted");
      setDraft({
        ...draft,
        what_happened: "",
        so_what: "",
        now_what: "",
        is_signal: false,
      });
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible de publier la note");
    } finally {
      setPosting(false);
    }
  }

  async function deleteNote(id: string) {
    if (!confirm("Delete this note?")) return;
    try {
      await deleteMapNote(id);
      toast.success("Deleted");
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible de supprimer la note");
    }
  }

  const grouped = useMemo(() => {
    const g: Record<string, MapNote[]> = {};
    for (const n of notes) {
      (g[n.note_date] ??= []).push(n);
    }
    return g;
  }, [notes]);

  if (!clientId) {
    return (
      <div style={{ padding: 24 }}>
        <SectionHeader title="Map Notes" subtitle="Sélectionnez un client actif" />
        <EmptyState title="Aucun client sélectionné" hint="Choisissez un client dans la barre latérale" />
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 1400 }}>
      <SectionHeader
        title="Map Notes"
        subtitle="Rituel quotidien — What happened / So what / Now what. Documente ta pensée pour aujourd'hui."
      />

      {/* Composer */}
      <div className="gos-card" style={{ padding: 16, marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <Plus size={16} />
          <div style={{ fontWeight: 600 }}>Nouvelle note</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 12 }}>
          <Field label="Date">
            <input
              type="date"
              value={draft.note_date}
              onChange={(e) => setDraft({ ...draft, note_date: e.target.value })}
              className="gos-input"
            />
          </Field>
          <Field label="Rôle">
            <select
              value={draft.author_role}
              onChange={(e) => setDraft({ ...draft, author_role: e.target.value })}
              className="gos-input"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Scope">
            <select
              value={draft.scope_type}
              onChange={(e) => setDraft({ ...draft, scope_type: e.target.value })}
              className="gos-input"
            >
              {SCOPES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Scope label (optionnel)">
            <input
              type="text"
              placeholder="ex: Meta / Joggers / Revenue"
              value={draft.scope_label}
              onChange={(e) => setDraft({ ...draft, scope_label: e.target.value })}
              className="gos-input"
            />
          </Field>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <Field label="WHAT — Qu'est-ce qui s'est passé ?" required>
            <textarea
              value={draft.what_happened}
              onChange={(e) => setDraft({ ...draft, what_happened: e.target.value })}
              rows={4}
              className="gos-input"
              placeholder="Faits observés hier, chiffres..."
            />
          </Field>
          <Field label="SO WHAT — Qu'est-ce que ça veut dire ?">
            <textarea
              value={draft.so_what}
              onChange={(e) => setDraft({ ...draft, so_what: e.target.value })}
              rows={4}
              className="gos-input"
              placeholder="Interprétation, hypothèse..."
            />
          </Field>
          <Field label="NOW WHAT — Qu'est-ce que je fais ?">
            <textarea
              value={draft.now_what}
              onChange={(e) => setDraft({ ...draft, now_what: e.target.value })}
              rows={4}
              className="gos-input"
              placeholder="Action prise, changement de projection..."
            />
          </Field>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--tdia-muted)", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={draft.is_signal}
              onChange={(e) => setDraft({ ...draft, is_signal: e.target.checked })}
            />
            <Flag size={14} /> Marquer comme signal important
          </label>
          <button className="gos-btn-primary" onClick={postNote} disabled={posting || !draft.what_happened.trim()}>
            {posting ? "Publication..." : "Publier la note"}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="gos-card" style={{ padding: 12, marginBottom: 16, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <Filter size={14} style={{ color: "var(--tdia-muted)" }} />
        <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="gos-input" style={{ width: 160 }} />
        <button
          onClick={() => setFilterDate("")}
          style={{ background: "transparent", border: "1px solid var(--tdia-border)", color: "var(--tdia-muted)", padding: "6px 10px", borderRadius: 6, fontSize: 12, cursor: "pointer" }}
        >
          Toutes les dates
        </button>
        <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)} className="gos-input" style={{ width: 180 }}>
          <option value="">Tous les rôles</option>
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <select value={filterScope} onChange={(e) => setFilterScope(e.target.value)} className="gos-input" style={{ width: 180 }}>
          <option value="">Tous les scopes</option>
          {SCOPES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--tdia-muted)", cursor: "pointer" }}>
          <input type="checkbox" checked={showSignalOnly} onChange={(e) => setShowSignalOnly(e.target.checked)} />
          Signaux uniquement
        </label>
        <div style={{ marginLeft: "auto", fontSize: 12, color: "var(--tdia-muted)" }}>
          {loading ? "Chargement..." : `${notes.length} note(s)`}
        </div>
      </div>

      {/* Notes list */}
      {notes.length === 0 ? (
        <EmptyState title="Aucune note pour ce filtre" hint="Publie ta première note du jour ci-dessus." />
      ) : (
        Object.entries(grouped).map(([date, list]) => (
          <div key={date} style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.03em", color: "var(--tdia-muted)", marginBottom: 8 }}>
              {new Date(date).toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }).toUpperCase()}
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {list.map((n) => (
                <NoteCard key={n.id} note={n} onDelete={() => deleteNote(n.id)} />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.03em", color: "var(--tdia-muted)", fontWeight: 600, marginBottom: 4 }}>
        {label} {required && <span style={{ color: "#c1121f" }}>*</span>}
      </div>
      {children}
    </div>
  );
}

function NoteCard({ note, onDelete }: { note: MapNote; onDelete: () => void }) {
  const roleColor = ROLE_COLORS[note.author_role] ?? "#6b7280";
  const roleLabel = ROLES.find((r) => r.value === note.author_role)?.label ?? note.author_role;
  const scopeLabel = SCOPES.find((s) => s.value === note.scope_type)?.label ?? note.scope_type;

  return (
    <div
      className="gos-card"
      style={{
        padding: 14,
        borderLeft: `3px solid ${roleColor}`,
        background: note.is_signal ? "hsl(45 60% 15% / 0.3)" : undefined,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 8, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span
            style={{
              padding: "2px 8px",
              borderRadius: 4,
              background: `${roleColor}22`,
              color: roleColor,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            {roleLabel}
          </span>
          <span style={{ fontSize: 11, color: "var(--tdia-muted)", fontWeight: 600 }}>
            {scopeLabel}
            {note.scope_label && ` · ${note.scope_label}`}
          </span>
          {note.is_signal && (
            <span style={{ display: "flex", alignItems: "center", gap: 4, color: "#f59e0b", fontSize: 11, fontWeight: 700 }}>
              <Flag size={11} /> SIGNAL
            </span>
          )}
          <span style={{ fontSize: 11, color: "var(--tdia-muted)" }}>
            {new Date(note.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
        <button
          onClick={onDelete}
          style={{ background: "transparent", border: "none", color: "var(--tdia-muted)", cursor: "pointer", padding: 4 }}
          title="Supprimer"
        >
          <Trash2 size={14} />
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
        <NoteField label="WHAT" value={note.what_happened} />
        <NoteField label="SO WHAT" value={note.so_what} muted />
        <NoteField label="NOW WHAT" value={note.now_what} muted />
      </div>
    </div>
  );
}

function NoteField({ label, value, muted }: { label: string; value: string | null; muted?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.03em", color: "var(--tdia-muted)", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 13, color: value ? "var(--tdia-text)" : "var(--tdia-muted)", whiteSpace: "pre-wrap", opacity: muted && !value ? 0.5 : 1 }}>
        {value || "—"}
      </div>
    </div>
  );
}
