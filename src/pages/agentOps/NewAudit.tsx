import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { tdia } from "@/agentOps/service";
import { pickRunId } from "@/agentOps/runId";
import { trackRun } from "@/agentOps/trackedRuns";
import { BackendErrorBanner, SectionHeader } from "@/components/agentOps/Primitives";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Rocket } from "lucide-react";

const VERTICALS = [
  "ecommerce_product",
  "ecommerce_brand",
  "saas",
  "services",
  "marketplace",
  "content_creator",
  "other",
];

const LANGUAGES = [
  { value: "fr", label: "Français" },
  { value: "en", label: "English" },
];

const MODES = [
  { value: "production-fresh", label: "Production · fresh (collecte complète)" },
  { value: "production", label: "Production · standard" },
  { value: "validation", label: "Validation (test)" },
];

function slugify(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 48);
}

export default function NewAudit() {
  const nav = useNavigate();
  const [form, setForm] = useState({ name: "", website: "", vertical: "ecommerce_product", language: "fr" });
  const [mode, setMode] = useState("production-fresh");
  const [err, setErr] = useState<string>();
  const [busy, setBusy] = useState(false);

  function validate(): string | null {
    if (!form.name.trim()) return "Le nom de l'entreprise est requis.";
    if (!form.website.trim()) return "L'URL du site est requise.";
    try { new URL(form.website.startsWith("http") ? form.website : `https://${form.website}`); }
    catch { return "URL invalide."; }
    if (!form.vertical) return "Le secteur est requis.";
    return null;
  }

  async function submit() {
    const v = validate();
    if (v) { setErr(v); return; }
    setBusy(true); setErr(undefined);
    try {
      const website = form.website.startsWith("http") ? form.website : `https://${form.website}`;
      const clientId = slugify(form.name);
      const client = await tdia.createClient({
        client_id: clientId,
        name: form.name,
        website,
        vertical: form.vertical,
        language: form.language,
      });
      const cId = (client as { id?: string }).id || clientId;
      const run = await tdia.createRun(cId, { workflow: "full-prelaunch", mode });
      const runId = pickRunId(run);
      if (!runId) throw new Error("Le backend n'a pas retourné d'ID de run valide.");
      trackRun(runId);
      nav(`/admin/ops/run/${runId}`);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <SectionHeader title="Nouvel audit" subtitle="Crée le client si nécessaire et lance le run immédiatement." />
      {err && <BackendErrorBanner message={err} />}
      <Card className="glass-card p-5 space-y-4">
        <div>
          <Label htmlFor="name">Nom de l'entreprise *</Label>
          <Input id="name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Acme Corp" />
        </div>
        <div>
          <Label htmlFor="website">URL du site *</Label>
          <Input id="website" value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} placeholder="https://exemple.com" />
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label>Secteur *</Label>
            <Select value={form.vertical} onValueChange={v => setForm({ ...form, vertical: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{VERTICALS.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Langue</Label>
            <Select value={form.language} onValueChange={v => setForm({ ...form, language: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{LANGUAGES.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label>Mode</Label>
          <Select value={mode} onValueChange={setMode}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{MODES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="pt-2 flex justify-end">
          <Button onClick={submit} disabled={busy} size="lg">
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Rocket className="h-4 w-4 mr-2" />}
            Lancer l'audit
          </Button>
        </div>
      </Card>
    </div>
  );
}
