// Voice onboarding blocks — 9 short vocal prompts (~2 min each) that replace
// the qualitative sections of Welcome, Founder Scan and Business Deep Dive.
// Each block's transcript will later be parsed by an LLM to fill the field IDs
// listed in `targetFieldIds` (mirroring the ids in src/data/quizQuestions.ts).
//
// Two variants live side-by-side: one for `ecommerce` clients (base field IDs)
// and one for `local_service` clients (ls_* field IDs). The runtime picks the
// right set via getVoiceBlocksForType(bt).

import type { BusinessType, FormKey } from "./quizQuestions";

export interface VoiceBlock {
  id: string;
  formKey: FormKey;
  businessType: BusinessType;
  prompt: string;
  subtext?: string;
  // Soft cap shown to the founder as a countdown ("2 min" not "unlimited").
  targetDurationSec: number;
  // Trigger the "vous voulez ajouter quelque chose ?" prompt when the answer
  // is shorter than ~10s. Off for closed/factual prompts.
  isOpen: boolean;
  // Field IDs from quizQuestions.ts that this block's transcript will feed.
  targetFieldIds: string[];
}

export const VOICE_BLOCKS: VoiceBlock[] = [
  // ===========================================================================
  // ECOMMERCE variant
  // ===========================================================================

  // ---------------------------------------------------------------------------
  // Welcome — "Compréhension de votre univers digital"
  // ---------------------------------------------------------------------------
  {
    id: "welcome_business_in_2min",
    formKey: "welcome",
    businessType: "ecommerce",
    prompt: "Votre boîte en 2 minutes.",
    subtext:
      "Votre mission, où vous voulez être dans 1 an et 10 ans, ce qui vous rend meilleur que la concurrence, et votre argument clé de vente.",
    targetDurationSec: 120,
    isOpen: true,
    targetFieldIds: ["mission", "vision", "best_solution", "acv"],
  },
  {
    id: "welcome_client_and_message",
    formKey: "welcome",
    businessType: "ecommerce",
    prompt: "Votre client et votre message.",
    subtext:
      "Qui est votre client cible (le plus de détails possible), son profil, et le message principal que vous voulez faire passer — votre proposition de valeur unique.",
    targetDurationSec: 150,
    isOpen: true,
    targetFieldIds: ["target_client", "audience_profile", "main_message", "uvp"],
  },
  {
    id: "welcome_history_and_ambitions",
    formKey: "welcome",
    businessType: "ecommerce",
    prompt: "Votre histoire et vos ambitions.",
    subtext:
      "Comment vous avez obtenu vos clients jusqu'ici, votre dernière expérience en agence, ce qui a marché ou pas dans vos campagnes, à quoi ressemble le succès dans 3 mois, et votre plus grand défi marketing.",
    targetDurationSec: 180,
    isOpen: true,
    targetFieldIds: [
      "last_agency",
      "client_acquisition",
      "past_campaigns",
      "success_3m",
      "biggest_challenge",
    ],
  },

  // ---------------------------------------------------------------------------
  // Founder Scan
  // ---------------------------------------------------------------------------
  {
    id: "founder_you_in_30s",
    formKey: "founder_scan",
    businessType: "ecommerce",
    prompt: "Vous, en 30 secondes.",
    subtext:
      "Comment vous vous décririez comme fondateur ou fondatrice, et votre plus grande faiblesse ou principal frein.",
    targetDurationSec: 90,
    isOpen: true,
    targetFieldIds: ["founder_self_description", "founder_weakness"],
  },
  {
    id: "founder_success_and_creative",
    formKey: "founder_scan",
    businessType: "ecommerce",
    prompt: "Votre définition du succès, et d'une bonne créative.",
    subtext:
      "Comment vous définissez le succès aujourd'hui dans votre boîte, et ce qu'une excellente créative signifie pour vous.",
    targetDurationSec: 120,
    isOpen: true,
    targetFieldIds: ["success_definition", "great_creative"],
  },
  {
    id: "founder_how_to_work_with_you",
    formKey: "founder_scan",
    businessType: "ecommerce",
    prompt: "Ce que notre équipe doit savoir sur vous.",
    subtext:
      "Votre façon de travailler, de décider, de communiquer — et les jalons sensibles au temps qu'on devrait connaître.",
    targetDurationSec: 120,
    isOpen: true,
    targetFieldIds: ["team_should_know", "time_sensitive_milestones"],
  },

  // ---------------------------------------------------------------------------
  // Business Deep Dive
  // ---------------------------------------------------------------------------
  {
    id: "bdd_products_and_constraints",
    formKey: "business_deep_dive",
    businessType: "ecommerce",
    prompt: "Vos produits et vos contraintes ops.",
    subtext:
      "Ce que vous ne voulez PAS pousser en pub et pourquoi, vos meilleurs et pires produits en marge, les risques de rupture, vos contraintes opérationnelles, et les régions à éviter.",
    targetDurationSec: 150,
    isOpen: true,
    targetFieldIds: [
      "excluded_products",
      "best_margin_products",
      "worst_margin_products",
      "stockout_risk",
      "operational_constraints",
      "excluded_regions",
    ],
  },
  {
    id: "bdd_last_90_days",
    formKey: "business_deep_dive",
    businessType: "ecommerce",
    prompt: "Racontez les 90 derniers jours et les 90 prochains.",
    subtext:
      "Promos, ruptures, changements de prix ou d'offre, modifs du site, problèmes de tracking, dates importantes à venir, et tout ce qui pourrait rendre vos données trompeuses sans contexte.",
    targetDurationSec: 180,
    isOpen: true,
    targetFieldIds: [
      "recent_promos",
      "recent_stockouts",
      "recent_price_changes",
      "recent_offer_changes",
      "recent_site_changes",
      "tracking_issues",
      "upcoming_dates",
      "misleading_data",
    ],
  },
  {
    id: "bdd_claims_and_creative",
    formKey: "business_deep_dive",
    businessType: "ecommerce",
    prompt: "Claims, garde-fous et direction créative.",
    subtext:
      "Ce qu'on a le droit de dire et ce qu'on ne doit surtout pas dire, les preuves à disposition, les sujets sensibles, et les styles créatifs que vous aimez ou détestez.",
    targetDurationSec: 150,
    isOpen: true,
    targetFieldIds: [
      "allowed_claims",
      "forbidden_claims",
      "claim_proofs",
      "sensitive_topics",
      "ad_rejections",
      "creative_styles_like",
      "creative_styles_avoid",
      "approval_requirements",
    ],
  },

  // ===========================================================================
  // LOCAL SERVICE variant (ls_* field IDs)
  // ===========================================================================

  // ---------------------------------------------------------------------------
  // Welcome LS — mission, services, clients
  // ---------------------------------------------------------------------------
  {
    id: "ls_welcome_business_in_2min",
    formKey: "welcome",
    businessType: "local_service",
    prompt: "Votre boîte en 2 minutes.",
    subtext:
      "Votre mission, où vous voulez être dans 12 mois et dans 5 à 10 ans, pourquoi un client devrait vous choisir plutôt qu'un compétiteur, et votre proposition de valeur principale.",
    targetDurationSec: 150,
    isOpen: true,
    targetFieldIds: [
      "ls_mission",
      "ls_vision_12m",
      "ls_vision_5_10y",
      "ls_why_choose_you",
      "ls_value_prop",
    ],
  },
  {
    id: "ls_welcome_services_and_priorities",
    formKey: "welcome",
    businessType: "local_service",
    prompt: "Vos services et vos priorités.",
    subtext:
      "Les 3 services que vous voulez pousser en priorité, ceux que vous ne voulez surtout pas pousser et pourquoi, les plus et les moins profitables, ceux qui prennent trop de temps ou causent le plus de callbacks.",
    targetDurationSec: 150,
    isOpen: true,
    targetFieldIds: [
      "ls_priority_services",
      "ls_excluded_services",
      "ls_most_profitable",
      "ls_least_profitable",
      "ls_time_heavy_services",
      "ls_callback_services",
    ],
  },
  {
    id: "ls_welcome_clients_and_acquisition",
    formKey: "welcome",
    businessType: "local_service",
    prompt: "Votre client idéal et comment vous les obtenez.",
    subtext:
      "Qui est votre client idéal, quel type de client vous voulez éviter, les objections qui reviennent souvent, comment vous avez obtenu vos clients jusqu'ici, et votre plus grand défi marketing actuel.",
    targetDurationSec: 180,
    isOpen: true,
    targetFieldIds: [
      "ls_ideal_client",
      "ls_avoid_clients",
      "ls_common_objections",
      "ls_client_acquisition",
      "ls_biggest_marketing_challenge",
    ],
  },

  // ---------------------------------------------------------------------------
  // Founder Scan LS
  // ---------------------------------------------------------------------------
  {
    id: "ls_founder_you_in_30s",
    formKey: "founder_scan",
    businessType: "local_service",
    prompt: "Vous, en 30 secondes.",
    subtext:
      "Comment vous vous décririez comme propriétaire, votre plus grande force, votre plus grande faiblesse, et ce qui vous stresse le plus dans la business en ce moment.",
    targetDurationSec: 120,
    isOpen: true,
    targetFieldIds: [
      "ls_owner_self_description",
      "ls_owner_strength",
      "ls_owner_weakness",
      "ls_biggest_stress",
    ],
  },
  {
    id: "ls_founder_daily_and_bottlenecks",
    formKey: "founder_scan",
    businessType: "local_service",
    prompt: "Votre quotidien et vos goulots d'étranglement.",
    subtext:
      "Votre rôle quotidien, les tâches qui dépendent encore trop de vous, les décisions que l'équipe ne peut pas prendre sans vous, votre priorité numéro 1 pour les 90 prochains jours et à quoi ressemblerait un succès concret dans 3 mois.",
    targetDurationSec: 150,
    isOpen: true,
    targetFieldIds: [
      "ls_daily_role",
      "ls_owner_dependent_tasks",
      "ls_decisions_without_you",
      "ls_priority_90d",
      "ls_success_3m",
    ],
  },
  {
    id: "ls_founder_openness_and_working_style",
    formKey: "founder_scan",
    businessType: "local_service",
    prompt: "Votre ouverture au changement et votre style de travail.",
    subtext:
      "Êtes-vous ouvert à changer votre processus de qualification, à repricer certains jobs, à ce qu'une IA préqualifie des leads ? Qu'est-ce que vous ne voulez surtout pas automatiser, et ce que notre équipe doit savoir sur votre manière de communiquer et décider ?",
    targetDurationSec: 150,
    isOpen: true,
    targetFieldIds: [
      "ls_open_to_change_qualification",
      "ls_open_to_reprice_jobs",
      "ls_open_to_ai_qualification",
      "ls_never_automate",
      "ls_team_should_know",
    ],
  },

  // ---------------------------------------------------------------------------
  // Business Deep Dive LS
  // ---------------------------------------------------------------------------
  {
    id: "ls_bdd_services_focus",
    formKey: "business_deep_dive",
    businessType: "local_service",
    prompt: "Quels services pousser, arrêter ou repricer.",
    subtext:
      "Les services à pousser dans les 90 prochains jours, ceux à arrêter, limiter ou repricer, vos sous-traitants (le cas échéant), et les clients qui paient souvent en retard.",
    targetDurationSec: 150,
    isOpen: true,
    targetFieldIds: [
      "ls_push_services_90d",
      "ls_stop_or_reprice",
      "ls_subcontractors",
      "ls_late_payers",
    ],
  },
  {
    id: "ls_bdd_lead_flow_and_qualification",
    formKey: "business_deep_dive",
    businessType: "local_service",
    prompt: "Votre flux de leads et votre qualification.",
    subtext:
      "Votre script de qualification, les questions que vous posez avant de booker, ce qui se passe quand vous manquez un appel, si vous avez déjà perdu des jobs à cause d'un follow-up trop lent, et ce qui rend une soumission difficile à closer.",
    targetDurationSec: 180,
    isOpen: true,
    targetFieldIds: [
      "ls_qualification_script",
      "ls_prebook_questions",
      "ls_missed_call_process",
      "ls_lost_from_slow_follow_up",
      "ls_hard_to_close_quotes",
    ],
  },
  {
    id: "ls_bdd_claims_and_goals",
    formKey: "business_deep_dive",
    businessType: "local_service",
    prompt: "Vos promesses, vos contraintes et votre objectif TDIa.",
    subtext:
      "Ce qu'on a le droit de promettre et ce qu'on doit éviter, les contraintes légales ou réglementaires, les mots à éviter, la chose qui aurait le plus d'impact si on la corrigeait dans 30 jours, à quoi ressemblerait un succès dans 90 jours, et ce qui ferait dire « TDIa nous a vraiment aidés ».",
    targetDurationSec: 180,
    isOpen: true,
    targetFieldIds: [
      "ls_allowed_promises",
      "ls_forbidden_promises",
      "ls_regulatory_constraints",
      "ls_forbidden_words",
      "ls_top_fix_30d",
      "ls_decision_to_understand",
      "ls_success_90d",
      "ls_tdia_success_definition",
    ],
  },
];

export const VOICE_TOTAL_BLOCKS = VOICE_BLOCKS.length;

export function findVoiceBlock(id: string): VoiceBlock | undefined {
  return VOICE_BLOCKS.find((b) => b.id === id);
}

// Filter blocks by client business_type. `null`/`undefined` defaults to
// ecommerce so legacy clients without a business_type see the original set.
export function getVoiceBlocksForType(
  bt: BusinessType | null | undefined,
): VoiceBlock[] {
  const type: BusinessType = bt === "local_service" ? "local_service" : "ecommerce";
  return VOICE_BLOCKS.filter((b) => b.businessType === type);
}

// IDs of written-form fields covered by the vocal blocks for a given form and
// business type. The strip helpers below use this to remove already-covered
// questions from the written forms rendered on Step3/4/5.
export function getVocalCoveredFieldIds(
  formKey: FormKey,
  bt: BusinessType | null | undefined,
): Set<string> {
  const type: BusinessType = bt === "local_service" ? "local_service" : "ecommerce";
  const ids = new Set<string>();
  for (const b of VOICE_BLOCKS) {
    if (b.formKey !== formKey) continue;
    if (b.businessType !== type) continue;
    for (const f of b.targetFieldIds) ids.add(f);
  }
  return ids;
}

export function stripVocalQuestions<T extends { id: string }>(
  questions: T[],
  formKey: FormKey,
  bt: BusinessType | null | undefined,
): T[] {
  const covered = getVocalCoveredFieldIds(formKey, bt);
  if (covered.size === 0) return questions;
  return questions.filter((q) => !covered.has(q.id));
}

export function stripVocalFromBlocks<B extends { questionIds: string[] }>(
  blocks: B[],
  formKey: FormKey,
  bt: BusinessType | null | undefined,
): B[] {
  const covered = getVocalCoveredFieldIds(formKey, bt);
  if (covered.size === 0) return blocks;
  return blocks
    .map((b) => ({ ...b, questionIds: b.questionIds.filter((id) => !covered.has(id)) }))
    .filter((b) => b.questionIds.length > 0);
}
