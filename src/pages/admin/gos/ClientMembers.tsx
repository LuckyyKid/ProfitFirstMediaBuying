import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SectionHeader, EmptyState } from "@/gos/ui";
import { toast } from "sonner";
import { Trash2, UserPlus } from "lucide-react";

type Member = {
  id: string;
  user_id: string;
  role: "owner" | "admin" | "analyst" | "viewer";
  created_at: string;
};

type ClientRow = { id: string; company_name: string; client_code: string };

const ROLES: Member["role"][] = ["owner", "admin", "analyst", "viewer"];

export default function GosClientMembers() {
  const { clientId } = useParams();
  const [client, setClient] = useState<ClientRow | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Member["role"]>("viewer");
  const [adding, setAdding] = useState(false);

  async function load() {
    if (!clientId) return;
    setLoading(true);
    const [{ data: c }, { data: m, error }] = await Promise.all([
      supabase.from("gos_clients").select("id, company_name, client_code").eq("id", clientId).maybeSingle(),
      supabase.from("gos_client_members").select("*").eq("client_id", clientId).order("created_at"),
    ]);
    setClient(c as any);
    if (error) toast.error(error.message);
    setMembers((m as any) ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [clientId]);

  async function add() {
    if (!email.trim() || !clientId) return;
    setAdding(true);
    // Resolve email → user_id via edge function (auth.users not queryable from client)
    const { data, error } = await supabase.functions.invoke("gos-client-member-add", {
      body: { client_id: clientId, email: email.trim(), role },
    });
    setAdding(false);
    if (error || !data?.ok) {
      toast.error(data?.error ?? error?.message ?? "Erreur");
      return;
    }
    toast.success("Membre ajouté");
    setEmail("");
    load();
  }

  async function changeRole(m: Member, r: Member["role"]) {
    const { error } = await supabase.from("gos_client_members").update({ role: r }).eq("id", m.id);
    if (error) toast.error(error.message); else { toast.success("Rôle mis à jour"); load(); }
  }

  async function remove(m: Member) {
    if (!confirm("Retirer ce membre ?")) return;
    const { error } = await supabase.from("gos_client_members").delete().eq("id", m.id);
    if (error) toast.error(error.message); else { toast.success("Retiré"); load(); }
  }

  return (
    <div>
      <SectionHeader
        title="Membres du client"
        subtitle={client ? `${client.company_name} (${client.client_code}) — accès Profit First` : "Chargement…"}
      />

      <div className="gos-card" style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Ajouter un membre</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input
            className="gos-input"
            type="email"
            placeholder="email@tdiaagency.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ minWidth: 260 }}
          />
          <select
            className="gos-input"
            value={role}
            onChange={(e) => setRole(e.target.value as Member["role"])}
            style={{ width: 140 }}
          >
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <button className="gos-btn-primary" disabled={adding || !email.trim()} onClick={add}>
            <UserPlus size={12} style={{ verticalAlign: -1, marginRight: 6 }} />
            {adding ? "Ajout…" : "Ajouter"}
          </button>
        </div>
        <div style={{ fontSize: 11, color: "var(--tdia-muted)", marginTop: 8 }}>
          L'utilisateur doit déjà avoir un compte Supabase Auth (créé au premier login).
        </div>
      </div>

      <div className="gos-card">
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>
          {members.length} membre{members.length > 1 ? "s" : ""}
        </div>
        {loading ? (
          <div style={{ height: 100, background: "hsl(220 45% 14%)", borderRadius: 12 }} />
        ) : members.length === 0 ? (
          <EmptyState title="Aucun membre" hint="Ajoute au moins un owner pour ce client." />
        ) : (
          <table className="gos-table">
            <thead><tr>
              <th>User ID</th><th>Rôle</th><th>Ajouté le</th><th></th>
            </tr></thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td style={{ fontFamily: "monospace", fontSize: 11 }}>{m.user_id}</td>
                  <td>
                    <select
                      className="gos-input"
                      value={m.role}
                      onChange={(e) => changeRole(m, e.target.value as Member["role"])}
                      style={{ width: 130 }}
                    >
                      {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                  <td style={{ fontSize: 12 }}>{new Date(m.created_at).toLocaleDateString()}</td>
                  <td>
                    <button className="gos-btn-secondary" onClick={() => remove(m)}>
                      <Trash2 size={12} /> Retirer
                    </button>
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
