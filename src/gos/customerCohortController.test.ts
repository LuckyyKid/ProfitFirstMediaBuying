import { describe, expect, it, vi } from "vitest";
import {
  normalizeCustomerTransactionRow,
  toCustomerTransactionPayload,
  type CustomerTransactionDraft,
} from "./customerCohortController";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

describe("customer cohort controller mappers", () => {
  it("normalizes Supabase transaction rows into model-safe transactions", () => {
    const row = normalizeCustomerTransactionRow({
      id: "tx-1",
      client_id: "client-1",
      customer_id: " C-001 ",
      transaction_date: "2026-01-15",
      order_id: "",
      revenue: "125.50",
      gross_profit: "75.25",
      acquisition_channel: " meta ",
      source: null,
    });

    expect(row.customer_id).toBe("C-001");
    expect(row.order_id).toBeNull();
    expect(row.revenue).toBe(125.5);
    expect(row.gross_profit).toBe(75.25);
    expect(row.acquisition_channel).toBe("meta");
    expect(row.source).toBe("manual");
  });

  it("creates insert payloads for manual or integration-fed data", () => {
    const draft: CustomerTransactionDraft = {
      customer_id: " C-001 ",
      transaction_date: "2026-01-15T12:00:00Z",
      order_id: " O-100 ",
      revenue: 99,
      gross_profit: null,
      acquisition_channel: " google ",
      source: "integration",
    };

    expect(toCustomerTransactionPayload("client-1", draft)).toEqual({
      client_id: "client-1",
      customer_id: "C-001",
      transaction_date: "2026-01-15",
      order_id: "O-100",
      revenue: 99,
      gross_profit: null,
      acquisition_channel: "google",
      product_key: null,
      segment_key: null,
      source: "integration",
      raw_payload: null,
    });
  });
});
