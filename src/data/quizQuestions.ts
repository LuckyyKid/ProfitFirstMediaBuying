export type QuestionType =
  | "short"
  | "long"
  | "url"
  | "single_choice"
  | "multi_choice"
  | "scale"
  | "composite";

export type Lang = "fr" | "en";

export interface CompositeField {
  key: string;
  label: string;
  placeholder?: string;
  type?: "short" | "long" | "url";
  label_en?: string;
  placeholder_en?: string;
}

export interface Question {
  id: string;
  label: string;
  type?: QuestionType;
  placeholder?: string;
  options?: string[];
  allowOther?: boolean;
  // For scale type
  scaleMin?: number;
  scaleMax?: number;
  scaleMinLabel?: string;
  scaleMaxLabel?: string;
  // For composite type (multi-fields per question)
  fields?: CompositeField[];
  // Question is optional (Skip button shown)
  optional?: boolean;
  // Extra help/hint
  hint?: string;
  // English translations (optional — falls back to FR)
  label_en?: string;
  placeholder_en?: string;
  options_en?: string[];
  hint_en?: string;
  scaleMinLabel_en?: string;
  scaleMaxLabel_en?: string;
}

// Returns a copy of the question with fields swapped to the target language when
// EN translations are present. Falls back to FR text field-by-field.
export function localizeQuestion(q: Question, lang: Lang): Question {
  if (lang !== "en") return q;
  return {
    ...q,
    label: q.label_en ?? q.label,
    placeholder: q.placeholder_en ?? q.placeholder,
    options: q.options_en ?? q.options,
    hint: q.hint_en ?? q.hint,
    scaleMinLabel: q.scaleMinLabel_en ?? q.scaleMinLabel,
    scaleMaxLabel: q.scaleMaxLabel_en ?? q.scaleMaxLabel,
    fields: q.fields?.map((f) => ({
      ...f,
      label: f.label_en ?? f.label,
      placeholder: f.placeholder_en ?? f.placeholder,
    })),
  };
}

// Quiz « Compréhension de votre univers digital » — 43 questions (Étape 3)
export const WELCOME_QUESTIONS: Question[] = [
  { id: "mission", label: "Votre mission d'entreprise ?", type: "long", label_en: "Your company mission?" },
  { id: "vision", label: "Où voyez-vous votre entreprise dans un an ? Et dans 10 ans ?", type: "long", label_en: "Where do you see your company in 1 year? And in 10 years?" },
  { id: "best_solution", label: "Pourquoi pensez-vous être la meilleure solution sur le marché ?", type: "long", label_en: "Why do you believe you're the best solution on the market?" },
  { id: "competitors", label: "Pouvez-vous nous citer 3 de vos compétiteurs ?", type: "long", label_en: "Can you name 3 of your competitors?" },
  { id: "acv", label: "Quel est votre argument clé de vente (ACV) ?", type: "long", label_en: "What is your key selling point (USP)?" },
  { id: "vmc", label: "Quelle est votre valeur moyenne par commande (VMC) ?", type: "short", label_en: "What is your AOV (average order value)?" },
  { id: "top_product", label: "Quel est le produit le plus acheté par vos clients ?", type: "short", label_en: "What is your best-selling product?" },
  { id: "last_agency", label: "Comment s'est passée votre dernière expérience en agence ?", type: "long", label_en: "How did your last agency experience go?" },
  { id: "client_acquisition", label: "Jusqu'à maintenant, comment avez-vous obtenu vos clients ?", type: "long", label_en: "So far, how have you acquired your customers?" },
  { id: "monthly_revenue", label: "Votre chiffre d'affaires mensuel", type: "short", label_en: "Your monthly revenue" },
  { id: "yearly_revenue", label: "Votre chiffre d'affaires annuel", type: "short", label_en: "Your yearly revenue" },
  { id: "target_client", label: "Quel est votre client cible ? (le plus de détails possible)", type: "long", label_en: "Who is your target customer? (as much detail as possible)" },
  { id: "target_country", label: "Quel est votre pays cible ?", type: "short", label_en: "What is your target country?" },
  { id: "weekly_budget", label: "Quel est votre budget hebdomadaire ?", type: "short", label_en: "What is your weekly budget?" },
  { id: "creatives_drive", label: "Le lien du Google Drive avec toutes vos anciennes créatives !", type: "url", placeholder: "https://drive.google.com/...", label_en: "The Google Drive link with all your past creatives!", placeholder_en: "https://drive.google.com/..." },
  { id: "brand_colors", label: "Quelle est votre charte de couleurs ?", type: "short", label_en: "What is your brand color palette?" },
  { id: "assets_drive", label: "Le lien de vos Drives avec les logos, les vidéos que vous avez déjà tournées, et vos anciennes publicités.", type: "url", placeholder: "https://drive.google.com/...", label_en: "The link to your Drives with logos, videos you've already shot, and past ads.", placeholder_en: "https://drive.google.com/..." },
  { id: "marketing_goals", label: "Quels sont les principaux objectifs de votre stratégie marketing actuelle ?", type: "long", label_en: "What are the main goals of your current marketing strategy?" },
  { id: "audience_profile", label: "Pouvez-vous décrire votre public cible en termes de démographie, d'intérêts et de comportements ?", type: "long", label_en: "Can you describe your target audience in terms of demographics, interests and behaviors?" },
  { id: "channels_perf", label: "Quels sont les canaux de marketing que vous utilisez actuellement et quelle est la performance de chaque canal ?", type: "long", label_en: "Which marketing channels are you currently using and how is each channel performing?" },
  { id: "main_message", label: "Quel est le message principal que vous souhaitez transmettre à votre audience ?", type: "long", label_en: "What is the core message you want to convey to your audience?" },
  { id: "uvp", label: "Avez-vous une proposition de valeur unique que vous mettez en avant dans vos campagnes publicitaires ?", type: "long", label_en: "Do you have a unique value proposition that you highlight in your ad campaigns?" },
  { id: "best_content", label: "Quels types de contenu performent le mieux sur vos réseaux sociaux (images, vidéos, carrousels, etc.) ?", type: "long", label_en: "Which content types perform best on your social channels (images, videos, carousels, etc.)?" },
  { id: "monthly_ad_budget", label: "Quel est votre budget mensuel moyen pour les publicités sur Facebook et TikTok ?", type: "short", label_en: "What is your average monthly ad budget on Facebook and TikTok?" },
  { id: "past_campaigns", label: "Quelles sont les campagnes publicitaires passées qui ont été particulièrement réussies ou non, et pourquoi ?", type: "long", label_en: "Which past ad campaigns worked especially well or poorly, and why?" },
  { id: "content_strategy", label: "Avez-vous une stratégie de contenu planifiée pour vos réseaux sociaux, et si oui, comment est-elle structurée ?", type: "long", label_en: "Do you have a planned content strategy for your social channels, and if so, how is it structured?" },
  { id: "competitor_diff", label: "Quels sont les principaux concurrents dans votre secteur, et comment vous différenciez-vous d'eux dans vos publicités ?", type: "long", label_en: "Who are the main competitors in your space, and how do you differentiate yourself in your ads?" },
  { id: "seasonal_events", label: "Avez-vous des événements saisonniers ou des promotions spéciales qui nécessitent une attention particulière dans vos campagnes publicitaires ?", type: "long", label_en: "Do you have seasonal events or special promotions that need extra focus in your ad campaigns?" },
  { id: "posting_frequency", label: "Quelle est la fréquence de vos publications sur Facebook et TikTok, et comment planifiez-vous votre calendrier de contenu ?", type: "long", label_en: "How often do you post on Facebook and TikTok, and how do you plan your content calendar?" },
  { id: "market_research", label: "Avez-vous réalisé des études de marché ou des analyses de la concurrence récemment ?", type: "long", label_en: "Have you done any market research or competitor analysis recently?" },
  { id: "engagement_mgmt", label: "Comment gérez-vous les commentaires et l'engagement des utilisateurs sur vos publicités et vos publications organiques ?", type: "long", label_en: "How do you handle comments and user engagement on your ads and organic posts?" },
  { id: "testimonials", label: "Avez-vous des témoignages ou des études de cas que vous utilisez dans vos publicités pour renforcer la crédibilité ?", type: "long", label_en: "Do you have testimonials or case studies you use in your ads to boost credibility?" },
  { id: "targeting_approach", label: "Quelle est votre approche pour le ciblage et la segmentation de votre audience dans vos campagnes publicitaires ?", type: "long", label_en: "What is your approach to audience targeting and segmentation in your ad campaigns?" },
  { id: "partnerships", label: "Avez-vous des partenariats ou des collaborations avec d'autres marques ou influenceurs qui influencent votre stratégie marketing ?", type: "long", label_en: "Do you have partnerships or collaborations with other brands or influencers that shape your marketing strategy?" },
  { id: "marketing_integration", label: "Comment intégrez-vous vos campagnes publicitaires sur Facebook et TikTok avec d'autres aspects de votre marketing digital (email marketing, SEO, etc.) ?", type: "long", label_en: "How do you integrate your Facebook and TikTok ad campaigns with other digital marketing efforts (email marketing, SEO, etc.)?" },
  { id: "tools", label: "Avez-vous des outils ou des plateformes spécifiques que vous utilisez pour gérer et analyser vos campagnes publicitaires ?", type: "long", label_en: "Do you use any specific tools or platforms to manage and analyze your ad campaigns?" },
  { id: "ad_objectives", label: "Quels sont vos objectifs à court et long terme pour vos campagnes publicitaires sur Facebook et TikTok ?", type: "long", label_en: "What are your short-term and long-term goals for your Facebook and TikTok ad campaigns?" },
  { id: "brand_focus", label: "Y a-t-il des aspects spécifiques de votre marque ou de votre produit que vous souhaitez mettre en avant dans vos futures campagnes publicitaires ?", type: "long", label_en: "Are there specific aspects of your brand or product you want to highlight in future ad campaigns?" },
  { id: "success_3m", label: "À quoi ressemble le succès pour vous dans 3 mois ?", type: "long", label_en: "What does success look like for you in 3 months?" },
  { id: "objections", label: "Quelles sont les objections les plus fréquentes de vos clients avant d'acheter ?", type: "long", label_en: "What are the most common objections your customers have before buying?" },
  { id: "tracking_tools", label: "Avez-vous mis en place des outils de suivi (Pixel, Analytics, etc.) ?", type: "long", label_en: "Have you set up tracking tools (Pixel, Analytics, etc.)?" },
  { id: "crm", label: "Disposez-vous d'un CRM ou d'une base de données clients que nous pouvons exploiter ?", type: "long", label_en: "Do you have a CRM or customer database we can leverage?" },
  { id: "biggest_challenge", label: "Quel a été jusqu'à présent votre plus grand défi marketing ?", type: "long", label_en: "What has been your biggest marketing challenge so far?" },
];

// Founder Scan — Étape 4
export const FOUNDER_SCAN_QUESTIONS: Question[] = [
  {
    id: "founder_self_description",
    label: "En une phrase, comment vous décririez-vous en tant que fondateur·rice ?",
    type: "short",
    label_en: "In one sentence, how would you describe yourself as a founder?",
  },
  {
    id: "founder_strengths",
    label: "Quelles sont vos 3 principales forces en tant que fondateur·rice ?",
    type: "multi_choice",
    allowOther: true,
    options: [
      "Storytelling",
      "Image de marque",
      "Opérations",
      "Vente / Conclusion de ventes",
      "Leadership",
      "Développement de produit",
      "Stratégie marketing",
      "Planification financière",
      "Recrutement / Construction d'équipe",
    ],
    label_en: "What are your top 3 strengths as a founder?",
    options_en: [
      "Storytelling",
      "Branding",
      "Operations",
      "Sales / Closing",
      "Leadership",
      "Product development",
      "Marketing strategy",
      "Financial planning",
      "Hiring / Team building",
    ],
  },
  {
    id: "founder_weakness",
    label: "Quelle est votre plus grande faiblesse personnelle ou votre principal frein ?",
    type: "short",
    label_en: "What is your biggest personal weakness or main blocker?",
  },
  {
    id: "success_definition",
    label: "Comment définissez-vous le succès dans votre entreprise en ce moment ?",
    type: "long",
    label_en: "How do you define success in your business right now?",
  },
  {
    id: "update_preference",
    label: "Comment préférez-vous recevoir des mises à jour ?",
    type: "multi_choice",
    allowOther: true,
    options: [
      "Messages hebdomadaires (courriel, Slack, texto)",
      "Rapports récapitulatifs bimensuels",
      "Récaps vidéo Loom",
      "Tableau de bord en temps réel uniquement",
      "Seulement lorsqu'il y a quelque chose d'important",
    ],
    label_en: "How do you prefer to receive updates?",
    options_en: [
      "Weekly messages (email, Slack, text)",
      "Bi-weekly summary reports",
      "Loom video recaps",
      "Real-time dashboard only",
      "Only when something important comes up",
    ],
  },
  {
    id: "communication_precision",
    label: "Quelle précision souhaitez-vous dans la communication ?",
    type: "scale",
    scaleMin: 1,
    scaleMax: 5,
    scaleMinLabel: "Passez les détails",
    scaleMaxLabel: "J'aime avoir le contexte complet à chaque fois",
    label_en: "How much detail do you want in communication?",
    scaleMinLabel_en: "Skip the details",
    scaleMaxLabel_en: "I like the full context every time",
  },
  {
    id: "decision_style",
    label: "Laquelle de ces affirmations vous correspond le mieux ?",
    type: "single_choice",
    allowOther: true,
    options: [
      "J'avance vite et j'aime prendre des décisions rapides",
      "Je prends le temps d'analyser avant d'agir",
      "J'aime faire du remue-méninges à voix haute",
      "Je préfère examiner en silence, puis répondre plus tard",
    ],
    label_en: "Which of these statements fits you best?",
    options_en: [
      "I move fast and like making quick decisions",
      "I take time to analyze before acting",
      "I like to brainstorm out loud",
      "I prefer to review quietly, then respond later",
    ],
  },
  {
    id: "feedback_availability",
    label: "Quelle est votre disponibilité pour le feedback ?",
    type: "multi_choice",
    allowOther: true,
    options: [
      "Je réponds tous les jours",
      "Je réponds 2 à 3 fois par semaine",
      "Je réponds lentement mais je fais confiance à votre jugement",
      "Je délègue la rétroaction à quelqu'un d'autre",
    ],
    label_en: "How available are you for feedback?",
    options_en: [
      "I respond every day",
      "I respond 2 to 3 times a week",
      "I respond slowly but I trust your judgment",
      "I delegate feedback to someone else",
    ],
  },
  {
    id: "daily_role",
    label: "Quel est votre rôle dans l'entreprise au quotidien ?",
    type: "single_choice",
    allowOther: true,
    options: [
      "Je gère tout",
      "Je dirige la vision et l'image de marque",
      "Je gère le marketing et les ventes",
      "Je suis partiellement en retrait, je supervise une équipe",
    ],
    label_en: "What is your day-to-day role in the business?",
    options_en: [
      "I handle everything",
      "I lead vision and branding",
      "I run marketing and sales",
      "I'm partly stepped back, overseeing a team",
    ],
  },
  {
    id: "decision_makers",
    label: "Qui d'autre est impliqué dans le processus décisionnel ?",
    type: "multi_choice",
    allowOther: true,
    options: [
      "Personne, seulement moi",
      "Mon/mes cofondateur(s)",
      "Mon équipe marketing interne",
      "Mon équipe des opérations",
      "Des consultants / conseillers externes",
    ],
    label_en: "Who else is involved in the decision-making process?",
    options_en: [
      "No one, just me",
      "My cofounder(s)",
      "My in-house marketing team",
      "My operations team",
      "External consultants / advisors",
    ],
  },
  {
    id: "internal_team_areas",
    label: "Avez-vous actuellement des membres de votre équipe interne qui s'occupent de l'un des domaines suivants ?",
    type: "multi_choice",
    allowOther: true,
    options: [
      "Publicités payantes",
      "Médias sociaux organiques",
      "Design",
      "Rédaction publicitaire",
      "Montage vidéo",
      "Courriels / SMS",
      "Aucun — il n'y a que moi",
    ],
    label_en: "Do you currently have in-house team members handling any of the following areas?",
    options_en: [
      "Paid ads",
      "Organic social media",
      "Design",
      "Copywriting",
      "Video editing",
      "Email / SMS",
      "None — it's just me",
    ],
  },
  {
    id: "top_priority",
    label: "Quelle est votre priorité d'affaires numéro 1 en ce moment ?",
    type: "single_choice",
    allowOther: true,
    options: [
      "Développer de façon rentable",
      "Réduire le CAC (coût d'acquisition client)",
      "Tester de nouvelles offres / tunnels de vente",
      "Mettre en place des systèmes créatifs",
      "Se positionner pour une levée de fonds",
      "Lancer un nouveau produit",
      "Renforcer l'autorité de la marque",
    ],
    label_en: "What is your #1 business priority right now?",
    options_en: [
      "Scale profitably",
      "Lower CAC (customer acquisition cost)",
      "Test new offers / sales funnels",
      "Set up creative systems",
      "Position for a fundraise",
      "Launch a new product",
      "Strengthen brand authority",
    ],
  },
  {
    id: "time_sensitive_milestones",
    label: "Y a-t-il des jalons sensibles au temps dont nous devrions être informés ?",
    type: "short",
    label_en: "Are there any time-sensitive milestones we should know about?",
  },
  {
    id: "great_creative",
    label: "Qu'est-ce que « une excellente créative » signifie pour vous ?",
    type: "short",
    label_en: "What does \"great creative\" mean to you?",
  },
  {
    id: "team_should_know",
    label: "Y a-t-il quelque chose que vous aimeriez que notre équipe sache sur votre manière de travailler, de décider ou de communiquer ?",
    type: "long",
    label_en: "Is there anything you'd like our team to know about how you work, decide or communicate?",
  },
];

// Business Deep Dive — Étape 5 (nouveau)
export const BUSINESS_DEEP_DIVE_QUESTIONS: Question[] = [
  // Section A — Rentabilité & coûts
  { id: "gross_margin", label: "Quelle est votre marge brute moyenne ?", type: "short", hint: "Exemple : 40 %, 55 %, 70 %. Écrivez « je ne sais pas » si inconnu." },
  { id: "avg_cogs", label: "Quel est votre coût de revient moyen par commande ?", type: "short", hint: "Produit, fabrication/achat, packaging, préparation, etc.", optional: true },
  {
    id: "top3_cogs",
    label: "Coût de revient approximatif de vos 3 produits ou offres principales",
    type: "composite",
    fields: [
      { key: "p1_name", label: "Produit 1 — Nom" },
      { key: "p1_price", label: "Produit 1 — Prix de vente" },
      { key: "p1_cogs", label: "Produit 1 — Coût de revient approximatif" },
      { key: "p2_name", label: "Produit 2 — Nom" },
      { key: "p2_price", label: "Produit 2 — Prix de vente" },
      { key: "p2_cogs", label: "Produit 2 — Coût de revient approximatif" },
      { key: "p3_name", label: "Produit 3 — Nom" },
      { key: "p3_price", label: "Produit 3 — Prix de vente" },
      { key: "p3_cogs", label: "Produit 3 — Coût de revient approximatif" },
    ],
  },
  { id: "avg_shipping_cost", label: "Quel est le coût moyen de livraison payé par votre entreprise par commande ?", type: "short", optional: true, hint: "Si le client paie une partie ou la totalité du shipping, précisez-le." },
  { id: "fulfillment_cost", label: "Avez-vous des coûts de fulfillment, préparation de commande ou 3PL ?", type: "long", optional: true, hint: "Si oui, indiquez le coût moyen par commande." },
  { id: "refund_rate", label: "Quel est votre taux moyen de remboursement, retour ou annulation ?", type: "short", optional: true, hint: "Exemple : 2 %, 5 %, 10 %. « Je ne sais pas » si inconnu." },
  { id: "max_cac", label: "Quel CAC maximum pouvez-vous accepter tout en restant rentable ?", type: "short", hint: "CAC = coût d'acquisition client. « Je ne sais pas » si inconnu." },
  { id: "mer_roas_goal", label: "Avez-vous un objectif minimum de MER ou ROAS ?", type: "short", optional: true, hint: "Exemple : MER 3.0, ROAS 2.5. « Je ne sais pas » si inconnu." },
  {
    id: "profitability_horizon",
    label: "Quel délai de rentabilité acceptez-vous ?",
    type: "single_choice",
    optional: true,
    allowOther: false,
    options: [
      "Rentable dès le premier achat",
      "Rentable en 30 jours",
      "Rentable en 60 jours",
      "Rentable en 90 jours",
      "Je ne sais pas",
    ],
  },
  // Section B — Produits, stock & priorités
  {
    id: "priority_offers",
    label: "Quels sont les 3 produits/offres que vous voulez pousser en priorité dans les campagnes ?",
    type: "composite",
    fields: [
      { key: "offer_1", label: "Produit / offre 1" },
      { key: "offer_2", label: "Produit / offre 2" },
      { key: "offer_3", label: "Produit / offre 3" },
    ],
  },
  { id: "excluded_products", label: "Y a-t-il des produits que vous ne voulez PAS pousser en publicité ? Pourquoi ?", type: "long" },
  { id: "best_margin_products", label: "Quels produits ont la meilleure marge ?", type: "long", optional: true, hint: "Même si ce ne sont pas vos best-sellers." },
  { id: "worst_margin_products", label: "Quels produits ont la plus faible marge ?", type: "long", optional: true, hint: "Pour éviter de scaler un produit peu rentable." },
  {
    id: "priority_stock",
    label: "Quel est le stock actuel de vos produits prioritaires ?",
    type: "composite",
    fields: [
      { key: "p1_name", label: "Produit 1 — Nom" },
      { key: "p1_stock", label: "Produit 1 — Stock disponible" },
      { key: "p1_restock", label: "Produit 1 — Date de restock (si applicable)" },
      { key: "p2_name", label: "Produit 2 — Nom" },
      { key: "p2_stock", label: "Produit 2 — Stock disponible" },
      { key: "p2_restock", label: "Produit 2 — Date de restock (si applicable)" },
      { key: "p3_name", label: "Produit 3 — Nom" },
      { key: "p3_stock", label: "Produit 3 — Stock disponible" },
      { key: "p3_restock", label: "Produit 3 — Date de restock (si applicable)" },
    ],
  },
  { id: "stockout_risk", label: "Y a-t-il un risque de rupture de stock dans les 30 à 60 prochains jours ? Si oui, quels produits ?", type: "long" },
  { id: "excluded_regions", label: "Y a-t-il des pays/provinces/régions où vous ne voulez pas vendre ou ne pouvez pas livrer efficacement ?", type: "long", optional: true, hint: "Frais trop élevés, délais trop longs, restrictions, faible rentabilité." },
  { id: "operational_constraints", label: "Avez-vous des contraintes opérationnelles importantes ?", type: "long", optional: true, hint: "Capacité de production, délais, taille d'équipe, fulfillment, saisonnalité, stock, service client, etc." },
  // Section C — Contexte business
  { id: "recent_promos", label: "Avez-vous eu des promotions importantes dans les 90 derniers jours ? Si oui, lesquelles et à quelles dates ?", type: "long", optional: true },
  { id: "recent_stockouts", label: "Avez-vous eu des ruptures de stock dans les 90 derniers jours ? Si oui, quels produits et quelles dates ?", type: "long", optional: true },
  { id: "recent_price_changes", label: "Avez-vous changé vos prix récemment ? Si oui, quand et sur quels produits ?", type: "long", optional: true },
  { id: "recent_offer_changes", label: "Avez-vous changé votre offre récemment ?", type: "long", optional: true, hint: "Nouveau bundle, garantie, produit, promo, landing, pricing, formule…" },
  { id: "recent_site_changes", label: "Avez-vous modifié votre site, votre checkout ou vos pages produits récemment ? Si oui, quoi ?", type: "long", optional: true },
  { id: "tracking_issues", label: "Avez-vous eu des problèmes de tracking connus récemment ?", type: "long", hint: "Pixel mal installé, événements manquants, Shopify mal connecté, GA4 incomplet, attribution, UTM manquants…" },
  { id: "upcoming_dates", label: "Y a-t-il des dates importantes à considérer dans les 90 prochains jours ?", type: "long", optional: true, hint: "Lancement produit, Black Friday, Noël, Ramadan, fête des Mères, collab influenceur, événement local, stock limité, PR…" },
  { id: "misleading_data", label: "Y a-t-il quelque chose dans vos données récentes qui pourrait être trompeur si on ne connaît pas le contexte ?", type: "long", optional: true, hint: "Gros mois à cause d'une promo, baisse due à rupture, hausse influenceur, changement de site, tracking brisé, nouveau produit…" },
  // Section D — Claims, légal & brand safety
  { id: "allowed_claims", label: "Quels claims ou promesses pouvons-nous utiliser dans vos publicités ?", type: "long", hint: "Ex : réduit l'acné, améliore le sommeil, 100 % naturel, résultat en 7 jours, fabriqué au Canada, approuvé par des experts." },
  { id: "forbidden_claims", label: "Quels claims ou promesses sont interdits ou à éviter ?", type: "long" },
  { id: "claim_proofs", label: "Avez-vous des preuves pour soutenir vos claims ?", type: "long", optional: true, hint: "Études, tests, certifications, avis clients, avant/après, validation pro, données internes." },
  { id: "credibility_labels", label: "Avez-vous des certifications, labels ou preuves de crédibilité ?", type: "long", optional: true, hint: "Bio, vegan, halal, sans cruauté, dermatologue, fabriqué au Canada, approuvé par X, certification qualité…" },
  { id: "testimonials_rights", label: "Avez-vous des témoignages clients que nous avons le droit d'utiliser en publicité ?", type: "long", optional: true },
  { id: "beforeafter_rights", label: "Avez-vous des photos/vidéos avant-après que nous avons le droit d'utiliser ?", type: "long", optional: true },
  { id: "sensitive_topics", label: "Y a-t-il des mots, promesses ou sujets sensibles à éviter dans vos publicités ?", type: "long", optional: true },
  { id: "ad_rejections", label: "Avez-vous déjà eu des publicités refusées par Meta, TikTok ou Google ? Si oui, pourquoi ?", type: "long", optional: true },
  // Section E — Assets créatifs & approbation
  { id: "raw_assets_drive", label: "Avez-vous un Drive avec vos assets bruts ? Collez le lien.", type: "url", placeholder: "https://drive.google.com/..." },
  {
    id: "asset_types",
    label: "Quels types d'assets avez-vous disponibles ?",
    type: "multi_choice",
    optional: true,
    allowOther: true,
    options: [
      "Photos produits",
      "Vidéos produits",
      "Vidéos UGC",
      "Témoignages clients",
      "Photos lifestyle",
      "Vidéos fondateur",
      "Vidéos entrepôt / production",
      "Avant-après",
      "Logos",
      "Brand guidelines",
      "Anciennes publicités",
      "Peu ou pas d'assets disponibles",
    ],
  },
  { id: "raw_unedited_videos", label: "Avez-vous des vidéos brutes non montées que nous pouvons réutiliser ?", type: "long", optional: true },
  { id: "founder_shoot_availability", label: "Le fondateur ou un membre de l'équipe est-il disponible pour tourner du contenu si nécessaire ?", type: "long", optional: true },
  { id: "creators_available", label: "Avez-vous des clients, influenceurs ou ambassadeurs disponibles pour créer du contenu ?", type: "long", optional: true },
  { id: "creative_styles_like", label: "Quels styles créatifs aimez-vous ou voulez-vous reproduire ?", type: "long", optional: true, hint: "Vous pouvez coller des liens d'exemples." },
  { id: "creative_styles_avoid", label: "Quels styles créatifs voulez-vous absolument éviter ?", type: "long", optional: true },
  { id: "creative_approver", label: "Qui approuve les créatives dans votre équipe ?", type: "short" },
  {
    id: "approval_delay",
    label: "Quel est le délai normal d'approbation des créatives ?",
    type: "single_choice",
    allowOther: false,
    options: [
      "Moins de 24h",
      "24-48h",
      "3-5 jours",
      "Plus de 5 jours",
      "Dépend du livrable",
    ],
  },
  { id: "approval_stakeholders", label: "Y a-t-il plusieurs personnes impliquées dans l'approbation ? Si oui, qui doit valider ?", type: "long", optional: true },
  { id: "approval_requirements", label: "Que doit absolument respecter une créative pour être approuvée par votre équipe ?", type: "long", optional: true },
];

// Regroupement des 43 questions du quiz « Compréhension de votre univers digital » en 6 blocs
export interface QuizBlock {
  id: string;
  title: string;
  description?: string;
  questionIds: string[];
  title_en?: string;
  description_en?: string;
}

export function localizeBlock(b: QuizBlock, lang: Lang): QuizBlock {
  if (lang !== "en") return b;
  return {
    ...b,
    title: b.title_en ?? b.title,
    description: b.description_en ?? b.description,
  };
}

export const WELCOME_BLOCKS: QuizBlock[] = [
  {
    id: "vision_mission",
    title: "Vision & Mission",
    description: "Posons les bases : votre raison d'être et votre cap.",
    questionIds: ["mission", "vision", "best_solution", "competitors", "acv"],
    title_en: "Vision & Mission",
    description_en: "Let's set the foundation: your purpose and your direction.",
  },
  {
    id: "business_perf",
    title: "Business & Performance",
    description: "Vos chiffres clés et votre historique commercial.",
    questionIds: [
      "vmc",
      "top_product",
      "last_agency",
      "client_acquisition",
      "monthly_revenue",
      "yearly_revenue",
      "weekly_budget",
      "monthly_ad_budget",
    ],
    title_en: "Business & Performance",
    description_en: "Your key numbers and commercial track record.",
  },
  {
    id: "audience_market",
    title: "Client cible & Marché",
    description: "À qui parlez-vous, et où ?",
    questionIds: [
      "target_client",
      "target_country",
      "audience_profile",
      "targeting_approach",
      "market_research",
    ],
    title_en: "Target Customer & Market",
    description_en: "Who are you speaking to, and where?",
  },
  {
    id: "brand_assets",
    title: "Marque & Assets",
    description: "Votre identité et le matériel disponible.",
    questionIds: [
      "brand_colors",
      "creatives_drive",
      "assets_drive",
      "main_message",
      "uvp",
    ],
    title_en: "Brand & Assets",
    description_en: "Your identity and the material you have on hand.",
  },
  {
    id: "marketing_ads",
    title: "Marketing & Publicités",
    description: "Vos canaux, contenus et campagnes.",
    questionIds: [
      "marketing_goals",
      "channels_perf",
      "best_content",
      "past_campaigns",
      "content_strategy",
      "competitor_diff",
      "seasonal_events",
      "posting_frequency",
      "engagement_mgmt",
      "testimonials",
      "partnerships",
      "marketing_integration",
    ],
    title_en: "Marketing & Ads",
    description_en: "Your channels, content and campaigns.",
  },
  {
    id: "tools_goals",
    title: "Outils, Objectifs & Défis",
    description: "Pour finir : votre stack et vos ambitions.",
    questionIds: [
      "tools",
      "tracking_tools",
      "crm",
      "ad_objectives",
      "brand_focus",
      "success_3m",
      "objections",
      "biggest_challenge",
    ],
    title_en: "Tools, Goals & Challenges",
    description_en: "To wrap up: your stack and your ambitions.",
  },
];

export const QUIZ_WEBHOOK_URL = "https://hook.us1.make.com/z5notv79fqjj9qg9e6r1nnfsefj8zasp";
export const FOUNDER_SCAN_WEBHOOK_URL = "https://hook.us1.make.com/939rnmwmxldwbmse2j6k4qdqmgwi8s92";

export type FormKey = "welcome" | "founder_scan";

export const WEBHOOK_URLS: Record<FormKey, string> = {
  welcome: QUIZ_WEBHOOK_URL,
  founder_scan: FOUNDER_SCAN_WEBHOOK_URL,
};

// ---------------------------------------------------------------------------
// Business type variants (Ecommerce vs Local Service)
// ---------------------------------------------------------------------------
import {
  WELCOME_QUESTIONS_LS,
  WELCOME_BLOCKS_LS,
  FOUNDER_SCAN_QUESTIONS_LS,
} from "./quizQuestionsLocalService";

export type BusinessType = "ecommerce" | "local_service" | "saas";

export function getWelcomeQuestions(bt: BusinessType | null | undefined) {
  return bt === "local_service"
    ? { questions: WELCOME_QUESTIONS_LS, blocks: WELCOME_BLOCKS_LS }
    : { questions: WELCOME_QUESTIONS, blocks: WELCOME_BLOCKS };
}

export function getFounderScanQuestions(bt: BusinessType | null | undefined): Question[] {
  return bt === "local_service" ? FOUNDER_SCAN_QUESTIONS_LS : FOUNDER_SCAN_QUESTIONS;
}

