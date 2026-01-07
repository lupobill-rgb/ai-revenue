// CMO API Client - Tenant-scoped Supabase operations

import { supabase } from "@/integrations/supabase/client";
import { getTenantContext } from "@/lib/tenant";
import type {
  CMOBrandProfile,
  CMOICPSegment,
  CMOOffer,
  CMOMarketingPlan,
  CMOFunnel,
  CMOFunnelStage,
  CMOCampaign,
  CMOCampaignChannel,
  CMOContentAsset,
  CMOContentVariant,
  CMOMetricsSnapshot,
  CMOWeeklySummary,
  CMORecommendation,
  CMOCalendarEvent,
  CMOKernelRequest,
  CMOKernelResponse,
} from "./types";

// Re-export tenant registry utilities
export * from "./tenant-registry";

// Re-export tenant context for convenience
export { getTenantContext } from "@/lib/tenant";

// CMO Kernel - AI Gateway
export async function invokeCMOKernel(
  mode: string,
  payload: Record<string, unknown>
): Promise<CMOKernelResponse> {
  const { tenantId } = await getTenantContext();
  
  // Get workspace_id from payload or fetch default
  let workspaceId = payload.workspace_id as string;
  if (!workspaceId) {
    const { data: workspace } = await supabase
      .from("workspaces")
      .select("id")
      .eq("owner_id", (await supabase.auth.getUser()).data.user?.id)
      .single();
    workspaceId = workspace?.id || "";
  }

  const { data, error } = await supabase.functions.invoke("cmo-kernel", {
    body: {
      mode,
      tenant_id: tenantId,
      workspace_id: workspaceId,
      payload,
    } as CMOKernelRequest,
  });

  if (error) throw error;
  return data as CMOKernelResponse;
}

// Brand Profiles
export async function getBrandProfiles(workspaceId: string) {
  const { data, error } = await supabase
    .from("cmo_brand_profiles")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data as CMOBrandProfile[];
}

export async function getBrandProfile(id: string) {
  const { data, error } = await supabase
    .from("cmo_brand_profiles")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data as unknown as CMOBrandProfile;
}

export async function createBrandProfile(profile: Partial<CMOBrandProfile>) {
  const { tenantId } = await getTenantContext();
  const insertData = {
    ...profile,
    tenant_id: tenantId,
  };
  const { data, error } = await supabase
    .from("cmo_brand_profiles")
    .insert(insertData as any)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as CMOBrandProfile;
}

export async function updateBrandProfile(id: string, updates: Partial<CMOBrandProfile>) {
  const { data, error } = await supabase
    .from("cmo_brand_profiles")
    .update(updates as any)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as CMOBrandProfile;
}

// ICP Segments
export async function getICPSegments(workspaceId: string): Promise<CMOICPSegment[]> {
  // @ts-ignore - Supabase type instantiation depth issue with chained .eq() calls
  const { data, error } = await supabase
    .from("cmo_icp_segments")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("is_active", true)  // Master Prompt v3: Only return active segments
    .order("priority_score", { ascending: false });

  if (error) throw error;
  return (data ?? []) as CMOICPSegment[];
}

export async function createICPSegment(segment: Partial<CMOICPSegment>) {
  const { tenantId } = await getTenantContext();
  const insertData = {
    ...segment,
    tenant_id: tenantId,
  };
  const { data, error } = await supabase
    .from("cmo_icp_segments")
    .insert(insertData as any)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as CMOICPSegment;
}

export async function updateICPSegment(id: string, updates: Partial<CMOICPSegment>) {
  const { data, error } = await supabase
    .from("cmo_icp_segments")
    .update(updates as any)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as CMOICPSegment;
}

// Offers
export async function getOffers(workspaceId: string) {
  const { data, error } = await supabase
    .from("cmo_offers")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("is_flagship", { ascending: false });

  if (error) throw error;
  return data as unknown as CMOOffer[];
}

export async function createOffer(offer: Partial<CMOOffer>) {
  const { tenantId } = await getTenantContext();
  const insertData = {
    ...offer,
    tenant_id: tenantId,
  };
  const { data, error } = await supabase
    .from("cmo_offers")
    .insert(insertData as any)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as CMOOffer;
}

// Marketing Plans
export async function getMarketingPlans(workspaceId: string) {
  const { data, error } = await supabase
    .from("cmo_marketing_plans")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data as unknown as CMOMarketingPlan[];
}

export async function getMarketingPlan(id: string) {
  const { data, error } = await supabase
    .from("cmo_marketing_plans")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data as unknown as CMOMarketingPlan;
}

export async function createMarketingPlan(plan: Partial<CMOMarketingPlan>) {
  const { tenantId } = await getTenantContext();
  const insertData = {
    ...plan,
    tenant_id: tenantId,
  };
  const { data, error } = await supabase
    .from("cmo_marketing_plans")
    .insert(insertData as any)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as CMOMarketingPlan;
}

// Funnels
export async function getFunnels(workspaceId: string) {
  const { data, error } = await supabase
    .from("cmo_funnels")
    .select(`
      *,
      stages:cmo_funnel_stages(*)
    `)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data as (CMOFunnel & { stages: CMOFunnelStage[] })[];
}

export async function getFunnel(id: string) {
  const { data, error } = await supabase
    .from("cmo_funnels")
    .select(`
      *,
      stages:cmo_funnel_stages(*)
    `)
    .eq("id", id)
    .single();

  if (error) throw error;
  return data as CMOFunnel & { stages: CMOFunnelStage[] };
}

// Campaigns
export async function getCampaigns(workspaceId: string) {
  const { data, error } = await supabase
    .from("cmo_campaigns")
    .select(`
      *,
      channels:cmo_campaign_channels(*)
    `)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data as (CMOCampaign & { channels: CMOCampaignChannel[] })[];
}

export async function getCampaign(id: string) {
  const { data, error } = await supabase
    .from("cmo_campaigns")
    .select(`
      *,
      channels:cmo_campaign_channels(*)
    `)
    .eq("id", id)
    .single();

  if (error) throw error;
  return data as CMOCampaign & { channels: CMOCampaignChannel[] };
}

// Autopilot Controls
export async function toggleAutopilot(campaignId: string, enabled: boolean) {
  const { data, error } = await supabase
    .from("cmo_campaigns")
    .update({ autopilot_enabled: enabled } as any)
    .eq("id", campaignId)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as CMOCampaign;
}

export async function updateCampaignGoal(campaignId: string, goal: string | null) {
  const { data, error } = await supabase
    .from("cmo_campaigns")
    .update({ goal } as any)
    .eq("id", campaignId)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as CMOCampaign;
}

// Autopilot Campaign Builder - Uses kernel campaign-builder mode
export async function buildAutopilotCampaign(payload: {
  icp: string;
  offer: string;
  channels: string[];
  desiredResult: 'leads' | 'meetings' | 'revenue' | 'engagement';
  workspaceId?: string;
  targetTags?: string[];
  targetSegments?: string[];
}): Promise<{
  campaign_id: string;
  campaign_name: string;
  assets: {
    posts: Array<{ channel: string; content: string; hook: string; cta: string }>;
    emails: Array<{ step: number; subject: string; body: string; delay_days: number }>;
    sms: Array<{ step: number; message: string; delay_days: number }>;
    landing_pages: Array<{ title: string; headline: string; subheadline: string; sections: any[] }>;
    voice_scripts: Array<{ scenario: string; opening: string; pitch: string; objection_handling: string; close: string }>;
  };
  automations: {
    steps: Array<{ step: number; type: string; delay_days: number; config: any }>;
  };
  summary: string;
}> {
  const { tenantId } = await getTenantContext();
  
  // Get workspace_id if not provided
  let workspaceId = payload.workspaceId;
  if (!workspaceId) {
    const { data: workspace } = await supabase
      .from("workspaces")
      .select("id")
      .eq("owner_id", (await supabase.auth.getUser()).data.user?.id)
      .single();
    workspaceId = workspace?.id;
  }

  // Call via kernel with campaign-builder mode
  const { data, error } = await supabase.functions.invoke("cmo-kernel", {
    body: {
      mode: 'campaign-builder',
      tenant_id: tenantId,
      workspace_id: workspaceId,
      payload: {
        icp: payload.icp,
        offer: payload.offer,
        channels: payload.channels,
        desired_result: payload.desiredResult,
        target_tags: payload.targetTags,
        target_segments: payload.targetSegments,
      },
    },
  });

  if (error) throw error;
  
  // Return the result from the kernel response
  return data?.result || data;
}

// Content Assets
export async function getContentAssets(workspaceId: string, campaignId?: string) {
  let query = supabase
    .from("cmo_content_assets")
    .select(`
      *,
      variants:cmo_content_variants(*)
    `)
    .eq("workspace_id", workspaceId);

  if (campaignId) {
    query = query.eq("campaign_id", campaignId);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) throw error;
  return data as (CMOContentAsset & { variants: CMOContentVariant[] })[];
}

export async function getContentAsset(id: string) {
  const { data, error } = await supabase
    .from("cmo_content_assets")
    .select(`
      *,
      variants:cmo_content_variants(*)
    `)
    .eq("id", id)
    .single();

  if (error) throw error;
  return data as CMOContentAsset & { variants: CMOContentVariant[] };
}

// Metrics
export async function getMetricsSnapshots(
  workspaceId: string,
  filters?: {
    campaignId?: string;
    startDate?: string;
    endDate?: string;
  }
) {
  // Use gated view that respects workspace mode and Stripe connection
  // Revenue/ROI will be 0 when not in demo_mode and Stripe isn't connected
  let query = supabase
    .from("v_cmo_metrics_by_workspace")
    .select("*")
    .eq("workspace_id", workspaceId);

  if (filters?.campaignId) {
    query = query.eq("campaign_id", filters.campaignId);
  }
  if (filters?.startDate) {
    query = query.gte("snapshot_date", filters.startDate);
  }
  if (filters?.endDate) {
    query = query.lte("snapshot_date", filters.endDate);
  }

  const { data, error } = await query.order("snapshot_date", { ascending: false });

  if (error) throw error;
  // View returns gated data with additional fields (demo_mode, stripe_connected, data_quality_status)
  // Cast to CMOMetricsSnapshot which has the core fields we need
  return (data || []) as unknown as CMOMetricsSnapshot[];
}

// Weekly Summaries
export async function getWeeklySummaries(workspaceId: string, limit = 10) {
  const { data, error } = await supabase
    .from("cmo_weekly_summaries")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("week_start", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data as CMOWeeklySummary[];
}

// Recommendations
export async function getRecommendations(workspaceId: string, status?: string) {
  let query = supabase
    .from("cmo_recommendations")
    .select("*")
    .eq("workspace_id", workspaceId);

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query.order("priority", { ascending: true });

  if (error) throw error;
  return data as CMORecommendation[];
}

export async function updateRecommendationStatus(id: string, status: string) {
  const { data, error } = await supabase
    .from("cmo_recommendations")
    .update({ 
      status, 
      implemented_at: status === "implemented" ? new Date().toISOString() : null 
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as CMORecommendation;
}

// Calendar Events
export async function getCalendarEvents(
  workspaceId: string,
  filters?: {
    startDate?: string;
    endDate?: string;
    channel?: string;
  }
) {
  let query = supabase
    .from("cmo_calendar_events")
    .select("*")
    .eq("workspace_id", workspaceId);

  if (filters?.startDate) {
    query = query.gte("scheduled_at", filters.startDate);
  }
  if (filters?.endDate) {
    query = query.lte("scheduled_at", filters.endDate);
  }
  if (filters?.channel) {
    query = query.eq("channel", filters.channel);
  }

  const { data, error } = await query.order("scheduled_at", { ascending: true });

  if (error) throw error;
  return data as CMOCalendarEvent[];
}

// Storage helpers
export async function uploadCMOAsset(
  tenantId: string,
  path: string,
  file: File
) {
  const fullPath = `${tenantId}/${path}`;
  const { data, error } = await supabase.storage
    .from("cmo-assets")
    .upload(fullPath, file, { upsert: true });

  if (error) throw error;
  
  const { data: urlData } = supabase.storage
    .from("cmo-assets")
    .getPublicUrl(fullPath);

  return urlData.publicUrl;
}

export async function getCMOAssetUrl(tenantId: string, path: string) {
  const fullPath = `${tenantId}/${path}`;
  const { data } = supabase.storage
    .from("cmo-assets")
    .getPublicUrl(fullPath);

  return data.publicUrl;
}

// Campaign Orchestration - Validates integrations & launches campaigns across channels
export interface OrchestrationResult {
  success: boolean;
  campaign_id: string;
  integrations: Array<{
    name: string;
    configured: boolean;
    ready: boolean;
    error?: string;
  }>;
  channels_launched: string[];
  leads_processed: number;
  deals_created: number;
  pipeline_value: number;
  errors: string[];
  recommendations: string[];
}

export async function orchestrateCampaign(
  campaignId: string,
  action: 'validate' | 'launch' | 'optimize' | 'pause' | 'resume',
  options?: {
    channels?: string[];
    autoCreateDeals?: boolean;
    pipelineStage?: string;
  }
): Promise<OrchestrationResult> {
  // Input validation
  if (!campaignId || typeof campaignId !== 'string') {
    throw new Error('campaignId is required and must be a string');
  }
  
  const validActions = ['validate', 'launch', 'optimize', 'pause', 'resume'];
  if (!validActions.includes(action)) {
    throw new Error(`action must be one of: ${validActions.join(', ')}`);
  }

  const { tenantId } = await getTenantContext();
  
  if (!tenantId) {
    throw new Error('No tenant context available. Please ensure you are logged in.');
  }
  
  // Get workspace_id with fallback
  const userResponse = await supabase.auth.getUser();
  const userId = userResponse.data.user?.id;
  
  if (!userId) {
    throw new Error('User not authenticated');
  }
  
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id")
    .eq("owner_id", userId)
    .limit(1)
    .maybeSingle();

  const workspaceId = workspace?.id || tenantId;

  const { data, error } = await supabase.functions.invoke("cmo-campaign-orchestrate", {
    body: {
      tenant_id: tenantId,
      workspace_id: workspaceId,
      campaign_id: campaignId,
      action,
      channels: options?.channels || [],
      auto_create_deals: options?.autoCreateDeals ?? true,
      pipeline_stage: options?.pipelineStage ?? 'qualification',
    },
  });

  if (error) {
    console.error('[orchestrateCampaign] Error:', error);
    throw new Error(error.message || 'Campaign orchestration failed');
  }
  
  return data as OrchestrationResult;
}

// Validate all integrations for a workspace
export async function validateIntegrations(
  workspaceId: string,
  channels: string[] = ['email', 'social', 'voice', 'calendar', 'domain']
): Promise<OrchestrationResult['integrations']> {
  // Input validation
  if (!workspaceId || typeof workspaceId !== 'string') {
    console.warn('[validateIntegrations] Invalid workspaceId, returning empty integrations');
    return [];
  }
  
  const { tenantId } = await getTenantContext();
  
  if (!tenantId) {
    console.warn('[validateIntegrations] No tenant context, returning empty integrations');
    return [];
  }

  try {
    const { data, error } = await supabase.functions.invoke("cmo-campaign-orchestrate", {
      body: {
        tenant_id: tenantId,
        workspace_id: workspaceId,
        campaign_id: 'validation-check',
        action: 'validate',
        channels: channels || [],
      },
    });

    if (error) {
      console.error('[validateIntegrations] Error:', error);
      return [];
    }
    
    return data?.integrations || [];
  } catch (err) {
    console.error('[validateIntegrations] Exception:', err);
    return [];
  }
}

// Launch campaign with full orchestration
export async function launchCampaign(
  campaignId: string,
  channels?: string[]
): Promise<OrchestrationResult> {
  return orchestrateCampaign(campaignId, 'launch', { channels });
}

// Optimize an active campaign
export async function optimizeCampaign(
  campaignId: string
): Promise<OrchestrationResult> {
  return orchestrateCampaign(campaignId, 'optimize');
}

// Pause an active campaign
export async function pauseCampaign(
  campaignId: string
): Promise<OrchestrationResult> {
  return orchestrateCampaign(campaignId, 'pause');
}

// Resume a paused campaign
export async function resumeCampaign(
  campaignId: string
): Promise<OrchestrationResult> {
  return orchestrateCampaign(campaignId, 'resume');
}
