import { supabase } from "@/integrations/supabase/client";
import {
  buildCustomerCohortAnalysis,
  type CustomerCohortAnalysis,
  type CustomerCohortOptions,
  type CustomerTransaction,
} from "./customerCohorts";

export type CustomerTransactionRow = CustomerTransaction & {
  id: string;
  client_id: string;
  created_by?: string | null;
  raw_payload?: Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type CustomerTransactionDraft = CustomerTransaction & {
  raw_payload?: Record<string, unknown> | null;
};

type QueryRow = Record<string, unknown>;

function optionalString(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function optionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function normalizeCustomerTransactionRow(row: QueryRow): CustomerTransactionRow {
  return {
    id: String(row.id ?? ""),
    client_id: String(row.client_id ?? ""),
    customer_id: optionalString(row.customer_id) ?? "",
    transaction_date: optionalString(row.transaction_date) ?? "",
    order_id: optionalString(row.order_id),
    revenue: optionalNumber(row.revenue),
    gross_profit: optionalNumber(row.gross_profit),
    acquisition_channel: optionalString(row.acquisition_channel),
    product_key: optionalString(row.product_key),
    segment_key: optionalString(row.segment_key),
    source: optionalString(row.source) ?? "manual",
    raw_payload: (row.raw_payload as Record<string, unknown> | null | undefined) ?? null,
    created_by: optionalString(row.created_by),
    created_at: optionalString(row.created_at),
    updated_at: optionalString(row.updated_at),
  };
}

export function toCustomerTransactionPayload(clientId: string, draft: CustomerTransactionDraft) {
  return {
    client_id: clientId,
    customer_id: draft.customer_id.trim(),
    transaction_date: draft.transaction_date.slice(0, 10),
    order_id: draft.order_id?.trim() || null,
    revenue: optionalNumber(draft.revenue),
    gross_profit: optionalNumber(draft.gross_profit),
    acquisition_channel: draft.acquisition_channel?.trim() || null,
    product_key: draft.product_key?.trim() || null,
    segment_key: draft.segment_key?.trim() || null,
    source: draft.source?.trim() || "manual",
    raw_payload: draft.raw_payload ?? null,
  };
}

export async function fetchCustomerTransactions(clientId: string): Promise<CustomerTransactionRow[]> {
  const { data, error } = await supabase
    .from("gos_customer_transactions" as never)
    .select("*")
    .eq("client_id", clientId)
    .order("transaction_date", { ascending: true });

  if (error) throw error;
  return ((data ?? []) as QueryRow[]).map(normalizeCustomerTransactionRow);
}

export async function createManualCustomerTransaction(
  clientId: string,
  draft: CustomerTransactionDraft,
): Promise<CustomerTransactionRow> {
  const payload = toCustomerTransactionPayload(clientId, { ...draft, source: draft.source ?? "manual" });
  const { data, error } = await supabase
    .from("gos_customer_transactions" as never)
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;
  return normalizeCustomerTransactionRow(data as QueryRow);
}

export async function upsertCustomerTransactions(
  clientId: string,
  drafts: CustomerTransactionDraft[],
): Promise<CustomerTransactionRow[]> {
  const payload = drafts.map((draft) => toCustomerTransactionPayload(clientId, draft));
  const { data, error } = await supabase
    .from("gos_customer_transactions" as never)
    .upsert(payload, { onConflict: "client_id,source,order_id" })
    .select("*");

  if (error) throw error;
  return ((data ?? []) as QueryRow[]).map(normalizeCustomerTransactionRow);
}

export async function runCustomerCohortAnalysisForClient(
  clientId: string,
  options: CustomerCohortOptions = {},
): Promise<CustomerCohortAnalysis> {
  const transactions = await fetchCustomerTransactions(clientId);
  return buildCustomerCohortAnalysis(transactions, options);
}
