import { Card } from "@/components/ui/card";
import { BookOpen } from "lucide-react";
import { TwentyPage, PageHeader } from "@/components/admin-shell";

const DOCS = [
  { title: "TDIA Hierarchy of Metrics", body: "Business metrics > platform metrics. Never decide from ROAS alone. Always tie channel performance back to client goal, margin, CAC, MER, and contribution margin proxy." },
  { title: "Goal Lock Rules", body: "Every strategy must align with the client goal. An action that does not support the Goal Lock cannot be P0." },
  { title: "Evidence Hierarchy", body: "L5: internal client test w/ measured result · L4: client quant + qual · L3: close competitor/customer · L2: ad library / proxy · L1: opinion. Client data = proof. External = signal. External experiments = proxy. TDIA test = validation." },
  { title: "Diagnosis Taxonomy", body: "Acquisition Efficiency · Creative Fatigue · Message-Market Mismatch · CRO/Funnel · Offer · Margin/Unit Economics · Tracking/Attribution · Retention/Brand Dependency · Inventory/SKU · Creative Supply." },
  { title: "Volume vs Efficiency Rules", body: "Volume problem = efficient but not enough spend/revenue. Efficiency problem = spend exists but CAC/MER/ROAS/CVR bad." },
  { title: "Decision Scoring Rules", body: "Deterministic formula. Agents suggest, AM validates, algorithm scores. Score = 25*BI + 20*GA + 20*ES + 15*CF + 10*UR + 10*EE - 15*RI - 10*DE. ≥350 P0, 275-349 P1, 200-274 P2." },
  { title: "Forecasting Rules", body: "Forecast is not a guarantee. It is a range + timeline + confidence + conditions + risks. Used to compare actual vs expected and course-correct fast." },
  { title: "Creative Demand Rules", body: "Depends on spend goal, concentration risk, fatigue risk, activation rate, and need for new angles." },
  { title: "Gross vs Net Revenue", body: "Gross = ce que la plateforme affiche. Net = gross − discounts − refunds − chargebacks + shipping collected − taxes (si TTC). Toute décision finance-grade se prend sur le net, jamais sur le gross." },
  { title: "Product Margin vs True Gross Margin", body: "Marge produit = price − product_cost (illusion). True gross margin = price − cost_of_delivery complet (COGS + landed + freight + douanes + shipping réel + pick&pack + processing + refund/discount allowances). Break-even CAC = true_gross_profit." },
  { title: "Cost of Delivery", body: "COGS + landed cost + freight + duties/tariffs + shipping to customer + pick & pack + payment processing + refund allowance + discount allowance. Toute analyse de rentabilité ignorant un de ces postes est fausse." },
  { title: "Contribution Margin (CM3)", body: "CM = gross_profit − marketing_expense. C'est ce qui reste pour payer OPEX + intérêts + profit. Une entreprise ne peut scaler durablement qu'avec CM% > 0 et croissant." },
  { title: "Basket Unit Economics", body: "Modéliser un AOV avec ses coûts variables réels : gross profit panier, marge panier %, break-even CAC panier. Utilisé pour target CAC par bundle / offre." },
  { title: "Discount Economics", body: "Une remise attaque directement la marge. discounted_price = base × (1 − %). Break-even ROAS post-offre = 1 / gm_after. Si break-even ROAS ≥ 4 → risqué pour acquisition ; ≥ 8 → réservé retention/warm ; GP ≤ 0 → NOT_VIABLE_FOR_ACQUISITION." },
  { title: "LTGP:CAC", body: "Ratio LTGP (window fixe, ex. 90 j) / CAC. <1 = perte, 1–2 = fragile, 2–3 = zone saine de scaling, >3 = probablement sous-investi. Le classement bouge selon le payback souhaité." },
  { title: "Inventory Cash Flow", body: "Le stock lock du cash. Grade A (<30 j) push et protège marge ; B (30–90) demand steady ; C (90–180) volume test surveiller CAC ; D (≥180) dead → cash recovery / liquidation, jamais scale full-price." },
  { title: "Cash vs Profit", body: "Une marque peut être profitable sur le papier et à sec en cash à cause du stock, des terms fournisseurs et du cycle de conversion. Toujours modéliser les deux séparément." },
  { title: "New vs Returning Customer Economics", body: "New customer = orders_count == 1 à la création de commande. Returning = orders_count > 1. CAC ne s'applique qu'au new. LTV / repeat purchase rate justifie flexer le CAC dans le payback window." },
  { title: "Platform Metrics vs Finance-Grade Metrics", body: "Meta ROAS, Google conv_value, GA4 sessions = signaux plateforme. Shopify net revenue, cost of delivery, CM, EBITDA = vérité finance. Un gap > 30% Meta vs Shopify → tracking risk HIGH, ne jamais scaler sur ROAS plateforme seul." },
  { title: "Averages Lie: Why AOV Histogram Matters", body: "L'AOV moyen est tiré vers le haut par les grosses commandes. Le modal order est la commande que la majorité passe réellement. Un CAC target calé sur la moyenne peut rendre le modal non rentable. Toujours juger le CAC contre la commande que le funnel est conçu pour créer, pas contre l'AOV blended." },
  { title: "Media Buying Must Match SKU Strategy", body: "Une campagne à haut ROAS n'est pas toujours celle à scaler. Le stock, la marge, le plan de demande et la priorité produit priment. Parfois une performance plateforme plus faible est correcte si elle sert le demand plan. Un audit ad account sans contexte stratégie/stock est trompeur." },
  { title: "Marketing, Finance & Inventory Share One Plan", body: "Le forecast doit se casser en attentes unitaires par produit/SKU. Les actions marketing servent ces attentes. Ops/fulfillment sait quelle demande est créée. Un check-in quotidien compare ventes réelles vs planifiées par produit." },
  { title: "Fixed OPEX ≠ Variable Cost per Order", body: "OPEX (payroll, rent, software) ne scale pas linéairement avec le revenu. Le convertir en coût par commande sur-pénalise le CAC target. Un buffer OPEX est un garde-fou conservateur, utile uniquement pour les brands bootstrappées. Par défaut : OPEX exclu du break-even CAC." },
];

export default function Methodology() {
  return (
    <TwentyPage inLayout>
      <PageHeader
        icon={BookOpen}
        title="Methodology"
        description="Règles TDIA — lecture seule"
      />
      <div className="flex-1 overflow-auto p-4 md:p-6">
        <div className="grid gap-3">
          {DOCS.map(d => (
            <Card key={d.title} className="p-4 border-border shadow-none">
              <h3 className="text-sm font-semibold text-foreground mb-1.5">{d.title}</h3>
              <p className="text-xs text-muted-foreground whitespace-pre-line leading-relaxed">{d.body}</p>
            </Card>
          ))}
        </div>
      </div>
    </TwentyPage>
  );
}
