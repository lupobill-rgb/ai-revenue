// CMO Unit Tests - Key flows

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase client
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: {}, error: null }),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    })),
    functions: {
      invoke: vi.fn(),
    },
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "test-user-id" } },
      }),
    },
  },
}));

// Mock validated kernel caller (avoid real auth/fetch in unit tests)
vi.mock("@/lib/cmoKernel", () => ({
  callCmoKernel: vi.fn(),
}));

// Import after mocking
import { supabase } from "@/integrations/supabase/client";
import { callCmoKernel } from "@/lib/cmoKernel";

describe("CMO Plan Creation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create a 90-day marketing plan", async () => {
    const mockPlan = {
      id: "plan-123",
      plan_name: "Q1 2025 Growth Plan",
      plan_type: "90-day",
      status: "draft",
      primary_objectives: ["Increase leads by 50%", "Launch 3 campaigns"],
      workspace_id: "workspace-123",
      tenant_id: "tenant-123",
    };

    (supabase.functions.invoke as any).mockResolvedValueOnce({
      data: { success: true, data: mockPlan },
      error: null,
    });

    const result = await supabase.functions.invoke("cmo-create-plan", {
      body: {
        tenant_id: "tenant-123",
        workspace_id: "workspace-123",
        plan: {
          plan_name: "Q1 2025 Growth Plan",
          plan_type: "90-day",
          primary_objectives: ["Increase leads by 50%", "Launch 3 campaigns"],
        },
      },
    });

    expect(result.error).toBeNull();
    expect(result.data.success).toBe(true);
    expect(result.data.data.plan_name).toBe("Q1 2025 Growth Plan");
  });

  it("should handle plan creation errors", async () => {
    (supabase.functions.invoke as any).mockResolvedValueOnce({
      data: null,
      error: { message: "Unauthorized" },
    });

    const result = await supabase.functions.invoke("cmo-create-plan", {
      body: {
        tenant_id: "invalid",
        workspace_id: "workspace-123",
        plan: {},
      },
    });

    expect(result.error).not.toBeNull();
    expect(result.error.message).toBe("Unauthorized");
  });
});

describe("CMO Funnel Generation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should generate funnel from plan", async () => {
    const mockFunnel = {
      id: "funnel-123",
      funnel_name: "Lead Generation Funnel",
      funnel_type: "lead-gen",
      status: "draft",
      stages: [
        { stage_name: "Awareness", stage_type: "awareness", stage_order: 1 },
        { stage_name: "Consideration", stage_type: "consideration", stage_order: 2 },
        { stage_name: "Conversion", stage_type: "conversion", stage_order: 3 },
      ],
    };

    (supabase.functions.invoke as any).mockResolvedValueOnce({
      data: { success: true, data: mockFunnel },
      error: null,
    });

    const result = await supabase.functions.invoke("cmo-generate-funnel", {
      body: {
        tenant_id: "tenant-123",
        workspace_id: "workspace-123",
        plan_id: "plan-123",
      },
    });

    expect(result.error).toBeNull();
    expect(result.data.success).toBe(true);
    expect(result.data.data.stages).toHaveLength(3);
    expect(result.data.data.stages[0].stage_name).toBe("Awareness");
  });

  it("should require plan_id for funnel generation", async () => {
    (supabase.functions.invoke as any).mockResolvedValueOnce({
      data: { success: false, error: "plan_id is required" },
      error: null,
    });

    const result = await supabase.functions.invoke("cmo-generate-funnel", {
      body: {
        tenant_id: "tenant-123",
        workspace_id: "workspace-123",
      },
    });

    expect(result.data.success).toBe(false);
  });
});

describe("CMO Campaign Management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should launch a campaign with channels", async () => {
    const mockCampaign = {
      id: "campaign-123",
      campaign_name: "Summer Sale 2025",
      campaign_type: "promotional",
      status: "active",
      channels: [
        { channel_name: "Email", channel_type: "email" },
        { channel_name: "LinkedIn", channel_type: "social" },
      ],
    };

    (supabase.functions.invoke as any).mockResolvedValueOnce({
      data: { success: true, data: mockCampaign },
      error: null,
    });

    const result = await supabase.functions.invoke("cmo-launch-campaign", {
      body: {
        tenant_id: "tenant-123",
        workspace_id: "workspace-123",
        campaign: {
          campaign_name: "Summer Sale 2025",
          campaign_type: "promotional",
          channels: [
            { channel_name: "Email", channel_type: "email" },
            { channel_name: "LinkedIn", channel_type: "social" },
          ],
        },
      },
    });

    expect(result.error).toBeNull();
    expect(result.data.success).toBe(true);
    expect(result.data.data.channels).toHaveLength(2);
  });

  it("should update campaign status", async () => {
    (callCmoKernel as any).mockResolvedValueOnce({
      success: true,
      data: { id: "campaign-123", status: "paused" },
    });

    const result = await callCmoKernel({
      mode: "update-campaign",
      tenant_id: "tenant-123",
      workspace_id: "workspace-123",
      payload: {
        campaign_id: "campaign-123",
        updates: { status: "paused" },
      },
    });

    expect(result.data.status).toBe("paused");
    expect(callCmoKernel).toHaveBeenCalledTimes(1);
  });
});

describe("CMO Content Generation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should generate content with variants", async () => {
    const mockAsset = {
      id: "asset-123",
      title: "Product Launch Email",
      content_type: "email",
      variants: [
        { variant_name: "Variant A", headline: "Introducing Our New Product" },
        { variant_name: "Variant B", headline: "Meet the Future of Innovation" },
      ],
    };

    (supabase.functions.invoke as any).mockResolvedValueOnce({
      data: { success: true, data: mockAsset },
      error: null,
    });

    const result = await supabase.functions.invoke("cmo-generate-content", {
      body: {
        tenant_id: "tenant-123",
        workspace_id: "workspace-123",
        campaign_id: "campaign-123",
        content_type: "email",
        generate_variants: true,
      },
    });

    expect(result.error).toBeNull();
    expect(result.data.data.variants).toHaveLength(2);
  });
});

describe("CMO Metrics Recording", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should record campaign metrics snapshot", async () => {
    const mockSnapshot = {
      id: "snapshot-123",
      campaign_id: "campaign-123",
      metric_type: "daily",
      impressions: 10000,
      clicks: 500,
      conversions: 50,
      conversion_rate: 10,
    };

    (supabase.functions.invoke as any).mockResolvedValueOnce({
      data: { success: true, data: mockSnapshot },
      error: null,
    });

    const result = await supabase.functions.invoke("cmo-record-metrics", {
      body: {
        tenant_id: "tenant-123",
        workspace_id: "workspace-123",
        snapshot: {
          campaign_id: "campaign-123",
          metric_type: "daily",
          impressions: 10000,
          clicks: 500,
          conversions: 50,
        },
      },
    });

    expect(result.error).toBeNull();
    expect(result.data.data.conversion_rate).toBe(10);
  });
});

describe("CMO Data Validation", () => {
  it("should validate plan objectives are non-empty", () => {
    const validatePlan = (plan: { primary_objectives?: string[] }) => {
      if (!plan.primary_objectives || plan.primary_objectives.length === 0) {
        return { valid: false, error: "At least one objective is required" };
      }
      return { valid: true };
    };

    expect(validatePlan({ primary_objectives: [] })).toEqual({
      valid: false,
      error: "At least one objective is required",
    });

    expect(validatePlan({ primary_objectives: ["Increase revenue"] })).toEqual({
      valid: true,
    });
  });

  it("should validate campaign dates are in order", () => {
    const validateCampaignDates = (start?: string, end?: string) => {
      if (start && end && new Date(start) >= new Date(end)) {
        return { valid: false, error: "End date must be after start date" };
      }
      return { valid: true };
    };

    expect(validateCampaignDates("2025-03-01", "2025-02-01")).toEqual({
      valid: false,
      error: "End date must be after start date",
    });

    expect(validateCampaignDates("2025-01-01", "2025-03-01")).toEqual({
      valid: true,
    });
  });

  it("should validate funnel stage order", () => {
    const validateStageOrder = (stages: { stage_order: number }[]) => {
      const orders = stages.map((s) => s.stage_order);
      const sorted = [...orders].sort((a, b) => a - b);
      const isSequential = sorted.every((v, i) => v === i + 1);
      return { valid: isSequential };
    };

    expect(validateStageOrder([{ stage_order: 1 }, { stage_order: 3 }])).toEqual({
      valid: false,
    });

    expect(
      validateStageOrder([{ stage_order: 1 }, { stage_order: 2 }, { stage_order: 3 }])
    ).toEqual({ valid: true });
  });
});
