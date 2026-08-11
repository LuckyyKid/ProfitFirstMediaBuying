import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { BusinessType, LeadStatus, SalesLead, SalesRep } from "@/hooks/useSalesLeads";
import { Trash2 } from "lucide-react";

interface Props {
  lead: SalesLead | null;
  reps: SalesRep[];
  onClose: () => void;
  onSaved: () => void;
}

const STATUS_OPTIONS: { value: LeadStatus; label: string }[] = [
  { value: "new", label: "Nouveau" },
  { value: "contacted", label: "Contacté" },
  { value: "qualified", label: "Qualifié" },
  { value: "proposal", label: "Proposition" },
  { value: "won", label: "Gagné" },
  { value: "lost", label: "Perdu" },
];

const BUSINESS_TYPES: { value: BusinessType; label: string }[] = [
  { value: "saas", label: "SaaS" },
  { value: "ecom", label: "E-commerce" },
  { value: "service", label: "Service" },
  { value: "other", label: "Autre" },
];

const SOURCE_SUGGESTIONS = [
  "Instagram",
  "TikTok",
  "LinkedIn",
  "Referral",
  "Cold DM",
  "Cold email",
  "Event",
  "Website",
  "Autre",
];

function toDateInput(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

function fromDateInput(v: string): string | null {
  if (!v) return null;
  return new Date(v + "T12:00:00").toISOString();
}

export const LeadDialog = ({ lead, reps, onClose, onSaved }: Props) => {
  const isEdit = !!lead;
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({
    first_name: lead?.first_name ?? "",
    last_name: lead?.last_name ?? "",
    company: lead?.company ?? "",
    industry: lead?.industry ?? "",
    business_type: (lead?.business_type ?? "") as BusinessType | "",
    email: lead?.email ?? "",
    phone: lead?.phone ?? "",
    source: lead?.source ?? "",
    status: (lead?.status ?? "new") as LeadStatus,
    qualification_score: lead?.qualification_score ?? null,
    owner_id: lead?.owner_id ?? "",
    onboarding_booked_at: toDateInput(lead?.onboarding_booked_at ?? null),
    next_followup_at: toDateInput(lead?.next_followup_at ?? null),
    notes: lead?.notes ?? "",
    converted_client_code: lead?.converted_client_code ?? "",
    responded: !!lead?.responded_at,
  });

  useEffect(() => {
    if (lead) {
      setForm({
        first_name: lead.first_name ?? "",
        last_name: lead.last_name ?? "",
        company: lead.company ?? "",
        industry: lead.industry ?? "",
        business_type: (lead.business_type ?? "") as BusinessType | "",
        email: lead.email ?? "",
        phone: lead.phone ?? "",
        source: lead.source ?? "",
        status: lead.status,
        qualification_score: lead.qualification_score,
        owner_id: lead.owner_id ?? "",
        onboarding_booked_at: toDateInput(lead.onboarding_booked_at),
        next_followup_at: toDateInput(lead.next_followup_at),
        notes: lead.notes ?? "",
        converted_client_code: lead.converted_client_code ?? "",
        responded: !!lead.responded_at,
      });
    }
  }, [lead]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setSaving(true);
    const payload: Record<string, unknown> = {
      first_name: form.first_name.trim() || null,
      last_name: form.last_name.trim() || null,
      company: form.company.trim() || null,
      industry: form.industry.trim() || null,
      business_type: form.business_type || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      source: form.source.trim() || null,
      status: form.status,
      qualification_score: form.qualification_score,
      owner_id: form.owner_id || null,
      onboarding_booked_at: fromDateInput(form.onboarding_booked_at),
      next_followup_at: fromDateInput(form.next_followup_at),
      notes: form.notes.trim() || null,
      converted_client_code: form.converted_client_code.trim() || null,
    };
    if (form.status === "won" && !lead?.converted_at) {
      payload.converted_at = new Date().toISOString();
    }
    if (form.responded && !lead?.responded_at) {
      payload.responded_at = new Date().toISOString();
    } else if (!form.responded && lead?.responded_at) {
      payload.responded_at = null;
    }

    let error: { message?: string } | null = null;
    if (isEdit && lead) {
      const res = await supabase
        .from("sales_leads" as any)
        .update(payload)
        .eq("lead_code", lead.lead_code);
      error = res.error;
    } else {
      const res = await supabase.from("sales_leads" as any).insert(payload);
      error = res.error;
    }
    setSaving(false);
    if (error) {
      toast.error(error.message || "Échec de l'enregistrement du lead");
      return;
    }
    toast.success(isEdit ? "Lead mis à jour" : "Lead créé");
    onSaved();
  };

  const remove = async () => {
    if (!lead) return;
    if (!confirm(`Supprimer le lead ${lead.lead_code} ? Cette action est irréversible.`))
      return;
    setDeleting(true);
    const { error } = await supabase
      .from("sales_leads" as any)
      .delete()
      .eq("lead_code", lead.lead_code);
    setDeleting(false);
    if (error) {
      toast.error(error.message || "Échec de la suppression");
      return;
    }
    toast.success("Lead supprimé");
    onSaved();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? (
              <span className="flex items-center gap-2">
                <span>Lead</span>
                <span className="font-mono text-sm text-muted-foreground">
                  {lead?.lead_code}
                </span>
              </span>
            ) : (
              "Nouveau lead"
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Prénom">
            <Input value={form.first_name} onChange={(e) => set("first_name", e.target.value)} />
          </Field>
          <Field label="Nom">
            <Input value={form.last_name} onChange={(e) => set("last_name", e.target.value)} />
          </Field>
          <Field label="Entreprise">
            <Input value={form.company} onChange={(e) => set("company", e.target.value)} />
          </Field>
          <Field label="Industrie">
            <Input value={form.industry} onChange={(e) => set("industry", e.target.value)} />
          </Field>
          <Field label="Type d'entreprise">
            <Select
              value={form.business_type || "__none"}
              onValueChange={(v) =>
                set("business_type", v === "__none" ? "" : (v as BusinessType))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">—</SelectItem>
                {BUSINESS_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Email">
            <Input
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </Field>
          <Field label="Téléphone">
            <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </Field>
          <Field label="Source">
            <Select value={form.source || "__none"} onValueChange={(v) => set("source", v === "__none" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">—</SelectItem>
                {SOURCE_SUGGESTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Statut">
            <Select value={form.status} onValueChange={(v) => set("status", v as LeadStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Qualification (1-5)">
            <Select
              value={form.qualification_score ? String(form.qualification_score) : "__none"}
              onValueChange={(v) =>
                set("qualification_score", v === "__none" ? null : Number(v))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">—</SelectItem>
                {[1, 2, 3, 4, 5].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Vendeur">
            <Select
              value={form.owner_id || "__none"}
              onValueChange={(v) => set("owner_id", v === "__none" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Non assigné</SelectItem>
                {reps
                  .filter((r) => r.active)
                  .map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Onboarding booké le">
            <Input
              type="date"
              value={form.onboarding_booked_at}
              onChange={(e) => set("onboarding_booked_at", e.target.value)}
            />
          </Field>
          <Field label="Prochaine relance">
            <Input
              type="date"
              value={form.next_followup_at}
              onChange={(e) => set("next_followup_at", e.target.value)}
            />
          </Field>
          <Field label="Code client (si converti)" className="sm:col-span-2">
            <Input
              value={form.converted_client_code}
              onChange={(e) => set("converted_client_code", e.target.value)}
              placeholder="CLI-XXXXXXXX"
            />
          </Field>
          <div className="sm:col-span-2 flex items-start gap-2 rounded-md border border-border/40 bg-muted/20 px-3 py-2">
            <Checkbox
              id="lead-responded"
              checked={form.responded}
              onCheckedChange={(v) => set("responded", v === true)}
              className="mt-0.5"
            />
            <div className="flex-1">
              <Label htmlFor="lead-responded" className="text-sm font-medium cursor-pointer">
                Le client a répondu
              </Label>
              <p className="text-xs text-muted-foreground">
                Coche cette case pour stopper la séquence de relances automatiques (max 6 relances toutes les 24 h).
                {lead?.followup_count ? ` Relances envoyées : ${lead.followup_count}/6.` : ""}
              </p>
            </div>
          </div>
          <Field label="Notes" className="sm:col-span-2">
            <Textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={4}
            />
          </Field>
        </div>

        <DialogFooter className="flex justify-between">
          <div>
            {isEdit && (
              <Button variant="ghost" size="sm" onClick={remove} disabled={deleting}>
                <Trash2 className="h-4 w-4 mr-2" /> Supprimer
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Annuler
            </Button>
            <Button onClick={submit} disabled={saving}>
              {saving ? "Enregistrement…" : isEdit ? "Enregistrer" : "Créer le lead"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const Field = ({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) => (
  <div className={`space-y-1 ${className ?? ""}`}>
    <Label className="text-xs text-muted-foreground">{label}</Label>
    {children}
  </div>
);
