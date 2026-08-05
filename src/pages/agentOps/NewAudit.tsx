// Nouvel audit — POST /audits { client_name, onboarding, options }.
// L'onboarding est un dict libre cote backend ; on collecte ici uniquement les
// champs utilises par le pipeline (nom_entreprise, site_web, competiteurs) et
// les options utiles (country, max_reviews).

import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { tdia } from "@/agentOps/service";
import { trackRun } from "@/agentOps/trackedRuns";
import { BackendErrorBanner } from "@/components/agentOps/Primitives";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Loader2, Rocket } from "lucide-react";

const COUNTRIES = [
  { value: "CA", label: "Canada" },
  { value: "US", label: "United States" },
  { value: "FR", label: "France" },
  { value: "GB", label: "United Kingdom" },
];

export default function NewAudit() {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const prefillClient = sp.get("client") ?? "";

  const [name, setName] = useState(prefillClient);
  const [website, setWebsite] = useState("");
  const [competiteurs, setCompetiteurs] = useState("");
  const [country, setCountry] = useState("CA");
  const [maxReviews, setMaxReviews] = useState("500");
  const [err, setErr] = useState<string>();
  const [busy, setBusy] = useState(false);

  function normalizeUrl(u: string): string {
    const t = u.trim();
    if (!t) return "";
    return /^https?:\/\//i.test(t) ? t : `https://${t}`;
  }

  function validate(): string | null {
    if (!name.trim()) return "Le nom de l'entreprise est requis.";
    if (!website.trim()) return "L'URL du site est requise.";
    try { new URL(normalizeUrl(website)); } catch { return "URL invalide."; }
    const n = Number(maxReviews);
    if (!Number.isFinite(n) || n < 10) return "max_reviews doit etre ≥ 10.";
    return null;
  }

  async function submit() {
    setErr(undefined);
    const v = validate();
    if (v) { setErr(v); return; }
    setBusy(true);
    try {
      const res = await tdia.createAudit({
        client_name: name.trim(),
        onboarding: {
          nom_entreprise: name.trim(),
          site_web: normalizeUrl(website),
          competiteurs: competiteurs.trim(),
        },
        options: {
          country,
          max_reviews: Number(maxReviews),
        },
      });
      trackRun(res.client, res.audit_id);
      nav(`/admin/ops/run/${encodeURIComponent(res.client)}/${encodeURIComponent(res.audit_id)}`);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 space-y-6">
      <Link
        to="/admin/ops"
        className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Retour aux audits
      </Link>

      <div>
        <h1 className="text-[22px] font-semibold tracking-tight">Nouvel audit</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Lance le pipeline <span className="font-mono text-[12px]">tdia-audit</span> : collecte des sources publiques
          (Trustpilot, Reddit, YouTube, Meta Ads, Google Maps…) puis consolidation en{" "}
          <span className="font-mono text-[12px]">reviews.xlsx</span> (upload IA) et{" "}
          <span className="font-mono text-[12px]">audit_data.xlsx</span> (AM).
        </p>
      </div>

      {err && <BackendErrorBanner message={err} />}

      <Card className="glass-card p-5 space-y-4">
        <div>
          <Label htmlFor="name">Nom de l'entreprise *</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Acme Corp"
            className="mt-1.5"
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            Sert de slug (dossier) cote backend et de nom d'affichage dans la liste.
          </p>
        </div>

        <div>
          <Label htmlFor="website">URL du site *</Label>
          <Input
            id="website"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://exemple.com"
            className="mt-1.5"
          />
        </div>

        <div>
          <Label htmlFor="competiteurs">Compétiteurs (optionnel)</Label>
          <Textarea
            id="competiteurs"
            value={competiteurs}
            onChange={(e) => setCompetiteurs(e.target.value)}
            placeholder="attitude.com, oneka.ca, sappho.co"
            rows={2}
            className="mt-1.5"
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            Domaines ou noms séparés par virgules — utilisés pour orienter la collecte publicités / verbatims.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-3 pt-1">
          <div>
            <Label>Pays (Google Maps)</Label>
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                {COUNTRIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="max_reviews">Max reviews / source</Label>
            <Input
              id="max_reviews"
              type="number"
              min={10}
              max={5000}
              value={maxReviews}
              onChange={(e) => setMaxReviews(e.target.value)}
              className="mt-1.5 font-mono"
            />
          </div>
        </div>

        <div className="pt-2 flex items-center justify-between gap-3">
          <div className="text-[11px] text-muted-foreground">
            Le run est enfilé dans Redis Queue puis exécuté par le worker (~10–30 min selon les sources).
          </div>
          <Button onClick={submit} disabled={busy} size="lg">
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Rocket className="h-4 w-4 mr-2" />}
            Lancer l'audit
          </Button>
        </div>
      </Card>
    </div>
  );
}
