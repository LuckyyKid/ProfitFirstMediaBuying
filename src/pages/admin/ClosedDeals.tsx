import { useEffect, useMemo, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, ChevronDown, CreditCard, Download, ExternalLink, FileSignature, Plus, RefreshCw, Trash2, Upload } from "lucide-react";

type Deal = {
  id: string;
  company_name: string;
  contact_name: string | null;
  phone: string | null;
  payment_type: "one_time" | "recurring";
  contract_value: number | null;
  monthly_amount: number | null;
  additional_monthly: number | null;
  closing_date: string;
  closer_name: string;
  contract_pdf_path: string | null;
  owner_name: string | null;
  owner_business: string | null;
  owner_email: string | null;
  owner_phone: string | null;
  lead_source: string | null;
  engagement_duration: string | null;
  offers_sold: string[] | null;
  platforms_to_manage: string[] | null;
  main_objective: string | null;
  main_objections: string | null;
  target_launch_date: string | null;
  risk_level: "Low" | "Medium" | "High" | null;
  risk_reason: string | null;
  account_manager_notes: string | null;
  ad_budget_monthly: number | null;
  has_run_ads: boolean | null;
  owner_pain_point: string | null;
  client_code: string | null;
  stripe_payment_url: string | null;
  stripe_payment_link_id: string | null;
  stripe_payment_type: string | null;
  business_type: "ecommerce" | "local_service" | null;
  created_at: string;
};

// Generates a CLI-XXXXXXXX code (uppercase hex). Matches existing onboarding convention.
function generateClientCode(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
  return `CLI-${hex}`;
}


const LEAD_SOURCES = ["Cold call", "Cold email", "Ads", "Referral", "Organique", "Réactivation", "Autre"];
const DURATIONS = ["1 mois", "3 mois", "6 mois", "Sans engagement", "Autre"];
const OFFERS = ["Meta Ads", "Google Ads", "TikTok Ads", "Pack créatif", "Landing page", "Audit", "Consulting", "Gestion complète"];
const PLATFORMS = ["Meta Ads", "Google Ads", "TikTok Ads"];

const emptyForm = {
  company_name: "",
  contact_name: "",
  contact_email: "",
  phone: "",
  payment_type: "one_time" as "one_time" | "recurring",
  contract_value: "",
  monthly_amount: "",
  additional_monthly: "",
  closing_date: "",
  closer_name: "",
  business_type: "ecommerce" as "ecommerce" | "local_service",
  owner_same_as_contact: true,
  owner_name: "",
  owner_business: "",
  owner_email: "",
  owner_phone: "",
  lead_source: "",
  engagement_duration: "",
  offers_sold: [] as string[],
  platforms_to_manage: [] as string[],
  main_objective: "",
  main_objections: "",
  target_launch_date: "",
  risk_level: "" as "" | "Low" | "Medium" | "High",
  risk_reason: "",
  account_manager_notes: "",
  ad_budget_monthly: "",
  has_run_ads: "" as "" | "yes" | "no",
  owner_pain_point: "",
};

const ClosedDeals = () => {
  const { isAuthed } = useAdminAuth();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [visibleDealsCount, setVisibleDealsCount] = useState(10);


  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("closed_deals")
      .select("*")
      .order("closing_date", { ascending: false });
    if (error) toast.error(error.message);
    setDeals((data as Deal[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    if (isAuthed) load();
  }, [isAuthed]);

  if (!isAuthed) return <Navigate to="/admin/login" replace />;

  const toggle = (list: string[], value: string) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  const num = (v: string) => (v.trim() === "" ? null : Number(v));

  const submit = async () => {
    if (!form.company_name.trim()) return toast.error("Nom d'entreprise requis");
    if (!form.closing_date) return toast.error("Date de closing requise");
    if (!form.closer_name.trim()) return toast.error("Caller assigné requis");
    if (form.payment_type === "one_time" && !form.contract_value)
      return toast.error("Valeur du contrat requise");
    if (form.payment_type === "recurring" && !form.monthly_amount)
      return toast.error("Montant mensuel requis");

    // Résolution owner : si "signataire = owner" (par défaut), on réutilise
    // les champs Entreprise/Contact. Sinon on prend les champs Owner explicites.
    const same = form.owner_same_as_contact;
    const effOwnerName = (same ? form.contact_name : form.owner_name)?.trim() || "";
    const effOwnerBusiness = (same ? form.company_name : form.owner_business)?.trim() || "";
    const effOwnerEmail = (same ? form.contact_email : form.owner_email)?.trim() || "";
    const effOwnerPhone = (same ? form.phone : form.owner_phone)?.trim() || "";

    if (effOwnerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(effOwnerEmail)) {
      return toast.error("Adresse email invalide");
    }

    setSubmitting(true);
    try {
      let pdfPath: string | null = null;
      if (pdfFile) {
        const path = `${Date.now()}-${pdfFile.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const up = await supabase.storage.from("closed-deals-contracts").upload(path, pdfFile);
        if (up.error) throw up.error;
        pdfPath = up.data.path;
      }

      // 1) Create the client_progress entity so the deal is tied to an onboarding journey.
      const clientCode = generateClientCode();
      const dealValue =
        form.payment_type === "one_time"
          ? num(form.contract_value)
          : num(form.monthly_amount);

      const cpPayload: any = {
        client_code: clientCode,
        client_name: form.contact_name?.trim() || effOwnerName || null,
        company_name: form.company_name.trim(),
        brand_name: effOwnerBusiness || null,
        email: effOwnerEmail || null,
        phone: form.phone?.trim() || effOwnerPhone || null,
        closer_name: form.closer_name.trim(),
        closing_date: form.closing_date || null,
        deal_value: dealValue,
        lead_source: form.lead_source || null,
        ad_budget: num(form.ad_budget_monthly),
        already_runs_ads: form.has_run_ads === "" ? null : form.has_run_ads === "yes",
        internal_notes: form.account_manager_notes || null,
        business_type: form.business_type,
      };
      const { data: cpRow, error: cpErr } = await (supabase as any)
        .from("client_progress")
        .insert(cpPayload)
        .select("client_code, client_id")
        .single();
      if (cpErr) throw cpErr;
      const finalCode = cpRow?.client_code || clientCode;

      // NOTE: Slack channel setup runs once below in the Promise.allSettled block
      // (previously it was also invoked here, which created duplicate channels).



      // 2) Persist the deal linked by client_code.
      const payload = {
        company_name: form.company_name.trim(),
        contact_name: form.contact_name || null,
        phone: form.phone || null,
        payment_type: form.payment_type,
        contract_value: form.payment_type === "one_time" ? num(form.contract_value) : null,
        monthly_amount: form.payment_type === "recurring" ? num(form.monthly_amount) : null,
        additional_monthly:
          form.payment_type === "one_time" ? num(form.additional_monthly) : null,
        closing_date: form.closing_date,
        closer_name: form.closer_name.trim(),
        contract_pdf_path: pdfPath,
        owner_name: effOwnerName || null,
        owner_business: effOwnerBusiness || null,
        owner_email: effOwnerEmail || null,
        owner_phone: effOwnerPhone || null,
        lead_source: form.lead_source || null,
        engagement_duration: form.engagement_duration || null,
        offers_sold: form.offers_sold,
        platforms_to_manage: form.platforms_to_manage,
        main_objective: form.main_objective || null,
        main_objections: form.main_objections || null,
        target_launch_date: form.target_launch_date || null,
        risk_level: form.risk_level || null,
        risk_reason: form.risk_reason || null,
        account_manager_notes: form.account_manager_notes || null,
        ad_budget_monthly: num(form.ad_budget_monthly),
        has_run_ads: form.has_run_ads === "" ? null : form.has_run_ads === "yes",
        owner_pain_point: form.owner_pain_point || null,
        client_code: finalCode,
        business_type: form.business_type,
      };

      const { data: dealRow, error } = await (supabase as any)
        .from("closed_deals")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;
      toast.success(`Deal enregistré — client ${finalCode}`);

      // 3) Parallel setup: Slack channel, Stripe payment link, DocuSign envelope
      const signerEmail = effOwnerEmail || null;
      const signerName =
        effOwnerName ||
        form.contact_name?.trim() ||
        form.company_name.trim();

      let slackResult: any = null;
      let stripeResult: any = null;
      let docusignResult: any = null;

      try {
        const [slackRes, stripeRes, docusignRes] = await Promise.allSettled([
          form.company_name.trim()
            ? supabase.functions.invoke("setup-slack-onboarding", {
                body: {
                  email: signerEmail,
                  companyName: form.company_name.trim(),
                  clientId: cpRow?.client_id,
                  clientCode: finalCode,
                },
              })
            : Promise.resolve(null),
          dealValue && dealValue > 0 && dealRow?.id
            ? supabase.functions.invoke("create-stripe-payment-link", {
                body: {
                  deal_id: dealRow.id,
                  deal_value: dealValue,
                  payment_type: form.payment_type,
                  client_name: form.contact_name || effOwnerName || form.company_name,
                  client_code: finalCode,
                  client_id: cpRow?.client_id,
                  description: `TDIA – ${form.company_name.trim()}`,
                },
              })
            : Promise.resolve(null),
          signerEmail && signerName
            ? supabase.functions.invoke("create-docusign-envelope", {
                body: {
                  email: signerEmail,
                  name: signerName,
                  client_code: finalCode,
                  return_url: `${window.location.origin}/step8`,
                },
              })
            : Promise.resolve(null),
        ]);

        slackResult = slackRes.status === "fulfilled" ? (slackRes.value as any)?.data : null;
        stripeResult = stripeRes.status === "fulfilled" ? (stripeRes.value as any)?.data : null;
        docusignResult = docusignRes.status === "fulfilled" ? (docusignRes.value as any)?.data : null;

        if (slackRes.status === "rejected") {
          console.warn("[slack] setup failed:", slackRes.reason);
          toast.warning("Canal Slack non créé");
        }
        if (stripeRes.status === "rejected") {
          console.warn("[stripe] link failed:", stripeRes.reason);
          toast.warning("Lien Stripe non généré");
        }
        if (docusignRes.status === "rejected") {
          console.warn("[docusign] envelope failed:", docusignRes.reason);
          toast.warning("Enveloppe DocuSign non créée");
        }

        // Persist signing URL on client_progress so Step6 (onboarding) embeds it
        if (docusignResult?.signingUrl) {
          await (supabase as any)
            .from("client_progress")
            .update({
              docusign_link: docusignResult.signingUrl,
              docusign_envelope_id: docusignResult.envelopeId ?? null,
              docusign_sent_at: new Date().toISOString(),
            })
            .eq("client_code", finalCode);
          toast.success("Contrat DocuSign prêt dans l'onboarding");
        }

        // Persist Slack invite URL so follow-up emails can reference it
        if (slackResult?.inviteUrl) {
          await (supabase as any)
            .from("client_progress")
            .update({ slack_invite_url: slackResult.inviteUrl })
            .eq("client_code", finalCode);
        }

        // 3b) Create Google Drive folder + post pinned welcome message in client Slack channel
        try {
          const driveRes = await supabase.functions.invoke("create-client-drive-folder", {
            body: {
              companyName: form.company_name.trim(),
              clientCode: finalCode,
              clientId: cpRow?.client_id,
            },
          });
          const driveFolderUrl = (driveRes.data as any)?.folderUrl || null;

          if (slackResult?.channelId) {
            await supabase.functions.invoke("post-client-slack-welcome", {
              body: {
                channelId: slackResult.channelId,
                companyName: form.company_name.trim(),
                contactName: form.contact_name || effOwnerName || null,
                driveFolderUrl,
              },
            });
          }
        } catch (e) {
          console.warn("[drive+slack-welcome] failed:", e);
        }
      } catch (e) {
        console.warn("[parallel setup] failed:", e);
      }

      // 4) Send welcome email to the client with Client ID, onboarding, Slack, payment & DocuSign info
      if (effOwnerEmail) {
        try {
          const { error: emailErr } = await supabase.functions.invoke("send-client-welcome-email", {
            body: {
              to: effOwnerEmail,
              client_code: finalCode,
              company_name: form.company_name.trim(),
              contact_name: form.contact_name || effOwnerName || null,
              slack_invite_url: slackResult?.inviteUrl || null,
              slack_channel_name: slackResult?.channelName || null,
              payment_url: stripeResult?.url || null,
            },
          });
          if (emailErr) {
            console.warn("[welcome-email] failed:", emailErr);
            toast.warning("Email de bienvenue non envoyé");
          } else {
            toast.success("Email de bienvenue envoyé au client");
          }
        } catch (e) {
          console.warn("[welcome-email] exception:", e);
          toast.warning("Email de bienvenue non envoyé");
        }
      }

      // 5) Notify Slack #client-profile
      supabase.functions
        .invoke("notify-slack-client-profile", {
          body: {
            client_id: cpRow?.client_id,
            client_code: finalCode,
            source: form.lead_source,
            company_name: form.company_name.trim(),
            deal_value: dealValue,
            closing_date: form.closing_date,
            supervisor_name: form.closer_name,
            owner_name: effOwnerName || form.contact_name,
            business_name: effOwnerBusiness,
            contact_email: effOwnerEmail,
            contact_phone: effOwnerPhone || form.phone,
            ad_budget: num(form.ad_budget_monthly),
            has_run_ads: form.has_run_ads,
            owner_pain_point: form.owner_pain_point,
          },
        })
        .catch((err) => console.warn("[notify-slack-client-profile] failed:", err));

      // 5b) Create ClickUp task
      supabase.functions
        .invoke("create-clickup-task", {
          body: {
            client_name: form.company_name.trim(),
            contact_name: form.contact_name || effOwnerName,
            email: effOwnerEmail,
            phone: effOwnerPhone || form.phone,
            slack_channel_name: slackResult?.channelName || null,
            business_type: form.business_type,
            main_objective: form.main_objective,
            monthly_price:
              form.payment_type === "recurring"
                ? num(form.monthly_amount)
                : num(form.contract_value),
          },
        })
        .then(({ data, error }) => {
          if (error || (data && (data as any).error)) {
            console.warn("[clickup] failed:", error || (data as any).error);
            toast.warning("Tâche ClickUp non créée");
          } else {
            toast.success("Tâche ClickUp créée");
          }
        })
        .catch((err) => {
          console.warn("[clickup] failed:", err);
          toast.warning("Tâche ClickUp non créée");
        });

      setForm(emptyForm);
      setPdfFile(null);
      setShowForm(false);
      load();
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setSubmitting(false);
    }
  };

  const visibleDeals = deals.slice(0, visibleDealsCount);


  const removeDeal = async (id: string) => {
    if (!confirm("Supprimer ce deal ?")) return;
    const { error } = await (supabase as any).from("closed_deals").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deal supprimé");
    load();
  };

  const [generatingStripeId, setGeneratingStripeId] = useState<string | null>(null);
  const generateStripeLink = async (d: Deal) => {
    const dealValue =
      d.payment_type === "one_time" ? d.contract_value : d.monthly_amount;
    if (!dealValue || dealValue <= 0) {
      return toast.error("Valeur du deal invalide");
    }
    setGeneratingStripeId(d.id);
    try {
      const { data, error } = await supabase.functions.invoke("create-stripe-payment-link", {
        body: {
          deal_id: d.id,
          deal_value: dealValue,
          payment_type: d.payment_type,
          client_name: d.contact_name || d.owner_name || d.company_name,
          client_code: d.client_code,
          description: `TDIA – ${d.company_name}`,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Lien Stripe créé");
      load();
    } catch (e: any) {
      toast.error(e.message || "Erreur Stripe");
    } finally {
      setGeneratingStripeId(null);
    }
  };



  const downloadPdf = async (path: string) => {
    const { data, error } = await supabase.storage
      .from("closed-deals-contracts")
      .createSignedUrl(path, 60);
    if (error || !data) return toast.error("Impossible d'ouvrir le PDF");
    window.open(data.signedUrl, "_blank");
  };

  const totals = useMemo(() => {
    const oneTime = deals
      .filter((d) => d.payment_type === "one_time")
      .reduce((s, d) => s + (d.contract_value || 0) + (d.additional_monthly || 0), 0);
    const mrr = deals
      .filter((d) => d.payment_type === "recurring")
      .reduce((s, d) => s + (d.monthly_amount || 0), 0);
    return { count: deals.length, oneTime, mrr };
  }, [deals]);

  return (
    <div className="premium-shell min-h-screen px-4 md:px-8 py-8">
      <div className="max-w-[1600px] mx-auto space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Button asChild variant="ghost" size="sm">
                <Link to="/admin"><ArrowLeft className="h-4 w-4 mr-1" /> Retour</Link>
              </Button>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Deals closés</h1>
            <p className="text-sm text-muted-foreground">Ajoute manuellement un nouveau deal signé.</p>
          </div>
          <Button onClick={() => setShowForm((v) => !v)} variant="hero">
            <Plus className="h-4 w-4 mr-2" />
            {showForm ? "Annuler" : "Nouveau deal"}
          </Button>
        </header>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Stat label="Total deals" value={String(totals.count)} />
          <Stat label="Paiements uniques" value={`${totals.oneTime.toLocaleString()} $`} />
          <Stat label="MRR récurrent" value={`${totals.mrr.toLocaleString()} $/mo`} />
        </div>

        {showForm && (
          <Card className="p-6 space-y-6 glass-card">
            <Section title="🏢 Entreprise / Signataire">
              <Field label="Nom de l'entreprise *">
                <Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
              </Field>
              <Field label="Nom du contact (signataire)">
                <Input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
              </Field>
              <Field label="Email du contact">
                <Input type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} />
              </Field>
              <Field label="Téléphone">
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </Field>
            </Section>

            <Section title="🎯 Closing">
              <Field label="Type de business * (détermine les questions d'onboarding)">
                <Select
                  value={form.business_type}
                  onValueChange={(v: "ecommerce" | "local_service") =>
                    setForm({ ...form, business_type: v })
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ecommerce">E-commerce</SelectItem>
                    <SelectItem value="local_service">Local Service</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Type de paiement *">
                <Select value={form.payment_type} onValueChange={(v: any) => setForm({ ...form, payment_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="one_time">Paiement unique</SelectItem>
                    <SelectItem value="recurring">Récurrent mensuel</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              {form.payment_type === "one_time" ? (
                <Field label="Valeur du contrat ($) *">
                  <Input type="number" value={form.contract_value} onChange={(e) => setForm({ ...form, contract_value: e.target.value })} />
                </Field>
              ) : (
                <Field label="Montant mensuel ($) *">
                  <Input type="number" value={form.monthly_amount} onChange={(e) => setForm({ ...form, monthly_amount: e.target.value })} />
                </Field>
              )}
              <Field label="Date de closing *">
                <Input type="date" value={form.closing_date} onChange={(e) => setForm({ ...form, closing_date: e.target.value })} />
              </Field>
              {form.payment_type === "one_time" && (
                <Field label="Montant mensuel additionnel ($)">
                  <Input type="number" value={form.additional_monthly} onChange={(e) => setForm({ ...form, additional_monthly: e.target.value })} />
                </Field>
              )}
              <Field label="Caller assigné à la vente *">
                <Input value={form.closer_name} onChange={(e) => setForm({ ...form, closer_name: e.target.value })} />
              </Field>
              <Field label="Contrat signé (PDF)">
                <div className="flex items-center gap-2">
                  <Input type="file" accept="application/pdf" onChange={(e) => setPdfFile(e.target.files?.[0] || null)} />
                  {pdfFile && <span className="text-xs text-muted-foreground"><Upload className="inline h-3 w-3 mr-1" />{pdfFile.name}</span>}
                </div>
              </Field>
            </Section>

            <Section title="👤 Owner à onboarder">
              <div className="md:col-span-2 flex items-start gap-2 mb-2">
                <input
                  id="owner_same_as_contact"
                  type="checkbox"
                  className="mt-1 h-4 w-4"
                  checked={form.owner_same_as_contact}
                  onChange={(e) =>
                    setForm({ ...form, owner_same_as_contact: e.target.checked })
                  }
                />
                <label htmlFor="owner_same_as_contact" className="text-sm">
                  Le signataire est aussi le owner opérationnel
                  <span className="block text-xs text-muted-foreground">
                    Coché : on réutilise les infos "Entreprise / Signataire" ci-dessus pour l'onboarding.
                  </span>
                </label>
              </div>

              {!form.owner_same_as_contact && (
                <>
                  <Field label="Nom du owner">
                    <Input value={form.owner_name} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} />
                  </Field>
                  <Field label="Nom de la business">
                    <Input value={form.owner_business} onChange={(e) => setForm({ ...form, owner_business: e.target.value })} />
                  </Field>
                  <Field label="Email">
                    <Input type="email" value={form.owner_email} onChange={(e) => setForm({ ...form, owner_email: e.target.value })} />
                  </Field>
                  <Field label="Téléphone">
                    <Input value={form.owner_phone} onChange={(e) => setForm({ ...form, owner_phone: e.target.value })} />
                  </Field>
                </>
              )}
            </Section>

            <CollapsibleSection title="📦 Informations fulfillment" defaultOpen>
              <Field label="Source du lead">
                <Select value={form.lead_source} onValueChange={(v) => setForm({ ...form, lead_source: v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{LEAD_SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Durée / engagement">
                <Select value={form.engagement_duration} onValueChange={(v) => setForm({ ...form, engagement_duration: v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{DURATIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Offre vendue" full>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {OFFERS.map((o) => (
                    <label key={o} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={form.offers_sold.includes(o)}
                        onCheckedChange={() => setForm({ ...form, offers_sold: toggle(form.offers_sold, o) })}
                      />
                      {o}
                    </label>
                  ))}
                </div>
              </Field>
              <Field label="Plateformes à gérer" full>
                <div className="flex flex-wrap gap-3">
                  {PLATFORMS.map((p) => (
                    <label key={p} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={form.platforms_to_manage.includes(p)}
                        onCheckedChange={() => setForm({ ...form, platforms_to_manage: toggle(form.platforms_to_manage, p) })}
                      />
                      {p}
                    </label>
                  ))}
                </div>
              </Field>
              <Field label="Objectif principal" full>
                <Textarea value={form.main_objective} onChange={(e) => setForm({ ...form, main_objective: e.target.value })} />
              </Field>
              <Field label="Objections principales" full>
                <Textarea value={form.main_objections} onChange={(e) => setForm({ ...form, main_objections: e.target.value })} />
              </Field>
              <Field label="Date cible de lancement">
                <Input type="date" value={form.target_launch_date} onChange={(e) => setForm({ ...form, target_launch_date: e.target.value })} />
              </Field>
              <Field label="Niveau de risque">
                <Select value={form.risk_level} onValueChange={(v: any) => setForm({ ...form, risk_level: v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Low">Low</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Raison du risque" full>
                <Textarea value={form.risk_reason} onChange={(e) => setForm({ ...form, risk_reason: e.target.value })} />
              </Field>
              <Field label="Notes pour l'account manager" full>
                <Textarea value={form.account_manager_notes} onChange={(e) => setForm({ ...form, account_manager_notes: e.target.value })} />
              </Field>
            </CollapsibleSection>

            <CollapsibleSection title="📊 Contexte commercial (optionnel)">
              <Field label="Budget publicitaire ($/mois)">
                <Input type="number" value={form.ad_budget_monthly} onChange={(e) => setForm({ ...form, ad_budget_monthly: e.target.value })} />
              </Field>
              <Field label="A déjà fait des pubs ?">
                <Select value={form.has_run_ads} onValueChange={(v: any) => setForm({ ...form, has_run_ads: v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Oui</SelectItem>
                    <SelectItem value="no">Non</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Pain point du owner" full>
                <Textarea value={form.owner_pain_point} onChange={(e) => setForm({ ...form, owner_pain_point: e.target.value })} />
              </Field>
            </CollapsibleSection>

            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => { setShowForm(false); setForm(emptyForm); setPdfFile(null); }}>
                Annuler
              </Button>
              <Button variant="hero" onClick={submit} disabled={submitting}>
                {submitting ? "Enregistrement…" : "Enregistrer le deal"}
              </Button>
            </div>
          </Card>
        )}

        <Card className="p-4 glass-card">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Entreprise / Client</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Caller</TableHead>
                  <TableHead>Risque</TableHead>
                  <TableHead>Contrat</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Chargement…</TableCell></TableRow>
                ) : visibleDeals.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Aucun deal pour le moment</TableCell></TableRow>
                ) : visibleDeals.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="text-sm">{d.closing_date}</TableCell>
                    <TableCell>
                      <div className="font-medium flex items-center gap-2">
                        {d.company_name}
                        <span
                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                            d.business_type === "local_service"
                              ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                              : "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                          }`}
                        >
                          {d.business_type === "local_service" ? "Local Service" : "E-commerce"}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">{d.contact_name || ""}</div>
                      {d.client_code && (
                        <div className="text-[11px] font-mono text-primary/80 mt-0.5">{d.client_code}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      <div>{d.owner_name || "—"}</div>
                      <div className="text-xs text-muted-foreground">{d.owner_email || ""}</div>
                    </TableCell>
                    <TableCell className="text-xs">
                      {d.payment_type === "one_time" ? "Unique" : "Récurrent"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {d.payment_type === "one_time"
                        ? `${(d.contract_value || 0).toLocaleString()} $${d.additional_monthly ? ` + ${d.additional_monthly}/mo` : ""}`
                        : `${(d.monthly_amount || 0).toLocaleString()} $/mo`}
                    </TableCell>
                    <TableCell className="text-sm">{d.closer_name}</TableCell>
                    <TableCell className="text-xs">{d.risk_level || "—"}</TableCell>
                    <TableCell>
                      {d.contract_pdf_path ? (
                        <Button size="sm" variant="outline" onClick={() => downloadPdf(d.contract_pdf_path!)}>
                          <Download className="h-3 w-3 mr-1" /> PDF
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {d.client_code && (
                          <>
                            <Button asChild size="sm" variant="outline" title="Ouvrir l'onboarding du client">
                              <Link to={`/admin/clients/${encodeURIComponent(d.client_code)}`}>
                                <ExternalLink className="h-3 w-3 mr-1" /> Onboarding
                              </Link>
                            </Button>
                            <Button asChild size="sm" variant="outline" title="Générer un contrat pré-rempli">
                              <Link to={`/admin/contract-creator?deal=${d.id}`}>
                                <FileSignature className="h-3 w-3 mr-1" /> Contrat
                              </Link>
                            </Button>
                          </>
                        )}
                        {d.stripe_payment_url ? (
                          <Button
                            asChild
                            size="sm"
                            variant="outline"
                            title={`Lien Stripe ${d.stripe_payment_type === "recurring" ? "récurrent" : "unique"}`}
                          >
                            <a href={d.stripe_payment_url} target="_blank" rel="noreferrer">
                              <CreditCard className="h-3 w-3 mr-1" /> Stripe
                            </a>
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={generatingStripeId === d.id}
                            onClick={() => generateStripeLink(d)}
                            title="Générer le lien Stripe"
                          >
                            {generatingStripeId === d.id ? (
                              <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                            ) : (
                              <CreditCard className="h-3 w-3 mr-1" />
                            )}
                            Générer Stripe
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => removeDeal(d.id)} title="Supprimer">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {!loading && deals.length > visibleDeals.length && (
            <div className="flex justify-center pt-3">
              <Button variant="outline" size="sm" onClick={() => setVisibleDealsCount((n) => n + 10)}>
                Voir plus ({deals.length - visibleDeals.length} restants)
              </Button>
            </div>
          )}

        </Card>
      </div>
    </div>
  );
};

const Stat = ({ label, value }: { label: string; value: string }) => (
  <Card className="p-4 glass-card">
    <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
    <div className="text-2xl font-bold mt-1">{value}</div>
  </Card>
);

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div>
    <h2 className="text-lg font-semibold mb-3">{title}</h2>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
  </div>
);

const CollapsibleSection = ({
  title,
  children,
  defaultOpen,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) => {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button type="button" className="flex items-center gap-2 text-lg font-semibold mb-3 w-full text-left">
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? "" : "-rotate-90"}`} />
          {title}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
};

const Field = ({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) => (
  <div className={full ? "md:col-span-2" : ""}>
    <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">{label}</Label>
    {children}
  </div>
);

export default ClosedDeals;
