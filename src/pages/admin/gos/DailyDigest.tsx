import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SectionHeader, EmptyState } from "@/gos/ui";
import { useSelectedClient } from "@/gos/context";
import { toast } from "sonner";
import { Send, Plus, Trash2, Mail } from "lucide-react";

type Recipient = {
  id: string;
  client_id: string;
  email: string;
  role_label: string | null;
  active: boolean;
  send_hour_utc: number;
  created_at: string;
};

type SendLog = {
  id: string;
  recipient_email: string;
  digest_date: string;
  status: string;
  error: string | null;
  created_at: string;
};

const CARD = "rgba(255, 255, 255, 0.02)";
const BORDER = "rgba(148, 170, 215, 0.12)";
const MUTED = "#8b97ad";
const BLUE = "#4d9fff";
const GREEN = "#3ddc97";
const RED = "#ff6b6b";

export default function DailyDigest() {
  const { clientId } = useParams();
  const { setSelectedClient } = useSelectedClient();
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [logs, setLogs] = useState<SendLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [sending, setSending] = useState(false);

  const load = async () => {
    if (!clientId) return;
    setLoading(true);
    const [c, r, l] = await Promise.all([
      supabase.from("gos_clients").select("*").eq("id", clientId).single(),
      supabase.from("gos_digest_recipients").select("*").eq("client_id", clientId).order("created_at"),
      supabase.from("gos_digest_sends").select("*").eq("client_id", clientId).order("created_at", { ascending: false }).limit(20),
    ]);
    if (c.data) setSelectedClient(c.data as any);
    setRecipients((r.data ?? []) as Recipient[]);
    setLogs((l.data ?? []) as SendLog[]);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [clientId]);

  const add = async () => {
    if (!newEmail.trim() || !clientId) return;
    const { error } = await supabase.from("gos_digest_recipients").insert({
      client_id: clientId, email: newEmail.trim(), role_label: newRole.trim() || null, active: true,
    });
    if (error) { toast.error(error.message); return; }
    setNewEmail(""); setNewRole(""); toast.success("Destinataire ajouté");
    load();
  };

  const toggle = async (r: Recipient) => {
    await supabase.from("gos_digest_recipients").update({ active: !r.active }).eq("id", r.id);
    load();
  };

  const remove = async (id: string) => {
    await supabase.from("gos_digest_recipients").delete().eq("id", id);
    load();
  };

  const sendTest = async () => {
    if (!clientId) return;
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("gos-daily-digest", {
        body: { client_id: clientId, override_to: testEmail.trim() || undefined },
      });
      if (error) throw error;
      toast.success("Digest envoyé — vérifiez la console");
      console.log("[digest]", data);
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setSending(false); }
  };

  if (loading) return <div style={{ padding: 24, color: MUTED }}>Chargement…</div>;

  return (
    <div style={{ padding: 24 }}>
      <SectionHeader
        title="Daily Digest — 7h"
        subtitle="Résumé quotidien envoyé automatiquement à 11:00 UTC (7h EST). MTD vs Target/Projection · hier vs cible · notes du jour."
      />

      {/* Ajout destinataire */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16, marginTop: 16 }}>
        <div style={{ fontSize: 11, letterSpacing: "0.03em", color: MUTED, fontWeight: 700, textTransform: "uppercase", marginBottom: 10 }}>
          Ajouter un destinataire
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            type="email" placeholder="email@example.com" value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            style={{ flex: "1 1 240px", padding: "8px 12px", background: "rgba(255, 255, 255, 0.02)", border: `1px solid ${BORDER}`, color: "var(--tdia-text)", borderRadius: 8, fontSize: 13 }}
          />
          <input
            type="text" placeholder="Rôle (ex. CEO, Media Buyer)" value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
            style={{ flex: "1 1 200px", padding: "8px 12px", background: "rgba(255, 255, 255, 0.02)", border: `1px solid ${BORDER}`, color: "var(--tdia-text)", borderRadius: 8, fontSize: 13 }}
          />
          <button onClick={add} style={{ padding: "8px 16px", background: BLUE, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={14} /> Ajouter
          </button>
        </div>
      </div>

      {/* Liste destinataires */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16, marginTop: 16 }}>
        <div style={{ fontSize: 11, letterSpacing: "0.03em", color: MUTED, fontWeight: 700, textTransform: "uppercase", marginBottom: 10 }}>
          Destinataires ({recipients.filter((r) => r.active).length} actifs / {recipients.length})
        </div>
        {recipients.length === 0 ? (
          <EmptyState title="Aucun destinataire configuré." />
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                <th style={{ textAlign: "left", padding: "8px", fontSize: 10, letterSpacing: "0.03em", color: MUTED, fontWeight: 700 }}>EMAIL</th>
                <th style={{ textAlign: "left", padding: "8px", fontSize: 10, letterSpacing: "0.03em", color: MUTED, fontWeight: 700 }}>RÔLE</th>
                <th style={{ textAlign: "center", padding: "8px", fontSize: 10, letterSpacing: "0.03em", color: MUTED, fontWeight: 700 }}>ACTIF</th>
                <th style={{ textAlign: "right", padding: "8px" }}></th>
              </tr>
            </thead>
            <tbody>
              {recipients.map((r) => (
                <tr key={r.id} style={{ borderBottom: `1px solid ${BORDER}` }}>
                  <td style={{ padding: "10px 8px", color: "var(--tdia-text)", fontSize: 13 }}>{r.email}</td>
                  <td style={{ padding: "10px 8px", color: MUTED, fontSize: 13 }}>{r.role_label || "—"}</td>
                  <td style={{ padding: "10px 8px", textAlign: "center" }}>
                    <button onClick={() => toggle(r)} style={{ background: r.active ? GREEN : MUTED, color: "#fff", border: "none", padding: "4px 10px", borderRadius: 6, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
                      {r.active ? "ON" : "OFF"}
                    </button>
                  </td>
                  <td style={{ padding: "10px 8px", textAlign: "right" }}>
                    <button onClick={() => remove(r.id)} style={{ background: "transparent", color: RED, border: "none", cursor: "pointer" }}>
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Test send */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16, marginTop: 16 }}>
        <div style={{ fontSize: 11, letterSpacing: "0.03em", color: MUTED, fontWeight: 700, textTransform: "uppercase", marginBottom: 10 }}>
          Envoyer un test
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input
            type="email" placeholder="Override → email de test (vide = envoie aux destinataires actifs)" value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            style={{ flex: "1 1 320px", padding: "8px 12px", background: "rgba(255, 255, 255, 0.02)", border: `1px solid ${BORDER}`, color: "var(--tdia-text)", borderRadius: 8, fontSize: 13 }}
          />
          <button onClick={sendTest} disabled={sending} style={{ padding: "8px 16px", background: sending ? MUTED : BLUE, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: sending ? "wait" : "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <Send size={14} /> {sending ? "Envoi…" : "Envoyer maintenant"}
          </button>
        </div>
        <div style={{ fontSize: 11, color: MUTED, marginTop: 8 }}>
          Le digest utilise les données de <strong>hier</strong>. Le doublon est évité (déjà envoyé aujourd'hui pour la date d'hier → skip).
        </div>
      </div>

      {/* Journal */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16, marginTop: 16 }}>
        <div style={{ fontSize: 11, letterSpacing: "0.03em", color: MUTED, fontWeight: 700, textTransform: "uppercase", marginBottom: 10 }}>
          Journal (20 derniers)
        </div>
        {logs.length === 0 ? <EmptyState title="Aucun envoi." /> : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                <th style={{ textAlign: "left", padding: "6px", color: MUTED, fontSize: 10, letterSpacing: "0.03em" }}>ENVOYÉ LE</th>
                <th style={{ textAlign: "left", padding: "6px", color: MUTED, fontSize: 10, letterSpacing: "0.03em" }}>DATE DIGEST</th>
                <th style={{ textAlign: "left", padding: "6px", color: MUTED, fontSize: 10, letterSpacing: "0.03em" }}>DESTINATAIRE</th>
                <th style={{ textAlign: "left", padding: "6px", color: MUTED, fontSize: 10, letterSpacing: "0.03em" }}>STATUT</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} style={{ borderBottom: `1px solid ${BORDER}` }}>
                  <td style={{ padding: "6px", color: MUTED }}>{new Date(l.created_at).toLocaleString("fr-FR")}</td>
                  <td style={{ padding: "6px", color: "var(--tdia-text)" }}>{l.digest_date}</td>
                  <td style={{ padding: "6px", color: "var(--tdia-text)" }}>{l.recipient_email}</td>
                  <td style={{ padding: "6px", color: l.status === "sent" ? GREEN : RED, fontWeight: 600 }}>
                    <Mail size={11} style={{ display: "inline", marginRight: 4 }} />
                    {l.status}{l.error ? ` — ${l.error}` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
