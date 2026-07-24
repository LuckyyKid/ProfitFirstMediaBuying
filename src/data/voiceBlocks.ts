// Voice onboarding blocks — 9 short vocal prompts (~2 min each) that replace
// the qualitative sections of Welcome, Founder Scan and Business Deep Dive.
// Each block's transcript will later be parsed by an LLM to fill the field IDs
// listed in `targetFieldIds` (mirroring the ids in src/data/quizQuestions.ts).

import type { FormKey } from "./quizQuestions";

export interface VoiceBlock {
  id: string;
  formKey: FormKey;
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
  // ---------------------------------------------------------------------------
  // Welcome — "Compréhension de votre univers digital"
  // ---------------------------------------------------------------------------
  {
    id: "welcome_business_in_2min",
    formKey: "welcome",
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
];

export const VOICE_TOTAL_BLOCKS = VOICE_BLOCKS.length;

export function findVoiceBlock(id: string): VoiceBlock | undefined {
  return VOICE_BLOCKS.find((b) => b.id === id);
}

// IDs of written-form fields covered by the vocal blocks for a given form.
// The Local Service variant of the quiz uses different IDs (ls_*), so it
// won't match anything here — LS clients see the full written form for now.
export function getVocalCoveredFieldIds(formKey: FormKey): Set<string> {
  const ids = new Set<string>();
  for (const b of VOICE_BLOCKS) {
    if (b.formKey !== formKey) continue;
    for (const f of b.targetFieldIds) ids.add(f);
  }
  return ids;
}

export function stripVocalQuestions<T extends { id: string }>(
  questions: T[],
  formKey: FormKey,
): T[] {
  const covered = getVocalCoveredFieldIds(formKey);
  if (covered.size === 0) return questions;
  return questions.filter((q) => !covered.has(q.id));
}

export function stripVocalFromBlocks<B extends { questionIds: string[] }>(
  blocks: B[],
  formKey: FormKey,
): B[] {
  const covered = getVocalCoveredFieldIds(formKey);
  if (covered.size === 0) return blocks;
  return blocks
    .map((b) => ({ ...b, questionIds: b.questionIds.filter((id) => !covered.has(id)) }))
    .filter((b) => b.questionIds.length > 0);
}
