import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle, Send } from "lucide-react";

type ManualPulseType = "onboarding" | "monthly";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultClientCode?: string | null;
  onSent?: (clientCode: string, type: ManualPulseType) => void;
}

interface ClientOption {
  client_code: string;
  client_name: string | null;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  archived_at: string | null;
  completed_at: string | null;
}

// Modal : lance un pulse manuel (onboarding ou monthly) sur un client.
// Appelle l'edge function pulse-send avec {manual:true}. Rappelle à l'admin
// que le workflow de suivi automatique (relance J+1, escalade J+2) s'active
// pareil qu'un envoi cron.
export function SendManualPulseDialog({ open, onOpenChange, defaultClientCode, onSent }: Props) {
  const [clients, setClients] = useState<ClientOption[] | null>(null);
  const [loadingClients, setLoadingClients] = useState(false);
  const [selectedCode, setSelectedCode] = useState<string>(defaultClientCode ?? "");
  const [type, setType] = useState<ManualPulseType>("monthly");
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setSelectedCode(defaultClientCode ?? "");
  }, [defaultClientCode, open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoadingClients(true);
      const { data, error } = await supabase
        .from("client_progress")
        .select("client_code, client_name, company_name, email, phone, archived_at, completed_at")
        .is("archived_at", null)
        .order("client_name", { ascending: true })
        .limit(500);
      if (cancelled) return;
      if (error) {
        toast.error("Impossible de charger la liste des clients");
        setClients([]);
      } else {
        setClients((data ?? []) as ClientOption[]);
      }
      setLoadingClients(false);
    })();
    return () => { cancelled = true; };
  }, [open]);

  const filteredClients = useMemo(() => {
    if (!clients) return [];
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) => {
      const haystack = `${c.client_code} ${c.client_name ?? ""} ${c.company_name ?? ""}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [clients, search]);

  const selectedClient = useMemo(
    () => clients?.find((c) => c.client_code === selectedCode) ?? null,
    [clients, selectedCode],
  );

  const canSend = !!selectedClient && (!!selectedClient.email || !!selectedClient.phone);

  const submit = async () => {
    if (!selectedClient) return;
    if (!canSend) {
      toast.error("Ce client n'a ni email ni téléphone — impossible d'envoyer.");
      return;
    }
    setSubmitting(true);
    const tId = toast.loading("Envoi du pulse…");
    try {
      const { data, error } = await supabase.functions.invoke("pulse-send", {
        body: {
          type,
          manual: true,
          client_code: selectedClient.client_code,
          created_by: "admin_manual",
        },
      });
      toast.dismiss(tId);
      if (error) {
        toast.error(error.message || "Échec de l'envoi");
        return;
      }
      const d = data as any;
      if (d?.error) {
        toast.error(d.error);
        return;
      }
      const first = d?.outcomes?.[0];
      if (first?.error) {
        toast.error(`Envoi partiel — ${first.error}`);
      } else {
        const chans: string[] = [];
        if (first?.email_sent) chans.push("email");
        if (first?.sms_sent) chans.push("SMS");
        toast.success(
          chans.length
            ? `Pulse ${type} envoyé (${chans.join(" + ")}). Suivi J+1/J+2 actif.`
            : `Pulse ${type} créé mais aucun canal envoyé.`,
        );
      }
      onSent?.(selectedClient.client_code, type);
      onOpenChange(false);
    } catch (e: any) {
      toast.dismiss(tId);
      toast.error(e?.message || "Erreur inattendue");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Envoyer un pulse manuellement</DialogTitle>
          <DialogDescription>
            Force l'envoi immédiat d'un pulse à un client — bypass des règles anti-dédup du cron.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 p-3 flex gap-2 items-start text-xs">
            <AlertCircle className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
            <div className="text-orange-100/90">
              Le workflow de suivi automatique s'active exactement comme un envoi cron :
              relance email + SMS à J+1, escalade Slack #head-of-things à J+2.
            </div>
          </div>

          <div>
            <Label className="text-sm mb-2 block">Type de pulse</Label>
            <Select value={type} onValueChange={(v: any) => setType(v)} disabled={submitting}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Pulse mensuel</SelectItem>
                <SelectItem value="onboarding">Onboarding J+7</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground mt-1">
              Pour le NPS relationnel, utilise plutôt le bouton "Logger NPS" sur la fiche client.
            </p>
          </div>

          <div>
            <Label className="text-sm mb-2 block">Client</Label>
            <Input
              placeholder="Chercher par code, nom, entreprise…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              disabled={submitting}
              className="mb-2"
            />
            <Select value={selectedCode} onValueChange={setSelectedCode} disabled={submitting || loadingClients}>
              <SelectTrigger>
                <SelectValue placeholder={loadingClients ? "Chargement…" : "Choisir un client"} />
              </SelectTrigger>
              <SelectContent className="max-h-[260px]">
                {filteredClients.length === 0 && (
                  <div className="px-2 py-2 text-xs text-muted-foreground">Aucun client trouvé</div>
                )}
                {filteredClients.map((c) => {
                  const label = c.company_name || c.client_name || c.client_code;
                  const canReach = !!c.email || !!c.phone;
                  return (
                    <SelectItem key={c.client_code} value={c.client_code}>
                      <span className={canReach ? "" : "text-muted-foreground"}>
                        {label} <span className="opacity-60">· {c.client_code}</span>
                        {!canReach && " · (aucun canal)"}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {selectedClient && (
              <div className="mt-2 text-[11px] text-muted-foreground space-x-2">
                <span>Email : {selectedClient.email ? "✓" : "—"}</span>
                <span>SMS : {selectedClient.phone ? "✓" : "—"}</span>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Annuler
          </Button>
          <Button onClick={submit} disabled={submitting || !canSend}>
            {submitting ? "Envoi…" : <><Send className="h-4 w-4 mr-2" /> Envoyer maintenant</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
