// Client TDIA — parle uniquement au FastAPI `tdia-audit` via l'edge function
// `tdia-proxy` (repointer TDIA_API_BASE_URL sur l'URL publique du FastAPI).
// Le pipeline actuel ne produit que collecte + Excel — pas de PDF strategique.

import { apiGet, apiPost, proxyUrl } from "./api";
import type { AuditRun, AuditSummary, Client } from "./types";

export interface CreateAuditRequest {
  client_name: string;
  onboarding: Record<string, unknown>;
  options?: Record<string, unknown>;
}

export interface CreateAuditResponse {
  client: string;
  audit_id: string;
  status_url: string;
}

export const tdia = {
  health: () => apiGet<{ ok: boolean }>("/health"),

  // Clients — scan filesystem cote backend
  listClients: () => apiGet<Client[]>("/clients"),
  listClientAudits: (slug: string) =>
    apiGet<AuditSummary[]>(`/clients/${encodeURIComponent(slug)}/audits`),

  // Audits
  createAudit: (body: CreateAuditRequest) =>
    apiPost<CreateAuditResponse>("/audits", body),
  getAudit: (client: string, auditId: string) =>
    apiGet<AuditRun>(
      `/audits/${encodeURIComponent(client)}/${encodeURIComponent(auditId)}`,
    ),
  getBusinessContext: (client: string, auditId: string) =>
    apiGet<string>(
      `/audits/${encodeURIComponent(client)}/${encodeURIComponent(auditId)}/analysis/business-context`,
    ),

  // Telechargements — URLs directes via le proxy (pour attribuer target=_blank / download)
  reviewsXlsxUrl: (client: string, auditId: string) =>
    proxyUrl(`/audits/${encodeURIComponent(client)}/${encodeURIComponent(auditId)}/reviews.xlsx`),
  auditDataXlsxUrl: (client: string, auditId: string) =>
    proxyUrl(`/audits/${encodeURIComponent(client)}/${encodeURIComponent(auditId)}/audit_data.xlsx`),
};

export type TdiaService = typeof tdia;
