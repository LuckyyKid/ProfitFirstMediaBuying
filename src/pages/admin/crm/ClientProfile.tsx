import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Calculator, CheckCircle2 } from "lucide-react";
import { SectionHeader, StatusBadge, RiskBadge, ClickUpPlaceholder } from "@/crm/ui";
import { AutoForm, FieldDef } from "@/crm/FormKit";
import { useCrmSingle, useCrmList, upsertCrmSingle } from "@/crm/hooks";
import { computeBaseline, computeDecision, computeForecast, computeConfidence, classifyLiveProblem } from "@/crm/formulas";

// ============ Tabs ============

function OverviewTab({ client, reload }: { client: any; reload: () => void }) {
  const [c, setC] = useState(client);
  useEffect(() => setC(client), [client]);
  const save = async () => {
    const { id, created_at, updated_at, ...patch } = c;
    const { error } = await supabase.from("crm_clients").update(patch).eq("id", client.id);
    if (error) return toast.error(error.message);
    toast.success("Client mis à jour"); reload();
  };
  return (
    <Card className="p-5">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          ["company_name", "Entreprise"], ["client_code", "Code"], ["industry", "Industrie"],
          ["business_model", "Business model"], ["website_url", "Website"],
          ["main_contact_name", "Contact"], ["main_contact_email", "Email"], ["main_contact_phone", "Téléphone"],
          ["am_owner_name", "AM Owner"], ["offer_sold", "Offre"],
          ["lead_source", "Lead source"],
          ["current_phase", "Phase"], ["risk_level", "Risque"],
          ["closing_date", "Closing", "date"], ["launch_target_date", "Launch target", "date"],
          ["deal_value", "Deal value", "number"], ["monthly_retainer", "Retainer mensuel", "number"],
          ["slack_channel", "Slack"], ["drive_folder_url", "Drive"], ["hub_url", "Hub URL"],
        ].map(([k, label, type]: any) => (
          <div key={k}>
            <Label className="text-xs">{label}</Label>
            <Input type={type ?? "text"} value={c[k] ?? ""} onChange={e => setC({ ...c, [k]: type === "number" ? (e.target.value === "" ? null : Number(e.target.value)) : e.target.value })} />
          </div>
        ))}
      </div>
      <div className="mt-4 flex justify-end"><Button onClick={save}>Enregistrer</Button></div>
    </Card>
  );
}

const businessContextFields: FieldDef[] = [
  { key: "mission", label: "Mission", type: "textarea" },
  { key: "one_year_vision", label: "Vision 1 an", type: "textarea" },
  { key: "ten_year_vision", label: "Vision 10 ans", type: "textarea" },
  { key: "goal_lock", label: "Goal Lock", type: "textarea" },
  { key: "success_3_months", label: "Succès à 3 mois", type: "textarea" },
  { key: "primary_kpi", label: "KPI principal" },
  { key: "monthly_revenue", label: "Revenu mensuel", type: "number" },
  { key: "annual_revenue", label: "Revenu annuel", type: "number" },
  { key: "weekly_ad_budget", label: "Budget pub / semaine", type: "number" },
  { key: "monthly_ad_budget", label: "Budget pub / mois", type: "number" },
  { key: "target_country", label: "Pays cible" },
  { key: "target_customer", label: "Client cible", type: "textarea" },
  { key: "products_to_push", label: "Produits à pousser", type: "textarea" },
  { key: "products_to_avoid", label: "Produits à éviter", type: "textarea" },
  { key: "best_selling_product", label: "Best seller" },
  { key: "main_value_proposition", label: "Proposition de valeur", type: "textarea" },
  { key: "top_competitors", label: "Compétiteurs", type: "textarea" },
  { key: "known_objections", label: "Objections connues", type: "textarea" },
  { key: "founder_profile", label: "Profil fondateur", type: "textarea" },
  { key: "founder_strengths", label: "Forces fondateur", type: "textarea" },
  { key: "founder_weaknesses", label: "Faiblesses fondateur", type: "textarea" },
  { key: "communication_preference", label: "Comm. préférée" },
  { key: "feedback_availability", label: "Feedback / dispo" },
  { key: "decision_makers", label: "Décideurs" },
  { key: "approval_risk", label: "Risque d'approbation" },
  { key: "strategic_guardrails", label: "Garde-fous stratégiques", type: "textarea" },
];

function BusinessContextTab({ clientId }: { clientId: string }) {
  const { row, reload } = useCrmSingle("crm_business_context", clientId);
  return (
    <AutoForm
      title="Business Context"
      description="Contexte business — mission, vision, contraintes, fondateur"
      fields={businessContextFields}
      initial={row ?? {}}
      onSave={async v => { await upsertCrmSingle("crm_business_context", clientId, row, v); reload(); }}
    />
  );
}

const financialFields: FieldDef[] = [
  { key: "gross_margin_percent", label: "Marge brute (%)", type: "number" },
  { key: "average_cogs", label: "COGS moyen", type: "number" },
  { key: "average_shipping_cost", label: "Shipping moyen", type: "number" },
  { key: "average_fulfillment_cost", label: "Fulfillment moyen", type: "number" },
  { key: "refund_rate_percent", label: "Refund rate (%)", type: "number" },
  { key: "target_cac", label: "CAC cible", type: "number" },
  { key: "target_mer", label: "MER cible", type: "number" },
  { key: "target_roas", label: "ROAS cible", type: "number" },
  { key: "payback_window", label: "Payback window" },
  { key: "top_product_margin_notes", label: "Notes marges", type: "textarea" },
  { key: "stock_risk", label: "Risque stock", type: "textarea" },
  { key: "claims_allowed", label: "Claims autorisés", type: "textarea" },
  { key: "claims_forbidden", label: "Claims interdits", type: "textarea" },
  { key: "legal_risk_notes", label: "Risque légal", type: "textarea" },
];

function FinancialTab({ clientId }: { clientId: string }) {
  const { row, reload } = useCrmSingle("crm_financial_inputs", clientId);
  return (
    <AutoForm
      title="Financial Inputs" description="Marges, coûts et cibles"
      fields={financialFields} initial={row ?? {}}
      onSave={async v => { await upsertCrmSingle("crm_financial_inputs", clientId, row, v); reload(); }}
    />
  );
}

// ========== Market Research (list) ==========
function MarketResearchTab({ clientId }: { clientId: string }) {
  const { rows, reload } = useCrmList("crm_market_research", clientId);
  const [f, setF] = useState<any>({});
  const add = async () => {
    if (!f.finding_text) return toast.error("Finding requis");
    const { error } = await supabase.from("crm_market_research").insert({ ...f, client_id: clientId });
    if (error) return toast.error(error.message);
    setF({}); reload(); toast.success("Ajouté");
  };
  const del = async (id: string) => { await supabase.from("crm_market_research").delete().eq("id", id); reload(); };
  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h3 className="font-semibold mb-3">Ajouter un finding</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Input placeholder="Compétiteur" value={f.competitor_name ?? ""} onChange={e => setF({ ...f, competitor_name: e.target.value })} />
          <Input placeholder="Source (ex: FB Ad Library)" value={f.source_type ?? ""} onChange={e => setF({ ...f, source_type: e.target.value })} />
          <Input placeholder="Source URL" value={f.source_url ?? ""} onChange={e => setF({ ...f, source_url: e.target.value })} />
          <Input placeholder="ICP segment" value={f.icp_segment ?? ""} onChange={e => setF({ ...f, icp_segment: e.target.value })} />
          <Input placeholder="Angle créatif" value={f.creative_angle ?? ""} onChange={e => setF({ ...f, creative_angle: e.target.value })} />
          <Input placeholder="Gap compétiteur" value={f.competitor_gap ?? ""} onChange={e => setF({ ...f, competitor_gap: e.target.value })} />
          <Textarea className="col-span-2 md:col-span-3" placeholder="Finding" value={f.finding_text ?? ""} onChange={e => setF({ ...f, finding_text: e.target.value })} />
          <Textarea className="col-span-2 md:col-span-3" placeholder="VOC quote" value={f.customer_voice_quote ?? ""} onChange={e => setF({ ...f, customer_voice_quote: e.target.value })} />
          <Input type="number" placeholder="Evidence 1-5" value={f.evidence_strength ?? ""} onChange={e => setF({ ...f, evidence_strength: Number(e.target.value) })} />
          <Input type="number" placeholder="Confidence 1-5" value={f.confidence ?? ""} onChange={e => setF({ ...f, confidence: Number(e.target.value) })} />
          <Input placeholder="Claim risk" value={f.claim_risk ?? ""} onChange={e => setF({ ...f, claim_risk: e.target.value })} />
        </div>
        <div className="mt-3 flex justify-end"><Button onClick={add}><Plus className="h-4 w-4 mr-1" />Ajouter</Button></div>
      </Card>
      <Card className="p-5">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Compétiteur</TableHead><TableHead>Angle</TableHead>
            <TableHead>Finding</TableHead><TableHead>Ev.</TableHead><TableHead>Conf.</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell>{r.competitor_name}</TableCell>
                <TableCell>{r.creative_angle}</TableCell>
                <TableCell className="max-w-md truncate">{r.finding_text}</TableCell>
                <TableCell>{r.evidence_strength ?? "—"}</TableCell>
                <TableCell>{r.confidence ?? "—"}</TableCell>
                <TableCell><Button size="icon" variant="ghost" onClick={() => del(r.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Aucun finding</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// ========== Quantitative Baseline ==========
const baselineFields: FieldDef[] = [
  { key: "meta_spend", label: "Meta spend", type: "number" }, { key: "meta_impressions", label: "Meta impressions", type: "number" },
  { key: "meta_reach", label: "Meta reach", type: "number" }, { key: "meta_cpm", label: "Meta CPM", type: "number" },
  { key: "meta_clicks", label: "Meta clicks", type: "number" }, { key: "meta_ctr", label: "Meta CTR", type: "number" },
  { key: "meta_cpc", label: "Meta CPC", type: "number" }, { key: "meta_purchases", label: "Meta purchases", type: "number" },
  { key: "meta_cpa", label: "Meta CPA", type: "number" }, { key: "meta_purchase_value", label: "Meta purchase value", type: "number" },
  { key: "meta_roas", label: "Meta ROAS", type: "number" }, { key: "meta_frequency", label: "Meta frequency", type: "number" },
  { key: "meta_top_ads", label: "Top ads", type: "textarea" }, { key: "meta_worst_ads", label: "Worst ads", type: "textarea" },
  { key: "shopify_revenue", label: "Shopify revenue", type: "number" }, { key: "shopify_orders", label: "Shopify orders", type: "number" },
  { key: "shopify_aov", label: "Shopify AOV", type: "number" }, { key: "shopify_total_customers", label: "Total customers", type: "number" },
  { key: "shopify_new_customers", label: "New customers", type: "number" }, { key: "shopify_returning_customers", label: "Returning", type: "number" },
  { key: "shopify_conversion_rate", label: "CVR", type: "number" }, { key: "shopify_refund_amount", label: "Refund amount", type: "number" },
  { key: "shopify_refund_rate", label: "Refund rate", type: "number" }, { key: "shopify_discount_amount", label: "Discount amount", type: "number" },
  { key: "ga4_sessions", label: "GA4 sessions", type: "number" }, { key: "ga4_users", label: "GA4 users", type: "number" },
  { key: "ga4_add_to_cart", label: "GA4 ATC", type: "number" }, { key: "ga4_begin_checkout", label: "GA4 begin checkout", type: "number" },
  { key: "ga4_purchases", label: "GA4 purchases", type: "number" }, { key: "ga4_purchase_conversion_rate", label: "GA4 CVR", type: "number" },
  { key: "ga4_add_to_cart_rate", label: "GA4 ATC rate", type: "number" }, { key: "ga4_checkout_rate", label: "GA4 checkout rate", type: "number" },
  { key: "mobile_conversion_rate", label: "Mobile CVR", type: "number" }, { key: "desktop_conversion_rate", label: "Desktop CVR", type: "number" },
  { key: "google_ads_spend", label: "Google spend", type: "number" }, { key: "google_ads_clicks", label: "Google clicks", type: "number" },
  { key: "google_ads_ctr", label: "Google CTR", type: "number" }, { key: "google_ads_cpc", label: "Google CPC", type: "number" },
  { key: "google_ads_conversions", label: "Google conv.", type: "number" }, { key: "google_ads_cpa", label: "Google CPA", type: "number" },
  { key: "google_ads_conversion_value", label: "Google conv. value", type: "number" }, { key: "google_ads_roas", label: "Google ROAS", type: "number" },
  { key: "notes", label: "Notes", type: "textarea" },
];

function QuantBaselineTab({ clientId }: { clientId: string }) {
  const { row, reload } = useCrmSingle("crm_quantitative_baselines", clientId);
  const { row: fin } = useCrmSingle("crm_financial_inputs", clientId);
  const [output, setOutput] = useState<any>(null);

  const runAnalysis = async () => {
    if (!row) return toast.error("Enregistre d'abord la baseline");
    const calc = computeBaseline({
      shopify_revenue: row.shopify_revenue,
      shopify_orders: row.shopify_orders,
      shopify_new_customers: row.shopify_new_customers,
      meta_spend: row.meta_spend,
      google_ads_spend: row.google_ads_spend,
      gross_margin_percent: fin?.gross_margin_percent,
      average_shipping_cost: fin?.average_shipping_cost,
      average_fulfillment_cost: fin?.average_fulfillment_cost,
      refund_rate_percent: fin?.refund_rate_percent,
      target_cac: fin?.target_cac,
    });
    const health = Math.min(100, Math.max(0, 50 + (calc.current_cac_vs_break_even < 0 ? 30 : -20) + (calc.blended_mer >= (fin?.target_mer ?? 0) ? 20 : -10)));
    const payload = {
      client_id: clientId,
      quantitative_baseline_id: row.id,
      ...calc,
      baseline_health_score: health,
      main_quantitative_problem: calc.current_cac_vs_target > 0 ? "CAC au-dessus de la cible" : calc.blended_mer < (fin?.target_mer ?? 0) ? "MER sous cible" : "Aucun problème critique",
      quant_risk_level: health < 40 ? "High" : health < 70 ? "Medium" : "Low",
      quant_diagnosis: `MER: ${calc.blended_mer} | CAC: ${calc.blended_cac} | Break-even CAC: ${calc.estimated_break_even_cac}`,
    };
    const { data, error } = await supabase.from("crm_quant_analysis_outputs").insert(payload).select().single();
    if (error) return toast.error(error.message);
    setOutput(data); toast.success("Analyse générée");
  };

  return (
    <div className="space-y-4">
      <AutoForm
        title="Quantitative Baseline" description="Données Meta, Shopify, GA4, Google Ads (30 derniers jours)"
        fields={baselineFields} initial={row ?? {}}
        extra={<div className="mt-4"><Button variant="outline" onClick={runAnalysis}><Calculator className="h-4 w-4 mr-1" /> Run Quant Analysis</Button></div>}
        onSave={async v => { await upsertCrmSingle("crm_quantitative_baselines", clientId, row, v); reload(); }}
      />
      {output && (
        <Card className="p-5">
          <h3 className="font-semibold mb-3">Quant Analysis Output</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            {Object.entries(output).filter(([k]) => !["id", "client_id", "quantitative_baseline_id", "created_at", "am_validated"].includes(k)).map(([k, v]) => (
              <div key={k} className="border border-border/60 rounded p-2">
                <div className="text-xs text-muted-foreground">{k}</div>
                <div className="font-medium">{String(v ?? "—")}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ========== Experimental History ==========
function ExperimentalTab({ clientId }: { clientId: string }) {
  const { rows, reload } = useCrmList("crm_experimental_history", clientId);
  const [f, setF] = useState<any>({});
  const add = async () => {
    const { error } = await supabase.from("crm_experimental_history").insert({ ...f, client_id: clientId });
    if (error) return toast.error(error.message);
    setF({}); reload();
  };
  const del = async (id: string) => { await supabase.from("crm_experimental_history").delete().eq("id", id); reload(); };
  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h3 className="font-semibold mb-3">Nouveau test</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {["campaign_name","test_period","channel","angle","hook","format","offer","landing_page"].map(k => (
            <Input key={k} placeholder={k} value={f[k] ?? ""} onChange={e => setF({ ...f, [k]: e.target.value })} />
          ))}
          {["spend","cpa","roas","ctr"].map(k => (
            <Input key={k} type="number" placeholder={k} value={f[k] ?? ""} onChange={e => setF({ ...f, [k]: Number(e.target.value) })} />
          ))}
          <Input placeholder="result" value={f.result ?? ""} onChange={e => setF({ ...f, result: e.target.value })} />
          <Input placeholder="pattern" value={f.pattern_type ?? ""} onChange={e => setF({ ...f, pattern_type: e.target.value })} />
          <Textarea className="col-span-2 md:col-span-4" placeholder="notes" value={f.notes ?? ""} onChange={e => setF({ ...f, notes: e.target.value })} />
        </div>
        <div className="mt-3 flex justify-end"><Button onClick={add}><Plus className="h-4 w-4 mr-1" />Ajouter</Button></div>
      </Card>
      <Card className="p-5">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Campagne</TableHead><TableHead>Channel</TableHead><TableHead>Angle</TableHead>
            <TableHead>Spend</TableHead><TableHead>CPA</TableHead><TableHead>ROAS</TableHead><TableHead>Result</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell>{r.campaign_name}</TableCell>
                <TableCell>{r.channel}</TableCell>
                <TableCell>{r.angle}</TableCell>
                <TableCell>{r.spend}</TableCell>
                <TableCell>{r.cpa}</TableCell>
                <TableCell>{r.roas}</TableCell>
                <TableCell>{r.result}</TableCell>
                <TableCell><Button size="icon" variant="ghost" onClick={() => del(r.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// ========== CRO / Offer Audit ==========
function CroAuditTab({ clientId }: { clientId: string }) {
  const { rows, reload } = useCrmList("crm_cro_offer_audits", clientId);
  const [f, setF] = useState<any>({});
  const add = async () => {
    if (!f.finding) return toast.error("Finding requis");
    const { error } = await supabase.from("crm_cro_offer_audits").insert({ ...f, client_id: clientId });
    if (error) return toast.error(error.message);
    setF({}); reload();
  };
  const del = async (id: string) => { await supabase.from("crm_cro_offer_audits").delete().eq("id", id); reload(); };
  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h3 className="font-semibold mb-3">Nouveau finding CRO</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Input placeholder="Page URL" value={f.page_url ?? ""} onChange={e => setF({ ...f, page_url: e.target.value })} />
          <Select value={f.page_type ?? ""} onValueChange={v => setF({ ...f, page_type: v })}>
            <SelectTrigger><SelectValue placeholder="Type de page" /></SelectTrigger>
            <SelectContent>{["Homepage","Landing","PDP","Checkout","Mobile UX","Autre"].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
          </Select>
          <Input placeholder="Friction type" value={f.friction_type ?? ""} onChange={e => setF({ ...f, friction_type: e.target.value })} />
          <Select value={f.severity ?? ""} onValueChange={v => setF({ ...f, severity: v })}>
            <SelectTrigger><SelectValue placeholder="Sévérité" /></SelectTrigger>
            <SelectContent>{["Low","Medium","High","Critical"].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={f.priority ?? ""} onValueChange={v => setF({ ...f, priority: v })}>
            <SelectTrigger><SelectValue placeholder="Priorité" /></SelectTrigger>
            <SelectContent>{["P0","P1","P2","Low"].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
          </Select>
          <Input placeholder="Expected impact" value={f.expected_impact ?? ""} onChange={e => setF({ ...f, expected_impact: e.target.value })} />
          <Textarea className="col-span-2 md:col-span-3" placeholder="Finding" value={f.finding ?? ""} onChange={e => setF({ ...f, finding: e.target.value })} />
          <Textarea className="col-span-2 md:col-span-3" placeholder="Evidence" value={f.evidence ?? ""} onChange={e => setF({ ...f, evidence: e.target.value })} />
          <Textarea className="col-span-2 md:col-span-3" placeholder="Recommendation" value={f.recommendation ?? ""} onChange={e => setF({ ...f, recommendation: e.target.value })} />
        </div>
        <div className="mt-3 flex justify-end"><Button onClick={add}><Plus className="h-4 w-4 mr-1" />Ajouter</Button></div>
      </Card>
      <Card className="p-5">
        <Table>
          <TableHeader><TableRow><TableHead>Page</TableHead><TableHead>Friction</TableHead><TableHead>Finding</TableHead><TableHead>Sévérité</TableHead><TableHead>Priorité</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell>{r.page_type}</TableCell><TableCell>{r.friction_type}</TableCell>
                <TableCell className="max-w-md truncate">{r.finding}</TableCell>
                <TableCell>{r.severity}</TableCell><TableCell>{r.priority}</TableCell>
                <TableCell><Button size="icon" variant="ghost" onClick={() => del(r.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// ========== Audit Synthesis ==========
const auditFields: FieldDef[] = [
  { key: "goal_lock", label: "Goal Lock", type: "textarea" },
  { key: "strategic_context", label: "Strategic Context", type: "textarea" },
  { key: "primary_problem_category", label: "Catégorie problème principal" },
  { key: "primary_problem", label: "Problème principal", type: "textarea" },
  { key: "secondary_problems", label: "Problèmes secondaires", type: "textarea" },
  { key: "quant_evidence", label: "Preuves quant", type: "textarea" },
  { key: "market_evidence", label: "Preuves marché", type: "textarea" },
  { key: "experimental_evidence", label: "Preuves expérimentales", type: "textarea" },
  { key: "cro_offer_evidence", label: "Preuves CRO/offre", type: "textarea" },
  { key: "business_context_evidence", label: "Preuves contexte", type: "textarea" },
  { key: "key_uncertainties", label: "Incertitudes clés", type: "textarea" },
  { key: "priority_levers", label: "Leviers prioritaires", type: "textarea" },
  { key: "rejected_or_delayed_levers", label: "Leviers rejetés/reportés", type: "textarea" },
  { key: "strategic_diagnosis", label: "Diagnostic stratégique", type: "textarea" },
  { key: "confidence_level", label: "Niveau de confiance" },
  { key: "next_step", label: "Next step", type: "textarea" },
  { key: "am_approved", label: "AM approuvé", type: "checkbox" },
];

function AuditSynthesisTab({ clientId }: { clientId: string }) {
  const { row, reload } = useCrmSingle("crm_audit_syntheses", clientId);
  return (
    <AutoForm
      title="Audit Synthesis" description="Synthèse stratégique + diagnostic"
      fields={auditFields} initial={row ?? {}}
      onSave={async v => { await upsertCrmSingle("crm_audit_syntheses", clientId, row, v); reload(); }}
    />
  );
}

// ========== Hypotheses ==========
function HypothesesTab({ clientId }: { clientId: string }) {
  const { rows, reload } = useCrmList("crm_hypotheses", clientId);
  const [f, setF] = useState<any>({ status: "Draft" });
  const add = async () => {
    if (!f.hypothesis) return toast.error("Hypothèse requise");
    const { error } = await supabase.from("crm_hypotheses").insert({ ...f, client_id: clientId });
    if (error) return toast.error(error.message);
    setF({ status: "Draft" }); reload();
  };
  const updateStatus = async (id: string, status: string) => {
    await supabase.from("crm_hypotheses").update({ status }).eq("id", id); reload();
  };
  const del = async (id: string) => { await supabase.from("crm_hypotheses").delete().eq("id", id); reload(); };
  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h3 className="font-semibold mb-3">Nouvelle hypothèse</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Input placeholder="Catégorie" value={f.category ?? ""} onChange={e => setF({ ...f, category: e.target.value })} />
          <Input placeholder="Primary metric" value={f.primary_metric ?? ""} onChange={e => setF({ ...f, primary_metric: e.target.value })} />
          <Input placeholder="Timeline" value={f.timeline ?? ""} onChange={e => setF({ ...f, timeline: e.target.value })} />
          <Textarea className="col-span-2 md:col-span-3" placeholder="Hypothèse" value={f.hypothesis ?? ""} onChange={e => setF({ ...f, hypothesis: e.target.value })} />
          <Textarea className="col-span-2 md:col-span-3" placeholder="Evidence" value={f.evidence ?? ""} onChange={e => setF({ ...f, evidence: e.target.value })} />
          <Textarea className="col-span-2 md:col-span-3" placeholder="Test description" value={f.test_description ?? ""} onChange={e => setF({ ...f, test_description: e.target.value })} />
          <Input type="number" placeholder="Lift min %" value={f.expected_lift_min ?? ""} onChange={e => setF({ ...f, expected_lift_min: Number(e.target.value) })} />
          <Input type="number" placeholder="Lift base %" value={f.expected_lift_base ?? ""} onChange={e => setF({ ...f, expected_lift_base: Number(e.target.value) })} />
          <Input type="number" placeholder="Lift max %" value={f.expected_lift_max ?? ""} onChange={e => setF({ ...f, expected_lift_max: Number(e.target.value) })} />
          <Input placeholder="Confidence" value={f.confidence ?? ""} onChange={e => setF({ ...f, confidence: e.target.value })} />
          <Input placeholder="Risk" value={f.risk ?? ""} onChange={e => setF({ ...f, risk: e.target.value })} />
          <Input placeholder="Dependencies" value={f.dependencies ?? ""} onChange={e => setF({ ...f, dependencies: e.target.value })} />
          <Input placeholder="Suggested priority" value={f.suggested_priority ?? ""} onChange={e => setF({ ...f, suggested_priority: e.target.value })} />
        </div>
        <div className="mt-3 flex justify-end"><Button onClick={add}><Plus className="h-4 w-4 mr-1" />Ajouter</Button></div>
      </Card>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {rows.map((h: any) => (
          <Card key={h.id} className="p-4">
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="text-xs text-muted-foreground">{h.category ?? "—"}</div>
                <div className="font-medium">{h.hypothesis}</div>
              </div>
              <StatusBadge status={h.status} />
            </div>
            <div className="text-xs text-muted-foreground mb-2">Lift: {h.expected_lift_min ?? "?"}% / {h.expected_lift_base ?? "?"}% / {h.expected_lift_max ?? "?"}% · Timeline: {h.timeline ?? "—"}</div>
            <div className="flex gap-1 flex-wrap">
              <Button size="sm" variant="outline" onClick={() => updateStatus(h.id, "Approved")}>Approve</Button>
              <Button size="sm" variant="outline" onClick={() => updateStatus(h.id, "Rejected")}>Reject</Button>
              <Button size="sm" variant="outline" onClick={() => updateStatus(h.id, "Ready for Scoring")}>Send to Scoring</Button>
              <Button size="sm" variant="ghost" onClick={() => del(h.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </Card>
        ))}
        {rows.length === 0 && <div className="text-muted-foreground text-sm">Aucune hypothèse</div>}
      </div>
    </div>
  );
}

// ========== Decision Scoring ==========
function DecisionScoringTab({ clientId }: { clientId: string }) {
  const { rows: hypotheses } = useCrmList("crm_hypotheses", clientId);
  const { rows: scores, reload } = useCrmList("crm_decision_scores", clientId);
  const [sel, setSel] = useState<string>("");
  const [f, setF] = useState<any>({});

  const compute = () => computeDecision(f);
  const preview = compute();

  const save = async () => {
    if (!sel) return toast.error("Choisis une hypothèse");
    const c = compute();
    const payload = { ...f, ...c, client_id: clientId, hypothesis_id: sel };
    delete payload.override_note;
    const { error } = await supabase.from("crm_decision_scores").insert(payload);
    if (error) return toast.error(error.message);
    setF({}); setSel(""); reload(); toast.success("Score enregistré");
  };

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h3 className="font-semibold mb-3">Nouveau scoring (1-5)</h3>
        <Select value={sel} onValueChange={setSel}>
          <SelectTrigger className="mb-3"><SelectValue placeholder="Choisir une hypothèse approuvée" /></SelectTrigger>
          <SelectContent>
            {hypotheses.filter((h: any) => h.status === "Approved" || h.status === "Ready for Scoring").map((h: any) => (
              <SelectItem key={h.id} value={h.id}>{h.hypothesis?.slice(0, 80)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
          {[
            ["business_impact","Impact business"],["goal_alignment","Goal alignment"],["evidence_strength","Evidence"],
            ["confidence_score","Confidence"],["ease_of_execution","Ease"],["urgency","Urgency"],
            ["risk","Risk"],["dependency_level","Dependency"],["expected_time_to_result","Time to result"],
          ].map(([k, label]) => (
            <div key={k}>
              <Label className="text-xs">{label}</Label>
              <Input type="number" min={1} max={5} value={f[k] ?? ""} onChange={e => setF({ ...f, [k]: Number(e.target.value) })} />
            </div>
          ))}
        </div>
        <div className="mt-4 p-3 border rounded bg-muted/30 text-sm flex gap-6">
          <div><span className="text-muted-foreground">Score:</span> <b>{preview.decision_score}</b></div>
          <div><span className="text-muted-foreground">Priorité:</span> <b>{preview.priority}</b></div>
          {preview.override_note && <div className="text-amber-500">{preview.override_note}</div>}
        </div>
        <div className="mt-3 flex justify-end"><Button onClick={save}>Enregistrer</Button></div>
      </Card>
      <Card className="p-5">
        <Table>
          <TableHeader><TableRow><TableHead>Hypothèse</TableHead><TableHead>Score</TableHead><TableHead>Priorité</TableHead><TableHead>AM</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
          <TableBody>
            {scores.map((s: any) => {
              const h = hypotheses.find((x: any) => x.id === s.hypothesis_id);
              return (
                <TableRow key={s.id}>
                  <TableCell className="max-w-md truncate">{h?.hypothesis ?? s.hypothesis_id}</TableCell>
                  <TableCell><b>{s.decision_score}</b></TableCell>
                  <TableCell><StatusBadge status={s.priority} /></TableCell>
                  <TableCell>{s.am_approved ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : "—"}</TableCell>
                  <TableCell className="text-xs">{new Date(s.created_at).toLocaleDateString()}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// ========== Forecast ==========
function ForecastTab({ clientId }: { clientId: string }) {
  const { rows: hypotheses } = useCrmList("crm_hypotheses", clientId);
  const { rows: forecasts, reload } = useCrmList("crm_forecasts", clientId);
  const [sel, setSel] = useState<string[]>([]);
  const [overlap, setOverlap] = useState<"heavy"|"normal"|"complementary">("normal");
  const [conf, setConf] = useState<any>({});
  const [meta, setMeta] = useState<any>({ forecast_name: "", forecast_period: "90d", goal: "" });

  const selected = hypotheses.filter((h: any) => sel.includes(h.id));
  const fc = computeForecast(selected, overlap);
  const cf = computeConfidence(conf);

  const save = async () => {
    if (!meta.forecast_name) return toast.error("Nom requis");
    const payload = {
      client_id: clientId,
      ...meta,
      selected_hypotheses: sel,
      ...fc,
      ...cf,
      forecast_status: "Draft",
    };
    delete (payload as any).discount;
    const { error } = await supabase.from("crm_forecasts").insert(payload);
    if (error) return toast.error(error.message);
    setSel([]); setConf({}); setMeta({ forecast_name: "", forecast_period: "90d", goal: "" });
    reload(); toast.success("Forecast créé");
  };

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h3 className="font-semibold mb-3">Nouveau forecast</h3>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <Input placeholder="Nom" value={meta.forecast_name} onChange={e => setMeta({ ...meta, forecast_name: e.target.value })} />
          <Input placeholder="Période (ex 90d)" value={meta.forecast_period} onChange={e => setMeta({ ...meta, forecast_period: e.target.value })} />
          <Input placeholder="Goal" value={meta.goal} onChange={e => setMeta({ ...meta, goal: e.target.value })} />
        </div>
        <Label className="text-xs">Hypothèses (multi-sélection)</Label>
        <div className="max-h-40 overflow-y-auto border rounded p-2 space-y-1 mb-3">
          {hypotheses.map((h: any) => (
            <label key={h.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={sel.includes(h.id)} onChange={e => setSel(e.target.checked ? [...sel, h.id] : sel.filter(x => x !== h.id))} />
              <span className="truncate">{h.hypothesis}</span>
            </label>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div><Label className="text-xs">Overlap</Label>
            <Select value={overlap} onValueChange={(v: any) => setOverlap(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="heavy">Heavy (0.50)</SelectItem>
                <SelectItem value="normal">Normal (0.70)</SelectItem>
                <SelectItem value="complementary">Complementary (0.85)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="border rounded p-3 bg-muted/30 text-sm mb-3">
          <div>Range: <b>{fc.expected_lift_low}%</b> / <b>{fc.expected_lift_base}%</b> / <b>{fc.expected_lift_high}%</b></div>
        </div>
        <h4 className="font-semibold mb-2 text-sm">Confidence scoring</h4>
        <div className="grid grid-cols-4 gap-3">
          {["data_quality","evidence_strength","goal_alignment","execution_readiness","tracking_confidence","historical_similarity","risk_penalty","dependency_penalty"].map(k => (
            <div key={k}>
              <Label className="text-xs">{k}</Label>
              <Input type="number" value={conf[k] ?? ""} onChange={e => setConf({ ...conf, [k]: Number(e.target.value) })} />
            </div>
          ))}
        </div>
        <div className="border rounded p-3 bg-muted/30 text-sm mt-3">
          <div>Confidence: <b>{cf.confidence_score}</b> — <b>{cf.confidence_label}</b></div>
        </div>
        <div className="mt-3 flex justify-end"><Button onClick={save}>Enregistrer forecast</Button></div>
      </Card>
      <Card className="p-5">
        <Table>
          <TableHeader><TableRow><TableHead>Nom</TableHead><TableHead>Period</TableHead><TableHead>Range</TableHead><TableHead>Confidence</TableHead><TableHead>Statut</TableHead></TableRow></TableHeader>
          <TableBody>
            {forecasts.map((f: any) => (
              <TableRow key={f.id}>
                <TableCell>{f.forecast_name}</TableCell>
                <TableCell>{f.forecast_period}</TableCell>
                <TableCell>{f.expected_lift_low}% / {f.expected_lift_base}% / {f.expected_lift_high}%</TableCell>
                <TableCell>{f.confidence_score} — {f.confidence_label}</TableCell>
                <TableCell><StatusBadge status={f.forecast_status} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// ========== Metric Targets ==========
const metricFields: FieldDef[] = [
  { key: "period", label: "Période" }, { key: "north_star_metric", label: "North Star Metric" },
  { key: "revenue_target", label: "Revenue target", type: "number" },
  { key: "ad_spend_target", label: "Ad spend target", type: "number" },
  { key: "mer_target", label: "MER target", type: "number" },
  { key: "cac_target", label: "CAC target", type: "number" },
  { key: "contribution_margin_proxy_target", label: "Contrib margin proxy", type: "number" },
  { key: "new_customers_target", label: "New customers", type: "number" },
  { key: "returning_revenue_target", label: "Returning revenue", type: "number" },
  { key: "meta_spend_target", label: "Meta spend", type: "number" },
  { key: "meta_cac_target", label: "Meta CAC", type: "number" },
  { key: "meta_roas_target", label: "Meta ROAS", type: "number" },
  { key: "google_spend_target", label: "Google spend", type: "number" },
  { key: "google_roas_target", label: "Google ROAS", type: "number" },
  { key: "email_revenue_target", label: "Email revenue", type: "number" },
  { key: "notes", label: "Notes", type: "textarea" },
];
function MetricTargetsTab({ clientId }: { clientId: string }) {
  const { row, reload } = useCrmSingle("crm_metric_targets", clientId);
  return (
    <AutoForm title="Metric Targets" fields={metricFields} initial={row ?? {}}
      onSave={async v => { await upsertCrmSingle("crm_metric_targets", clientId, row, v); reload(); }} />
  );
}

// ========== Creative Demand Plan ==========
const creativeFields: FieldDef[] = [
  { key: "total_creatives_needed", label: "Total créatifs", type: "number" },
  { key: "videos_needed", label: "Vidéos", type: "number" },
  { key: "statics_needed", label: "Statics", type: "number" },
  { key: "priority_products", label: "Produits prioritaires", type: "textarea" },
  { key: "priority_angles", label: "Angles prioritaires", type: "textarea" },
  { key: "creative_risk_level", label: "Risque créatif" },
  { key: "rationale", label: "Rationale", type: "textarea" },
  { key: "production_sources", label: "Sources production", type: "textarea" },
  { key: "due_dates", label: "Deadlines", type: "textarea" },
];
function CreativeDemandTab({ clientId }: { clientId: string }) {
  const { row, reload } = useCrmSingle("crm_creative_demand_plans", clientId);
  return (
    <AutoForm title="Creative Demand Plan" fields={creativeFields} initial={row ?? {}}
      onSave={async v => { await upsertCrmSingle("crm_creative_demand_plans", clientId, row, v); reload(); }} />
  );
}

// ========== Growth Execution Map ==========
function GrowthMapTab({ clientId }: { clientId: string }) {
  const { rows, reload } = useCrmList("crm_growth_execution_maps", clientId, "week_number");
  const [f, setF] = useState<any>({});
  const add = async () => {
    const { error } = await supabase.from("crm_growth_execution_maps").insert({ ...f, client_id: clientId });
    if (error) return toast.error(error.message);
    setF({}); reload();
  };
  const del = async (id: string) => { await supabase.from("crm_growth_execution_maps").delete().eq("id", id); reload(); };
  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h3 className="font-semibold mb-3">Nouvelle semaine</h3>
        <div className="grid grid-cols-3 gap-3">
          <Input type="number" placeholder="Semaine #" value={f.week_number ?? ""} onChange={e => setF({ ...f, week_number: Number(e.target.value) })} />
          <Input placeholder="Weekly goal" value={f.weekly_goal ?? ""} onChange={e => setF({ ...f, weekly_goal: e.target.value })} />
          <Input placeholder="Key milestone" value={f.key_milestone ?? ""} onChange={e => setF({ ...f, key_milestone: e.target.value })} />
          <Textarea className="col-span-3" placeholder="Planned actions" value={f.planned_actions ?? ""} onChange={e => setF({ ...f, planned_actions: e.target.value })} />
          {["revenue_target","spend_target","cac_target","mer_target","creative_output_target"].map(k => (
            <Input key={k} type="number" placeholder={k} value={f[k] ?? ""} onChange={e => setF({ ...f, [k]: Number(e.target.value) })} />
          ))}
          <Textarea className="col-span-3" placeholder="Dependencies" value={f.dependencies ?? ""} onChange={e => setF({ ...f, dependencies: e.target.value })} />
        </div>
        <div className="mt-3 flex justify-end"><Button onClick={add}><Plus className="h-4 w-4 mr-1" />Ajouter</Button></div>
      </Card>
      <Card className="p-5">
        <Table>
          <TableHeader><TableRow><TableHead>Sem.</TableHead><TableHead>Goal</TableHead><TableHead>Revenue</TableHead><TableHead>Spend</TableHead><TableHead>CAC</TableHead><TableHead>Milestone</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell>{r.week_number}</TableCell><TableCell>{r.weekly_goal}</TableCell>
                <TableCell>{r.revenue_target}</TableCell><TableCell>{r.spend_target}</TableCell>
                <TableCell>{r.cac_target}</TableCell><TableCell>{r.key_milestone}</TableCell>
                <TableCell><Button size="icon" variant="ghost" onClick={() => del(r.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// ========== Live Optimization ==========
function LiveOptTab({ clientId }: { clientId: string }) {
  const { rows, reload } = useCrmList("crm_live_optimization_reviews", clientId);
  const [f, setF] = useState<any>({ review_period: "" });
  const problem = classifyLiveProblem(f);
  const add = async () => {
    const payload = { ...f, client_id: clientId, problem_type: problem };
    const { error } = await supabase.from("crm_live_optimization_reviews").insert(payload);
    if (error) return toast.error(error.message);
    setF({ review_period: "" }); reload();
  };
  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h3 className="font-semibold mb-3">Nouvelle revue live</h3>
        <div className="grid grid-cols-3 gap-3">
          <Input placeholder="Période (ex 2026-W27)" value={f.review_period ?? ""} onChange={e => setF({ ...f, review_period: e.target.value })} />
          {["revenue_target","revenue_actual","spend_target","spend_actual","cac_target","cac_actual","mer_target","mer_actual","ctr_actual","cvr_actual","atc_actual"].map(k => (
            <div key={k}><Label className="text-xs">{k}</Label><Input type="number" value={f[k] ?? ""} onChange={e => setF({ ...f, [k]: Number(e.target.value) })} /></div>
          ))}
          {["creative_output_target","creative_output_actual"].map(k => (
            <div key={k}><Label className="text-xs">{k}</Label><Input type="number" value={f[k] ?? ""} onChange={e => setF({ ...f, [k]: Number(e.target.value) })} /></div>
          ))}
          {["what_happened","so_what","now_what","recommended_actions","variance_summary","client_success_payload"].map(k => (
            <Textarea key={k} className="col-span-3" placeholder={k} value={f[k] ?? ""} onChange={e => setF({ ...f, [k]: e.target.value })} />
          ))}
        </div>
        <div className="mt-3 p-3 bg-muted/30 rounded text-sm">Auto-classification: <b>{problem}</b></div>
        <div className="mt-3 flex justify-end"><Button onClick={add}><Plus className="h-4 w-4 mr-1" />Ajouter</Button></div>
      </Card>
      <Card className="p-5">
        <Table>
          <TableHeader><TableRow><TableHead>Période</TableHead><TableHead>Rev</TableHead><TableHead>Spend</TableHead><TableHead>CAC</TableHead><TableHead>MER</TableHead><TableHead>Problème</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell>{r.review_period}</TableCell>
                <TableCell>{r.revenue_actual}/{r.revenue_target}</TableCell>
                <TableCell>{r.spend_actual}/{r.spend_target}</TableCell>
                <TableCell>{r.cac_actual}/{r.cac_target}</TableCell>
                <TableCell>{r.mer_actual}/{r.mer_target}</TableCell>
                <TableCell>{r.problem_type}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// ========== Learning Log ==========
function LearningLogTab({ clientId }: { clientId: string }) {
  const { rows, reload } = useCrmList("crm_learning_library", clientId);
  const [f, setF] = useState<any>({});
  const add = async () => {
    const { error } = await supabase.from("crm_learning_library").insert({ ...f, client_id: clientId });
    if (error) return toast.error(error.message);
    setF({}); reload();
  };
  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h3 className="font-semibold mb-3">Log d'apprentissage</h3>
        <div className="grid grid-cols-3 gap-3">
          {["industry","creative_angle","offer","cro_module","expected_lift","actual_lift","result","time_to_signal","time_to_result","decision"].map(k => (
            <Input key={k} placeholder={k} value={f[k] ?? ""} onChange={e => setF({ ...f, [k]: e.target.value })} />
          ))}
          <Textarea className="col-span-3" placeholder="Hypothèse" value={f.hypothesis ?? ""} onChange={e => setF({ ...f, hypothesis: e.target.value })} />
          <Textarea className="col-span-3" placeholder="Action taken" value={f.action_taken ?? ""} onChange={e => setF({ ...f, action_taken: e.target.value })} />
          <Textarea className="col-span-3" placeholder="Notes" value={f.notes ?? ""} onChange={e => setF({ ...f, notes: e.target.value })} />
        </div>
        <div className="mt-3 flex justify-end"><Button onClick={add}>Ajouter</Button></div>
      </Card>
      <Card className="p-5">
        <Table>
          <TableHeader><TableRow><TableHead>Hypothèse</TableHead><TableHead>Result</TableHead><TableHead>Decision</TableHead><TableHead>Actual lift</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="max-w-md truncate">{r.hypothesis}</TableCell>
                <TableCell>{r.result}</TableCell><TableCell>{r.decision}</TableCell><TableCell>{r.actual_lift}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// ========== ClickUp Links ==========
function ClickUpTab({ client, reload }: { client: any; reload: () => void }) {
  const [c, setC] = useState(client);
  useEffect(() => setC(client), [client]);
  const save = async () => {
    const { error } = await supabase.from("crm_clients").update({
      clickup_client_task_id: c.clickup_client_task_id,
      clickup_task_url: c.clickup_task_url,
      clickup_status: c.clickup_status,
    }).eq("id", client.id);
    if (error) return toast.error(error.message);
    toast.success("Sauvegardé"); reload();
  };
  return (
    <Card className="p-5">
      <h3 className="font-semibold mb-3">ClickUp Links & Sync (V2)</h3>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div><Label className="text-xs">ClickUp Client Task ID</Label><Input value={c.clickup_client_task_id ?? ""} onChange={e => setC({ ...c, clickup_client_task_id: e.target.value })} /></div>
        <div><Label className="text-xs">ClickUp Task URL</Label><Input value={c.clickup_task_url ?? ""} onChange={e => setC({ ...c, clickup_task_url: e.target.value })} /></div>
        <div><Label className="text-xs">Dernier statut sync</Label><Input value={c.clickup_status ?? ""} onChange={e => setC({ ...c, clickup_status: e.target.value })} /></div>
      </div>
      <div className="flex gap-2 mb-3">
        <Button onClick={save} size="sm">Enregistrer liens</Button>
      </div>
      <div className="border-t pt-3 flex flex-wrap gap-2">
        <ClickUpPlaceholder label="Send Summary to ClickUp" />
        <ClickUpPlaceholder label="Create Execution Tickets" />
        <ClickUpPlaceholder label="Update ClickUp Status" />
        <ClickUpPlaceholder label="Pull ClickUp Comments" />
      </div>
    </Card>
  );
}

// ============ Main page ============
const TABS = [
  { v: "overview", l: "Overview" },
  { v: "business", l: "Business Context" },
  { v: "financial", l: "Financial" },
  { v: "market", l: "Market Research" },
  { v: "baseline", l: "Quant Baseline" },
  { v: "experimental", l: "Experimental" },
  { v: "cro", l: "CRO / Offer" },
  { v: "synthesis", l: "Audit Synthesis" },
  { v: "hypotheses", l: "Hypotheses" },
  { v: "scoring", l: "Decision Scoring" },
  { v: "forecast", l: "Forecast" },
  { v: "targets", l: "Metric Targets" },
  { v: "creative", l: "Creative Demand" },
  { v: "growth", l: "Growth Map" },
  { v: "live", l: "Live Optim." },
  { v: "learning", l: "Learning Log" },
  { v: "clickup", l: "ClickUp" },
];

export default function ClientProfile() {
  const { id } = useParams();
  const [client, setClient] = useState<any | null>(null);
  const [tab, setTab] = useState("overview");

  const load = async () => {
    if (!id) return;
    const { data } = await supabase.from("crm_clients").select("*").eq("id", id).maybeSingle();
    setClient(data);
  };
  useEffect(() => { load(); }, [id]);

  if (!id) return null;
  if (!client) return <div className="p-6 text-muted-foreground">Chargement…</div>;

  return (
    <div>
      <div className="mb-4">
        <Button asChild variant="ghost" size="sm"><Link to="/admin/crm/clients"><ArrowLeft className="h-4 w-4 mr-1" /> Retour clients</Link></Button>
      </div>
      <SectionHeader
        title={client.company_name}
        description={`${client.client_code ?? ""} · ${client.industry ?? "—"} · AM: ${client.am_owner_name ?? "—"}`}
        actions={<><StatusBadge status={client.current_phase} /><RiskBadge level={client.risk_level} /></>}
      />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex flex-wrap h-auto justify-start">
          {TABS.map(t => <TabsTrigger key={t.v} value={t.v}>{t.l}</TabsTrigger>)}
        </TabsList>
        <TabsContent value="overview"><OverviewTab client={client} reload={load} /></TabsContent>
        <TabsContent value="business"><BusinessContextTab clientId={id} /></TabsContent>
        <TabsContent value="financial"><FinancialTab clientId={id} /></TabsContent>
        <TabsContent value="market"><MarketResearchTab clientId={id} /></TabsContent>
        <TabsContent value="baseline"><QuantBaselineTab clientId={id} /></TabsContent>
        <TabsContent value="experimental"><ExperimentalTab clientId={id} /></TabsContent>
        <TabsContent value="cro"><CroAuditTab clientId={id} /></TabsContent>
        <TabsContent value="synthesis"><AuditSynthesisTab clientId={id} /></TabsContent>
        <TabsContent value="hypotheses"><HypothesesTab clientId={id} /></TabsContent>
        <TabsContent value="scoring"><DecisionScoringTab clientId={id} /></TabsContent>
        <TabsContent value="forecast"><ForecastTab clientId={id} /></TabsContent>
        <TabsContent value="targets"><MetricTargetsTab clientId={id} /></TabsContent>
        <TabsContent value="creative"><CreativeDemandTab clientId={id} /></TabsContent>
        <TabsContent value="growth"><GrowthMapTab clientId={id} /></TabsContent>
        <TabsContent value="live"><LiveOptTab clientId={id} /></TabsContent>
        <TabsContent value="learning"><LearningLogTab clientId={id} /></TabsContent>
        <TabsContent value="clickup"><ClickUpTab client={client} reload={load} /></TabsContent>
      </Tabs>
    </div>
  );
}
