import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SectionHeader } from "@/gos/ui";
import { BUSINESS_TYPES, PHASES } from "@/gos/ui";
import { useSelectedClient } from "@/gos/context";
import { toast } from "sonner";
import { Download, Search, Check, ArrowLeft, ArrowRight, User, Users, Link2, ClipboardCheck } from "lucide-react";

const empty = {
  client_code: "",
  company_name: "",
  website_url: "",
  industry: "",
  business_type: "ECOMMERCE",
  current_phase: "ONBOARDING",
  am_owner: "",
  main_contact_name: "",
  main_contact_email: "",
  main_contact_phone: "",
  offer_sold: "",
  platforms_managed: "",
  lead_source: "",
  deal_value: "",
  monthly_retainer: "",
  closing_date: "",
  launch_target_date: "",
  clickup_client_task_url: "",
  slack_channel: "",
  drive_folder_url: "",
  hub_url: "",
};

type SourceRow = {
  key: string;
  label: string;
  origin: "onboarding" | "deal";
  deal?: any;
  progress?: any;
};

function mapBusinessType(bt: string | null | undefined): string {
  if (!bt) return "ECOMMERCE";
  const up = bt.toUpperCase().replace(/[\s-]/g, "_");
  if (["ECOMMERCE", "LOCAL_SERVICE", "HYBRID", "OTHER"].includes(up)) return up;
  if (up.includes("LOCAL")) return "LOCAL_SERVICE";
  if (up.includes("ECOM") || up.includes("SHOP")) return "ECOMMERCE";
  return "OTHER";
}

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <label className="gos-label">
        {label} {required && <span style={{ color: "#ef4444" }}>*</span>}
      </label>
      {children}
    </div>
  );
}

const STEPS = [
  { key: "import",  title: "Importer",       desc: "Depuis un deal fermé ou un onboarding", Icon: Download },
  { key: "context", title: "Contexte",       desc: "Entreprise, activité, phase",           Icon: User },
  { key: "contact", title: "Contact & deal", desc: "Interlocuteur et données commerciales", Icon: Users },
  { key: "links",   title: "Liens & revue",  desc: "Outils, dossiers puis validation",      Icon: Link2 },
] as const;

export default function GosNewClient() {
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>("");
  const [search, setSearch] = useState("");
  const [existingCodes, setExistingCodes] = useState<Set<string>>(new Set());
  const [step, setStep] = useState(0);
  const nav = useNavigate();
  const { setSelectedClient } = useSelectedClient();

  const set = (k: keyof typeof empty, v: string) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    (async () => {
      const [deals, progs, gos] = await Promise.all([
        supabase.from("closed_deals").select("*").order("closing_date", { ascending: false }),
        supabase.from("client_progress").select("*").order("created_at", { ascending: false }),
        supabase.from("gos_clients").select("client_code"),
      ]);
      const map = new Map<string, SourceRow>();
      (progs.data ?? []).forEach((p: any) => {
        const key = p.client_code || p.email || p.id;
        map.set(key, {
          key,
          label: `${p.company_name || p.brand_name || p.client_name || "(sans nom)"} — ${p.client_code || "no-code"}`,
          origin: "onboarding",
          progress: p,
        });
      });
      (deals.data ?? []).forEach((d: any) => {
        const key = d.client_code || d.company_name || d.id;
        const existing = map.get(key);
        if (existing) existing.deal = d;
        else map.set(key, {
          key,
          label: `${d.company_name || "(sans nom)"} — ${d.client_code || "no-code"}`,
          origin: "deal",
          deal: d,
        });
      });
      setSources(Array.from(map.values()));
      setExistingCodes(new Set((gos.data ?? []).map((g: any) => g.client_code)));
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sources.filter((s) => !q || s.label.toLowerCase().includes(q)).slice(0, 100);
  }, [sources, search]);

  const prefill = (row: SourceRow) => {
    const d = row.deal ?? {};
    const p = row.progress ?? {};
    const first = (...vals: any[]) => vals.find((v) => v != null && v !== "") ?? "";
    setForm({
      client_code: first(d.client_code, p.client_code, ""),
      company_name: first(d.company_name, p.company_name, p.brand_name, ""),
      website_url: "",
      industry: first(d.offers_sold, ""),
      business_type: mapBusinessType(first(d.business_type, p.business_type)),
      current_phase: "ONBOARDING",
      am_owner: first(d.closer_name, p.closer_name, p.sales_supervisor, ""),
      main_contact_name: first(d.contact_name, d.owner_name, p.client_name, ""),
      main_contact_email: first(d.owner_email, p.email, ""),
      main_contact_phone: first(d.phone, d.owner_phone, p.phone, ""),
      offer_sold: first(d.offers_sold, ""),
      platforms_managed: first(d.platforms_to_manage, ""),
      lead_source: first(d.lead_source, p.lead_source, ""),
      deal_value: String(first(d.contract_value, p.deal_value, "")),
      monthly_retainer: String(first(d.monthly_amount, "")),
      closing_date: String(first(d.closing_date, p.closing_date, "")).slice(0, 10),
      launch_target_date: String(first(d.target_launch_date, "")).slice(0, 10),
      clickup_client_task_url: "",
      slack_channel: first(p.slack_channel_name, ""),
      drive_folder_url: first(p.drive_folder_url, ""),
      hub_url: "",
    });
    toast.success(`Préremplissage depuis ${row.origin === "onboarding" ? "l'onboarding" : "le deal fermé"}.`);
  };

  const onPickSource = (key: string) => {
    setSelectedKey(key);
    if (!key) return;
    const row = sources.find((s) => s.key === key);
    if (row) prefill(row);
  };

  const submit = async () => {
    if (!form.client_code.trim() || !form.company_name.trim()) {
      toast.error("Le code client et le nom de l'entreprise sont requis.");
      setStep(1);
      return;
    }
    setSaving(true);
    const payload: any = { ...form };
    ["deal_value","monthly_retainer"].forEach((k) => { payload[k] = payload[k] ? Number(payload[k]) : null; });
    ["closing_date","launch_target_date","website_url","industry","am_owner","main_contact_name",
     "main_contact_email","main_contact_phone","offer_sold","platforms_managed","lead_source",
     "clickup_client_task_url","slack_channel","drive_folder_url","hub_url"].forEach((k) => {
      if (!payload[k]) payload[k] = null;
    });
    const { data, error } = await supabase.from("gos_clients").insert(payload).select().single();
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setSelectedClient(data as any);
    toast.success("Client créé.");
    nav(`/admin/gos/clients/${data.id}/workspace`);
  };

  const canNext = () => {
    if (step === 1) return !!(form.client_code.trim() && form.company_name.trim());
    return true;
  };

  const next = () => {
    if (!canNext()) {
      toast.error("Code client et nom de l'entreprise sont requis.");
      return;
    }
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };
  const prev = () => setStep((s) => Math.max(0, s - 1));

  const pct = Math.round(((step + 1) / STEPS.length) * 100);

  return (
    <div>
      <SectionHeader
        title="Nouveau client"
        subtitle="Importe depuis un deal fermé ou l'onboarding pour éviter de tout réécrire."
        actions={
          <button type="button" className="gos-btn-secondary" onClick={() => nav("/admin/gos/clients")}>
            Annuler
          </button>
        }
      />

      {/* Stepper */}
      <div
        className="gos-card"
        style={{
          padding: 20,
          marginBottom: 20,
          background: "linear-gradient(135deg, rgba(255, 255, 255, 0.02) 0%, rgba(255, 255, 255, 0.02) 100%)",
          border: "1px solid rgba(255, 255, 255, 0.02)",
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${STEPS.length}, 1fr)`, gap: 12, alignItems: "start" }}>
          {STEPS.map((s, i) => {
            const done = i < step;
            const current = i === step;
            const Icon = s.Icon;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => i <= step && setStep(i)}
                disabled={i > step}
                style={{
                  all: "unset",
                  cursor: i <= step ? "pointer" : "not-allowed",
                  display: "grid",
                  gridTemplateColumns: "36px 1fr",
                  gap: 12,
                  alignItems: "center",
                  padding: 10,
                  borderRadius: 10,
                  background: current ? "rgba(77, 159, 255, 0.08)" : "transparent",
                  border: `1px solid ${current ? "var(--tdia-blue)" : "transparent"}`,
                  transition: "all .2s ease",
                }}
              >
                <div
                  style={{
                    width: 36, height: 36, borderRadius: 10,
                    display: "grid", placeItems: "center",
                    background: done || current ? "var(--tdia-blue)" : "rgba(255, 255, 255, 0.02)",
                    color: done || current ? "rgba(255, 255, 255, 0.02)" : "var(--tdia-muted)",
                    border: `2px solid ${done || current ? "var(--tdia-blue)" : "rgba(148, 170, 215, 0.12)"}`,
                  }}
                >
                  {done ? <Check size={18} strokeWidth={3} /> : <Icon size={16} />}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 10, color: "var(--tdia-muted)", fontWeight: 700, letterSpacing: "0.03em", textTransform: "uppercase" }}>
                    Étape {i + 1}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--tdia-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {s.title}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        <div style={{ marginTop: 14, height: 4, background: "rgba(255, 255, 255, 0.02)", borderRadius: 4, overflow: "hidden" }}>
          <div
            style={{
              width: `${pct}%`, height: "100%",
              background: "linear-gradient(90deg, var(--tdia-blue), #7ab7ff)",
              transition: "width .3s ease",
            }}
          />
        </div>
      </div>

      {/* Step content */}
      {step === 0 && (
        <div className="gos-card" style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <Download size={16} color="var(--tdia-blue)" />
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--tdia-text)" }}>
              Importer depuis un deal / onboarding existant
            </h3>
          </div>
          <div style={{ color: "var(--tdia-muted)", fontSize: 13, marginBottom: 16 }}>
            Sélectionne un client déjà présent dans <b>closed_deals</b> ou <b>client_progress</b>. Les champs communs seront préremplis — tu peux ensuite ajuster à chaque étape. Tu peux aussi passer cette étape et remplir manuellement.
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 }}>
            <div style={{ position: "relative" }}>
              <Search size={14} style={{ position: "absolute", left: 10, top: 12, color: "var(--tdia-muted)" }} />
              <input
                className="gos-input"
                placeholder="Chercher un client…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ paddingLeft: 30 }}
              />
            </div>
            <select className="gos-select" value={selectedKey} onChange={(e) => onPickSource(e.target.value)}>
              <option value="">— Choisir une source —</option>
              {filtered.map((s) => {
                const already = existingCodes.has(s.key);
                return (
                  <option key={s.key} value={s.key} disabled={already}>
                    [{s.origin === "onboarding" ? "ONBOARDING" : "DEAL"}] {s.label}{already ? " (déjà créé)" : ""}
                  </option>
                );
              })}
            </select>
          </div>
          {sources.length === 0 && (
            <div style={{ color: "var(--tdia-muted)", fontSize: 12, marginTop: 10 }}>
              Aucune source disponible. Crée d'abord un deal fermé ou complète un onboarding.
            </div>
          )}
          {selectedKey && (
            <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: "rgba(77, 159, 255, 0.08)", border: "1px solid rgba(77, 159, 255, 0.25)", color: "var(--tdia-text)", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
              <Check size={14} color="var(--tdia-blue)" />
              Préremplissage appliqué — passe à l'étape suivante pour vérifier.
            </div>
          )}
        </div>
      )}

      {step === 1 && (
        <>
          <div className="gos-card" style={{ marginBottom: 20 }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 600, color: "var(--tdia-text)" }}>Identifiants</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
              <Field label="Code client" required>
                <input className="gos-input" value={form.client_code} onChange={(e) => set("client_code", e.target.value)} required />
              </Field>
              <Field label="Nom de l'entreprise" required>
                <input className="gos-input" value={form.company_name} onChange={(e) => set("company_name", e.target.value)} required />
              </Field>
            </div>
          </div>
          <div className="gos-card" style={{ marginBottom: 20 }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 600, color: "var(--tdia-text)" }}>Contexte client</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
              <Field label="URL du site"><input className="gos-input" value={form.website_url} onChange={(e) => set("website_url", e.target.value)} /></Field>
              <Field label="Secteur"><input className="gos-input" value={form.industry} onChange={(e) => set("industry", e.target.value)} /></Field>
              <Field label="Type d'activité">
                <select className="gos-select" value={form.business_type} onChange={(e) => set("business_type", e.target.value)}>
                  {BUSINESS_TYPES.filter((v) => v !== "AGENCE").map((v) => <option key={v} value={v}>{v.replace("_"," ")}</option>)}
                </select>
              </Field>
              <Field label="Phase actuelle">
                <select className="gos-select" value={form.current_phase} onChange={(e) => set("current_phase", e.target.value)}>
                  {PHASES.map((v) => <option key={v} value={v}>{v.replace(/_/g," ")}</option>)}
                </select>
              </Field>
              <Field label="Responsable AM"><input className="gos-input" value={form.am_owner} onChange={(e) => set("am_owner", e.target.value)} /></Field>
            </div>
          </div>
        </>
      )}

      {step === 2 && (
        <div className="gos-card" style={{ marginBottom: 20 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 600, color: "var(--tdia-text)" }}>Contact & commercial</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
            <Field label="Nom du contact principal"><input className="gos-input" value={form.main_contact_name} onChange={(e) => set("main_contact_name", e.target.value)} /></Field>
            <Field label="Email du contact principal"><input type="email" className="gos-input" value={form.main_contact_email} onChange={(e) => set("main_contact_email", e.target.value)} /></Field>
            <Field label="Téléphone du contact principal"><input className="gos-input" value={form.main_contact_phone} onChange={(e) => set("main_contact_phone", e.target.value)} /></Field>
            <Field label="Offre vendue"><input className="gos-input" value={form.offer_sold} onChange={(e) => set("offer_sold", e.target.value)} /></Field>
            <Field label="Plateformes gérées"><input className="gos-input" value={form.platforms_managed} onChange={(e) => set("platforms_managed", e.target.value)} placeholder="Meta, Google, TikTok…" /></Field>
            <Field label="Source du lead"><input className="gos-input" value={form.lead_source} onChange={(e) => set("lead_source", e.target.value)} /></Field>
            <Field label="Valeur du deal"><input type="number" className="gos-input" value={form.deal_value} onChange={(e) => set("deal_value", e.target.value)} /></Field>
            <Field label="Rétainer mensuel"><input type="number" className="gos-input" value={form.monthly_retainer} onChange={(e) => set("monthly_retainer", e.target.value)} /></Field>
            <Field label="Date de closing"><input type="date" className="gos-input" value={form.closing_date} onChange={(e) => set("closing_date", e.target.value)} /></Field>
            <Field label="Date cible de lancement"><input type="date" className="gos-input" value={form.launch_target_date} onChange={(e) => set("launch_target_date", e.target.value)} /></Field>
          </div>
        </div>
      )}

      {step === 3 && (
        <>
          <div className="gos-card" style={{ marginBottom: 20 }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 600, color: "var(--tdia-text)" }}>Liens & outils</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
              <Field label="URL tâche ClickUp"><input className="gos-input" value={form.clickup_client_task_url} onChange={(e) => set("clickup_client_task_url", e.target.value)} /></Field>
              <Field label="Canal Slack"><input className="gos-input" value={form.slack_channel} onChange={(e) => set("slack_channel", e.target.value)} /></Field>
              <Field label="URL dossier Drive"><input className="gos-input" value={form.drive_folder_url} onChange={(e) => set("drive_folder_url", e.target.value)} /></Field>
              <Field label="URL du hub"><input className="gos-input" value={form.hub_url} onChange={(e) => set("hub_url", e.target.value)} /></Field>
            </div>
          </div>

          {/* Review */}
          <div className="gos-card" style={{ marginBottom: 20, borderLeft: "4px solid var(--tdia-blue)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <ClipboardCheck size={16} color="var(--tdia-blue)" />
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--tdia-text)" }}>Récapitulatif</h3>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, fontSize: 13 }}>
              {[
                ["Code client", form.client_code || "—"],
                ["Entreprise", form.company_name || "—"],
                ["Type", form.business_type.replace("_", " ")],
                ["Phase", form.current_phase.replace(/_/g, " ")],
                ["AM", form.am_owner || "—"],
                ["Contact", form.main_contact_name || "—"],
                ["Email", form.main_contact_email || "—"],
                ["Deal", form.deal_value ? `${form.deal_value} €` : "—"],
                ["Rétainer", form.monthly_retainer ? `${form.monthly_retainer} €/mois` : "—"],
              ].map(([k, v]) => (
                <div key={k as string} style={{ padding: 10, borderRadius: 8, background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.02)" }}>
                  <div style={{ fontSize: 10, color: "var(--tdia-muted)", fontWeight: 700, letterSpacing: "0.03em", textTransform: "uppercase" }}>{k}</div>
                  <div style={{ color: "var(--tdia-text)", marginTop: 4, fontWeight: 500 }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Sticky nav */}
      <div
        style={{
          position: "sticky", bottom: 0,
          display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
          padding: "14px 18px", marginTop: 8,
          background: "hsl(0 0% 98.8% / 0.92)",
          backdropFilter: "blur(8px)",
          border: "1px solid rgba(255, 255, 255, 0.02)",
          borderRadius: 12,
        }}
      >
        <div style={{ fontSize: 12, color: "var(--tdia-muted)" }}>
          Étape <span style={{ color: "var(--tdia-text)", fontWeight: 600 }}>{step + 1}</span> sur {STEPS.length} · {STEPS[step].desc}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            className="gos-btn-secondary"
            onClick={prev}
            disabled={step === 0}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <ArrowLeft size={14} /> Précédent
          </button>
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              className="gos-btn-primary"
              onClick={next}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              Suivant <ArrowRight size={14} />
            </button>
          ) : (
            <button
              type="button"
              className="gos-btn-primary"
              onClick={submit}
              disabled={saving}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <Check size={14} /> {saving ? "Enregistrement…" : "Créer le client"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
