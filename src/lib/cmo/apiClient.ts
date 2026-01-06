/**
 * AI CMO API Client
 * Adapted for Supabase Edge Functions
 */

import { supabase } from "@/integrations/supabase/client";

// Types
export type CampaignGoal = "leads" | "meetings" | "revenue" | "engagement";

export type Campaign = {
  id: string;
  campaign_name: string;
  campaign_type: string;
  status: string | null;
  goal: string | null;
  autopilot_enabled: boolean;
  last_optimization_at: string | null;
  last_optimization_note: string | null;
  created_at: string;
  updated_at: string;
};

export type VoiceAgent = {
  id: string;
  name: string;
  provider: "vapi" | "elevenlabs";
  config?: Record<string, unknown>;
};

export type CampaignOptimization = {
  id: string;
  created_at: string;
  summary: string | null;
  changes: unknown;
  optimization_type: string;
};

export type BuildAutopilotCampaignInput = {
  tenantId: string;
  icp: string;
  offer: string;
  channels: ("email" | "sms" | "linkedin" | "voice" | "landing_page")[];
  desiredResult: CampaignGoal;
};

// ============ CAMPAIGNS ============

export async function fetchCampaigns(tenantId: string): Promise<Campaign[]> {
  const { data, error } = await supabase
    .from("cmo_campaigns")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function toggleAutopilot(
  campaignId: string,
  enabled: boolean
): Promise<void> {
  const { data, error } = await supabase.functions.invoke(
    "ai-cmo-toggle-autopilot",
    {
      body: { campaign_id: campaignId, enabled },
    }
  );

  if (error) throw new Error(error.message);
  return data;
}

export async function updateCampaignGoal(
  campaignId: string,
  goal: CampaignGoal | null
): Promise<void> {
  const { data, error } = await supabase.functions.invoke(
    "ai-cmo-update-goal",
    {
      body: { campaign_id: campaignId, goal },
    }
  );

  if (error) throw new Error(error.message);
  return data;
}

// ============ AUTOPILOT CAMPAIGN BUILDER ============

export async function buildAutopilotCampaign(
  payload: BuildAutopilotCampaignInput
): Promise<{ campaignId: string; status: string }> {
  const { data, error } = await supabase.functions.invoke(
    "ai-cmo-autopilot-build",
    {
      body: {
        tenant_id: payload.tenantId,
        icp: payload.icp,
        offer: payload.offer,
        channels: payload.channels,
        desired_result: payload.desiredResult,
      },
    }
  );

  if (error) throw new Error(error.message);
  return data as { campaignId: string; status: string };
}

// ============ VOICE AGENTS ============

export async function fetchVoiceAgents(
  tenantId: string,
  campaignId?: string
): Promise<VoiceAgent[]> {
  const { data, error } = await supabase.functions.invoke(
    "ai-cmo-voice-agents",
    {
      body: { tenant_id: tenantId, campaign_id: campaignId },
    }
  );

  if (error) throw new Error(error.message);
  return data || [];
}

export async function buildVoiceAgent(payload: {
  tenantId: string;
  campaignId?: string;
  brandVoice: string;
  icp: string;
  offer: string;
  constraints?: string[];
  preferredProvider?: "vapi" | "elevenlabs";
}): Promise<VoiceAgent> {
  const { data, error } = await supabase.functions.invoke(
    "cmo-voice-agent-builder",
    {
      body: {
        tenant_id: payload.tenantId,
        campaign_id: payload.campaignId,
        payload: {
          brand_voice: payload.brandVoice,
          icp: payload.icp,
          offer: payload.offer,
          constraints: payload.constraints,
          preferred_provider: payload.preferredProvider,
        },
      },
    }
  );

  if (error) throw new Error(error.message);
  return data;
}

// ============ OPTIMIZATIONS ============

export async function fetchCampaignOptimizations(
  campaignId: string
): Promise<CampaignOptimization[]> {
  const { data, error } = await supabase
    .from("campaign_optimizations")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function runCampaignOptimization(payload: {
  tenantId: string;
  campaignId: string;
  goal: CampaignGoal;
  metrics: {
    opens?: number;
    clicks?: number;
    replies?: number;
    booked_meetings?: number;
    no_shows?: number;
    conversions?: number;
    voice_calls?: {
      total: number;
      reached: number;
      booked: number;
      no_answer: number;
    };
  };
  constraints?: string[];
}): Promise<{
  changes: any[];
  summary: string;
  applied_changes: string[];
}> {
  const { data, error } = await supabase.functions.invoke("cmo-optimizer", {
    body: {
      tenant_id: payload.tenantId,
      campaign_id: payload.campaignId,
      goal: payload.goal,
      metrics: payload.metrics,
      constraints: payload.constraints,
    },
  });

  if (error) throw new Error(error.message);
  return data;
}

// ============ LEADS ============

import type { LeadRow, LeadDetailsResponse, LeadStatus } from "./types";

export async function fetchLeads(tenantId: string): Promise<{ leads: LeadRow[]; total: number }> {
  const { data, error } = await supabase.functions.invoke("ai-cmo-leads", {
    body: { tenantId },
  });

  if (error) throw new Error(error.message);
  // Handle both old array format and new { leads, total } format
  if (Array.isArray(data)) {
    return { leads: data, total: data.length };
  }
  return { leads: data?.leads || [], total: data?.total ?? (data?.leads?.length || 0) };
}

export async function fetchLeadDetails(
  tenantId: string,
  leadId: string
): Promise<LeadDetailsResponse> {
  const { data, error } = await supabase.functions.invoke(
    "ai-cmo-lead-activities",
    {
      body: { tenantId, leadId },
    }
  );

  if (error) throw new Error(error.message);
  return data;
}

export async function updateLeadStatus(
  tenantId: string,
  leadId: string,
  status: LeadStatus
): Promise<void> {
  const { data, error } = await supabase.functions.invoke(
    "ai-cmo-lead-status",
    {
      body: { tenantId, leadId, status },
    }
  );

  if (error) throw new Error(error.message);
  return data;
}

export async function updateContactSegment(
  contactId: string,
  segmentCode: string | null
): Promise<void> {
  const { error } = await supabase
    .from("crm_contacts")
    .update({ segment_code: segmentCode })
    .eq("id", contactId);

  if (error) throw new Error(error.message);
}

// ============ CONTENT ASSETS ============

export async function fetchCampaignAssets(campaignId: string) {
  const { data, error } = await supabase
    .from("cmo_content_assets")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

// ============ RECOMMENDATIONS ============

export async function fetchRecommendations(
  tenantId: string,
  campaignId?: string
) {
  let query = supabase
    .from("cmo_recommendations")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (campaignId) {
    query = query.eq("campaign_id", campaignId);
  }

  const { data, error } = await query;

  if (error) throw new Error(error.message);
  return data || [];
}

// ============ LANDING PAGES ============

import type { LandingPageDraft } from "./types";

export async function fetchCampaignLandingPages(
  tenantId: string,
  campaignId?: string | null
): Promise<LandingPageDraft[]> {
  const { data, error } = await supabase.functions.invoke(
    "ai-cmo-landing-pages-list",
    {
      body: { tenantId, campaignId: campaignId || null },
    }
  );

  if (error) throw new Error(error.message);
  
  // Map API response to LandingPageDraft format
  return (data || []).map((page: any) => ({
    id: page.id,
    tenant_id: tenantId,
    workspace_id: page.workspaceId,
    campaign_id: page.campaignId,
    campaignName: page.campaignName,
    templateType: page.templateType || "saas",
    internalName: page.internalName,
    urlSlug: page.urlSlug || "",
    heroHeadline: page.heroHeadline || "",
    heroSubheadline: page.heroSubheadline || "",
    heroSupportingPoints: page.heroSupportingPoints || [],
    sections: page.sections || [],
    primaryCtaLabel: page.primaryCtaLabel || "Get Started",
    primaryCtaType: page.primaryCtaType || "form",
    formFields: page.formFields || [],
    status: page.status || "draft",
    published: page.published,
    url: page.url,
    autoWired: page.autoWired,
    variantId: page.variantId,
    created_at: page.createdAt,
    updated_at: page.updatedAt,
  }));
}

export async function regenerateLandingPage(
  tenantId: string,
  landingPageId: string,
  overrides: {
    heroHeadline?: string;
    heroSubheadline?: string;
    primaryCtaLabel?: string;
  }
): Promise<LandingPageDraft> {
  const { data, error } = await supabase.functions.invoke(
    "ai-cmo-landing-pages-regenerate",
    {
      body: {
        tenant_id: tenantId,
        landing_page_id: landingPageId,
        overrides,
      },
    }
  );

  if (error) throw new Error(error.message);
  return data as LandingPageDraft;
}

export async function saveLandingPage(
  tenantId: string,
  campaignId: string | null,
  draft: LandingPageDraft,
  publish: boolean
): Promise<{ id: string; url: string; published: boolean }> {
  const { data, error } = await supabase.functions.invoke(
    "ai-cmo-landing-pages-save",
    {
      body: { tenant_id: tenantId, campaign_id: campaignId, draft, publish },
    }
  );

  if (error) throw new Error(error.message);
  return data as { id: string; url: string; published: boolean };
}

export async function generateLandingPageWithAI(
  tenantId: string,
  draft: LandingPageDraft
): Promise<LandingPageDraft> {
  const { data, error } = await supabase.functions.invoke(
    "ai-cmo-landing-pages-generate",
    {
      body: { tenant_id: tenantId, draft },
    }
  );

  if (error) throw new Error(error.message);
  return data as LandingPageDraft;
}

// Legacy function for backwards compatibility
export async function fetchLandingPages(
  tenantId: string,
  campaignId?: string
): Promise<LandingPageDraft[]> {
  return fetchCampaignLandingPages(tenantId, campaignId);
}
