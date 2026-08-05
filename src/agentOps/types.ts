// Types alignes sur le pipeline FastAPI tdia-audit (app/main.py + storage.set_status).
// Le pipeline actuel fait UNIQUEMENT la collecte de donnees et l'export
// consolide reviews.xlsx + audit_data.xlsx — pas de PDF strategique.

export type AuditState = "queued" | "running" | "completed" | "failed" | "stalled";
export type StepState = "running" | "done" | "error";

export interface Client {
  slug: string;
  name: string;
  website?: string | null;
  audits_count: number;
  latest_audit_id: string | null;
}

export interface AuditStep {
  state: StepState;
  detail: string;
  ts: number; // epoch seconds
}

export interface AuditSummary {
  client: string;
  audit_id: string;
  state: AuditState;
  current: string | null;
  progress: number; // 0..100 derive de steps_done / steps_total
  steps_total: number;
  steps_done: number;
  steps_error: number;
  last_step_ts: number;
}

export interface AuditArtifact {
  kind: "reviews_xlsx" | "reviews_csv" | "audit_data_xlsx" | "business_context";
  title: string;
  path: string; // relatif au /audits/{c}/{id}/... (sert a construire l'URL)
}

export interface AuditRun extends AuditSummary {
  steps: Record<string, AuditStep>;
  onboarding_name?: string | null;
  onboarding_website?: string | null;
  artifacts: AuditArtifact[];
}

// Labels humains pour les steps reels du pipeline (voir tdia-audit/app/pipeline.py).
// Utilisation: STEP_LABELS[stepName] ?? stepName.
export const STEP_LABELS: Record<string, string> = {
  context: "Contexte business (LLM)",
  collect_trustpilot: "Trustpilot",
  collect_fb_ads: "Meta Ad Library",
  collect_reddit: "Reddit (posts bruts)",
  filter_reddit: "Reddit (filtre pertinence)",
  collect_youtube: "YouTube",
  collect_trends: "Google Trends",
  collect_semrush: "SEMrush",
  collect_client_pages: "Pages client",
  collect_competitor_pages: "Pages competiteurs",
  collect_articles: "Articles industrie",
  collect_industry_us: "US Census MARTS",
  collect_industry_ca: "StatCan",
  collect_sec_filings: "SEC EDGAR",
  collect_gmaps_reviews: "Google Maps reviews",
  collect_widget_reviews: "Reviews widgets (Judge.me / Loox)",
  export_excel: "Export reviews.xlsx (IA)",
  excel: "Export audit_data.xlsx (AM)",
  pipeline: "Fin du pipeline",
};

// Un run est "stalled" si son dernier step remonte a plus de 5 minutes
// et qu'il n'est ni completed ni failed.
export const STALL_THRESHOLD_MS = 5 * 60 * 1000;
