import { describe, expect, it, vi } from "vitest";
import {
  normalizeCampaignCategoryRow,
  normalizeCampaignConfigCampaignRow,
  normalizeCampaignConfigClientRow,
  toCampaignMetadataUpdatePayload,
  toCategoryUpdatePayload,
} from "./campaignConfigurationController";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

describe("campaign configuration controller", () => {
  it("normalizes client rows for selected-client context", () => {
    expect(normalizeCampaignConfigClientRow({
      id: "client-1",
      client_code: "ABC",
      company_name: "Brand",
      business_type: "ECOMMERCE",
      current_phase: "scale",
      risk_level: "watch",
      industry: "",
    })).toEqual({
      id: "client-1",
      client_code: "ABC",
      company_name: "Brand",
      business_type: "ECOMMERCE",
      current_phase: "scale",
      risk_level: "watch",
      industry: null,
      am_owner: null,
      launch_target_date: null,
    });
  });

  it("normalizes campaign category and campaign rows", () => {
    expect(normalizeCampaignCategoryRow({
      id: "cat-1",
      client_id: "client-1",
      name: " Prospecting ",
      kind: "",
      target_cpa: "50",
      target_daily_budget: "",
      active: null,
      sort_order: "2",
    })).toEqual({
      id: "cat-1",
      client_id: "client-1",
      name: "Prospecting",
      kind: "prospecting",
      target_cpa: 50,
      target_daily_budget: null,
      active: true,
      sort_order: 2,
    });

    expect(normalizeCampaignConfigCampaignRow({
      id: "camp-1",
      client_id: "client-1",
      category_id: "",
      name: " Meta ",
      platform: "",
      external_id: " ext ",
      current_daily_budget: "120",
      active: false,
      notes: "",
    })).toEqual({
      id: "camp-1",
      client_id: "client-1",
      category_id: null,
      name: "Meta",
      platform: "meta",
      external_id: "ext",
      current_daily_budget: 120,
      active: false,
      notes: null,
    });
  });

  it("builds category metadata update payloads", () => {
    expect(toCategoryUpdatePayload({
      name: " Retargeting ",
      target_cpa: 40,
      target_daily_budget: null,
      active: false,
    })).toEqual({
      name: "Retargeting",
      target_cpa: 40,
      target_daily_budget: null,
      active: false,
    });
  });

  it("excludes budget from direct campaign metadata updates", () => {
    expect(toCampaignMetadataUpdatePayload({
      name: " New Name ",
      category_id: "",
      current_daily_budget: 999,
      active: true,
    })).toEqual({
      name: "New Name",
      category_id: null,
      active: true,
    });
  });
});
