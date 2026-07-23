// src/pages/agentOps/NewAudit.tsx
//
// Deux modes :
//  1. « Client existant » (par défaut) — combobox alimenté par tdia.listClients(),
//     recherche instantanée, aperçu du client sélectionné en lecture seule, puis
//     tdia.createRun(clientId, ...) direct — pas de recréation.
//  2. « Nouveau client » — formulaire complet (nom, URL, secteur, langue) qui
//     appelle createClient puis createRun.
//
// Le POST /api/v1/clients/{id}/runs déclenche immédiatement le pipeline
// tdia-audit côté backend (Agent Contexte → Collecte → VOC/CRO → Rapport).

import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { tdia } from "@/agentOps/service";
import { pickRunId } from "@/agentOps/runId";
import { trackRun } from "@/agentOps/trackedRuns";
import type { Client } from "@/agentOps/types";
import { BackendErrorBanner } from "@/components/agentOps/Primitives";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ArrowLeft, Check, ChevronsUpDown, Loader2, Rocket, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

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
  { value: "production",       label: "Production · standard" },
  { value: "validation",       label: "Validation (test)" },
];

function slugify(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 48);
}

// ── Combobox client existant ────────────────────────────────────────────────
function ClientCombobox({
  clients, value, onChange, loading,
}: {
  clients: Client[];
  value: string | null;
  onChange: (id: string) => void;
  loading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = value ? clients.find((c) => c.id === value) : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="w-full flex items-center justify-between gap-2 h-10 px-3 rounded-md border border-input bg-background text-left text-sm hover:bg-accent/50 transition-colors"
        >
          <span className={cn("truncate", !selected && "text-muted-foreground")}>
            {loading
              ? "Chargement des clients…"
              : selected
                ? selected.name
                : clients.length === 0
                  ? "Aucun client — utilise l'onglet Nouveau"
                  : "Sélectionner un client…"}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
        <Command>
          <CommandInput placeholder="Rechercher par nom, URL, secteur…" />
          <CommandList>
            <CommandEmpty>Aucun résultat.</CommandEmpty>
            <CommandGroup>
              {clients.map((c) => {
                const searchable = [c.name, c.website ?? "", c.vertical ?? ""].join(" ");
                return (
                  <CommandItem
                    key={c.id}
                    value={searchable}
                    onSelect={() => { onChange(c.id); setOpen(false); }}
                    className="flex items-start gap-2"
                  >
                    <Check className={cn("h-4 w-4 mt-0.5", value === c.id ? "opacity-100" : "opacity-0")} />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{c.name}</div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {[c.website, c.vertical].filter(Boolean).join(" · ") || c.id}
                      </div>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────
export default function NewAudit() {
  const nav = useNavigate();
  const [tab, setTab] = useState<"existing" | "new">("existing");
  const [mode, setMode] = useState("production-fresh");
  const [err, setErr] = useState<string>();
  const [busy, setBusy] = useState(false);

  // Existing
  const [clientId, setClientId] = useState<string | null>(null);

  // New
  const [form, setForm] = useState({ name: "", website: "", vertical: "ecommerce_product", language: "fr" });

  const clientsQ = useQuery({
    queryKey: ["clients"],
    queryFn: () => tdia.listClients(),
    staleTime: 30_000,
  });
  const clients = useMemo(() => clientsQ.data ?? [], [clientsQ.data]);
  const selectedClient = useMemo(() => clients.find((c) => c.id === clientId), [clients, clientId]);

  function validateNew(): string | null {
    if (!form.name.trim())    return "Le nom de l'entreprise est requis.";
    if (!form.website.trim()) return "L'URL du site est requise.";
    try { new URL(form.website.startsWith("http") ? form.website : `https://${form.website}`); }
    catch { return "URL invalide."; }
    if (!form.vertical)       return "Le secteur est requis.";
    return null;
  }

  async function launch(cId: string) {
    const run = await tdia.createRun(cId, { workflow: "full-prelaunch", mode });
    const runId = pickRunId(run);
    if (!runId) throw new Error("Le backend n'a pas retourné d'ID de run valide.");
    trackRun(runId);
    nav(`/admin/ops/run/${runId}`);
  }

  async function submit() {
    setErr(undefined);
    if (tab === "existing") {
      if (!clientId) { setErr("Sélectionne un client existant ou passe à l'onglet Nouveau."); return; }
      setBusy(true);
      try { await launch(clientId); }
      catch (e) { setErr((e as Error).message); }
      finally  { setBusy(false); }
      return;
    }

    // New client
    const v = validateNew();
    if (v) { setErr(v); return; }
    setBusy(true);
    try {
      const website = form.website.startsWith("http") ? form.website : `https://${form.website}`;
      const slug = slugify(form.name);
      const created = await tdia.createClient({
        client_id: slug,
        name: form.name,
        website,
        vertical: form.vertical,
        language: form.language,
      });
      const cId = (created as { id?: string }).id || slug;
      await launch(cId);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const listErr = clientsQ.error instanceof Error ? clientsQ.error.message : undefined;

  return (
    <div className="max-w-2xl mx-auto px-10 py-10 space-y-6">
      <Link
        to="/admin/ops"
        className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Retour aux audits
      </Link>
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight">Nouvel audit</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Lance immédiatement le pipeline <span className="font-mono text-[12px]">tdia-audit</span> (contexte → collecte → VOC/CRO → rapport). Sélectionne un client existant ou crée-en un nouveau.
        </p>
      </div>

      {err && <BackendErrorBanner message={err} />}
      {listErr && tab === "existing" && <BackendErrorBanner message={`Impossible de charger la liste des clients : ${listErr}`} />}

      <Card className="glass-card p-5 space-y-5">
        <Tabs value={tab} onValueChange={(v) => setTab(v as "existing" | "new")}>
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="existing">Client existant {clients.length > 0 && <span className="ml-2 text-[10px] font-mono opacity-70">{clients.length}</span>}</TabsTrigger>
            <TabsTrigger value="new">Nouveau client</TabsTrigger>
          </TabsList>

          {/* — Existant — */}
          <TabsContent value="existing" className="mt-5 space-y-4">
            <div>
              <Label>Client</Label>
              <div className="mt-1.5">
                <ClientCombobox
                  clients={clients}
                  value={clientId}
                  onChange={setClientId}
                  loading={clientsQ.isLoading}
                />
              </div>
            </div>

            {selectedClient && (
              <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3 space-y-1.5">
                <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Aperçu</div>
                <div className="text-sm font-medium">{selectedClient.name}</div>
                {selectedClient.website && (
                  <a
                    href={selectedClient.website}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-[12px] text-sky-300 hover:text-sky-200"
                  >
                    <Globe className="h-3 w-3" /> {selectedClient.website}
                  </a>
                )}
                {selectedClient.vertical && (
                  <div className="text-[11px] text-muted-foreground">
                    Secteur : <span className="font-mono">{selectedClient.vertical}</span>
                  </div>
                )}
                <div className="text-[10px] font-mono text-muted-foreground opacity-60">{selectedClient.id}</div>
              </div>
            )}
          </TabsContent>

          {/* — Nouveau — */}
          <TabsContent value="new" className="mt-5 space-y-4">
            <div>
              <Label htmlFor="name">Nom de l'entreprise *</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Acme Corp" />
            </div>
            <div>
              <Label htmlFor="website">URL du site *</Label>
              <Input id="website" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://exemple.com" />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>Secteur *</Label>
                <Select value={form.vertical} onValueChange={(v) => setForm({ ...form, vertical: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{VERTICALS.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Langue</Label>
                <Select value={form.language} onValueChange={(v) => setForm({ ...form, language: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{LANGUAGES.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="border-t border-white/5 pt-4">
          <Label>Mode</Label>
          <Select value={mode} onValueChange={setMode}>
            <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
            <SelectContent>{MODES.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>

        <div className="pt-2 flex items-center justify-between gap-3">
          <div className="text-[11px] text-muted-foreground">
            {tab === "existing"
              ? "Le run démarre sur le client sélectionné. Aucun doublon créé."
              : "Le client sera créé puis l'audit sera lancé immédiatement."}
          </div>
          <Button onClick={submit} disabled={busy || (tab === "existing" && !clientId)} size="lg">
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Rocket className="h-4 w-4 mr-2" />}
            Lancer l'audit
          </Button>
        </div>
      </Card>
    </div>
  );
}
