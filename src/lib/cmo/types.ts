// CMO Module Types

export interface CMOBrandProfile {
  id: string;
  tenant_id: string;
  workspace_id: string;
  brand_name: string;
  tagline?: string;
  mission_statement?: string;
  unique_value_proposition?: string;
  brand_voice?: string;
  brand_tone?: string;
  brand_personality?: Record<string, unknown>;
  core_values?: string[];
  key_differentiators?: string[];
  messaging_pillars?: Record<string, unknown>;
  brand_colors?: Record<string, unknown>;
  brand_fonts?: Record<string, unknown>;
  logo_url?: string;
  website_url?: string;
  industry?: string;
  competitors?: Record<string, unknown>;
  content_themes?: string[];
  created_at: string;
  updated_at: string;
}

export interface CMOICPSegment {
  id: string;
  tenant_id: string;
  workspace_id: string;
  segment_name: string;
  segment_description?: string;
  is_primary?: boolean;
  priority_score?: number;
  demographics?: Record<string, unknown>;
  psychographics?: Record<string, unknown>;
  pain_points?: string[];
  goals?: string[];
  objections?: string[];
  buying_triggers?: string[];
  decision_criteria?: string[];
  preferred_channels?: string[];
  content_preferences?: Record<string, unknown>;
  job_titles?: string[];
  company_size?: string;
  industry_verticals?: string[];
  budget_range?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CMOOffer {
  id: string;
  tenant_id: string;
  workspace_id: string;
  offer_name: string;
  offer_type: string;
  description?: string;
  features?: string[];
  key_benefits?: string[];
  pricing_model?: string;
  price_range?: Record<string, unknown>;
  target_segment_codes?: string[];
  competitive_positioning?: string;
  use_cases?: string[];
  testimonials?: Record<string, unknown>[];
  case_studies?: Record<string, unknown>[];
  success_metrics?: Record<string, unknown>;
  landing_page_url?: string;
  demo_url?: string;
  is_flagship?: boolean;
  status?: string;
  launch_date?: string;
  created_at: string;
  updated_at: string;
}

export interface CMOMarketingPlan {
  id: string;
  tenant_id: string;
  workspace_id: string;
  plan_name: string;
  plan_type: string;
  status: string;
  start_date?: string;
  end_date?: string;
  executive_summary?: string;
  primary_objectives?: string[];
  target_icp_segments?: string[];
  target_offers?: string[];
  budget_allocation?: Record<string, unknown>;
  channel_mix?: Record<string, unknown>;
  campaign_themes?: string[];
  key_metrics?: Record<string, unknown>;
  month_1_plan?: Record<string, unknown>;
  month_2_plan?: Record<string, unknown>;
  month_3_plan?: Record<string, unknown>;
  content_calendar_outline?: Record<string, unknown>;
  dependencies?: string[];
  risks_mitigations?: Record<string, unknown>;
  resource_requirements?: Record<string, unknown>;
  generation_context?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CMOFunnel {
  id: string;
  tenant_id: string;
  workspace_id: string;
  plan_id?: string;
  funnel_name: string;
  funnel_type: string;
  description?: string;
  status: string;
  target_icp_segments?: string[];
  target_offers?: string[];
  total_budget?: number;
  expected_conversion_rate?: number;
  expected_revenue?: number;
  created_at: string;
  updated_at: string;
  stages?: CMOFunnelStage[];
}

export interface CMOFunnelStage {
  id: string;
  funnel_id: string;
  stage_name: string;
  stage_type: string;
  stage_order: number;
  objective?: string;
  description?: string;
  entry_criteria?: string;
  exit_criteria?: string;
  channels?: string[];
  campaign_types?: string[];
  content_assets?: string[];
  kpis?: Record<string, unknown>;
  conversion_rate_target?: number;
  expected_volume?: number;
  budget_allocation?: number;
  target_icps?: string[];
  linked_offers?: string[];
  created_at: string;
  updated_at: string;
}

// Autopilot & Optimization Types
export type CampaignGoal = "leads" | "meetings" | "revenue" | "engagement";

export interface CMOCampaign {
  id: string;
  tenant_id: string;
  workspace_id: string;
  plan_id?: string;
  funnel_id?: string;
  campaign_name: string;
  campaign_type: string;
  funnel_stage?: string;
  status?: string;
  objective?: string;
  description?: string;
  target_icp?: string;
  target_offer?: string;
  start_date?: string;
  end_date?: string;
  budget_allocation?: number;
  primary_kpi?: Record<string, unknown>;
  secondary_kpis?: Record<string, unknown>;
  success_criteria?: string;
  // Autopilot fields
  autopilot_enabled?: boolean;
  goal?: CampaignGoal | null;
  last_optimization_at?: string | null;
  last_optimization_note?: string | null;
  created_at: string;
  updated_at: string;
  channels?: CMOCampaignChannel[];
}

export interface CMOCampaignChannel {
  id: string;
  campaign_id: string;
  channel_name: string;
  channel_type?: string;
  priority?: string;
  budget_percentage?: number;
  content_types?: string[];
  posting_frequency?: string;
  targeting_notes?: string;
  expected_metrics?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CMOContentAsset {
  id: string;
  tenant_id: string;
  workspace_id: string;
  campaign_id?: string;
  content_id?: string;
  title: string;
  content_type: string;
  channel?: string;
  funnel_stage?: string;
  target_icp?: string;
  key_message?: string;
  supporting_points?: string[];
  cta?: string;
  tone?: string;
  status?: string;
  publish_date?: string;
  dependencies?: string[];
  estimated_production_time?: string;
  created_at: string;
  updated_at: string;
  variants?: CMOContentVariant[];
}

export interface CMOContentVariant {
  id: string;
  asset_id: string;
  variant_name: string;
  variant_type?: string;
  headline?: string;
  subject_line?: string;
  body_content?: string;
  cta_text?: string;
  visual_description?: string;
  metadata?: Record<string, unknown>;
  performance_metrics?: Record<string, unknown>;
  is_winner?: boolean;
  created_at: string;
  updated_at: string;
}

export interface CMOMetricsSnapshot {
  id: string;
  tenant_id: string;
  workspace_id: string;
  campaign_id?: string;
  channel_id?: string;
  metric_type: string;
  snapshot_date: string;
  impressions?: number;
  clicks?: number;
  conversions?: number;
  conversion_rate?: number;
  engagement_rate?: number;
  cost?: number;
  revenue?: number;
  roi?: number;
  custom_metrics?: Record<string, unknown>;
  created_at: string;
}

export interface CMOWeeklySummary {
  id: string;
  tenant_id: string;
  workspace_id: string;
  week_start: string;
  week_end: string;
  executive_summary?: string;
  key_wins?: string[];
  challenges?: string[];
  metrics_summary?: Record<string, unknown>;
  top_performing_content?: Record<string, unknown>[];
  recommendations?: string[];
  next_week_priorities?: string[];
  created_at: string;
  updated_at: string;
}

export interface CMORecommendation {
  id: string;
  tenant_id: string;
  workspace_id: string;
  campaign_id?: string;
  title: string;
  recommendation_type: string;
  description?: string;
  rationale?: string;
  expected_impact?: string;
  effort_level?: string;
  priority?: string;
  status?: string;
  action_items?: string[];
  implemented_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CMOCalendarEvent {
  id: string;
  tenant_id: string;
  workspace_id: string;
  campaign_id?: string;
  asset_id?: string;
  title: string;
  event_type: string;
  description?: string;
  channel?: string;
  scheduled_at: string;
  status?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// API Request/Response Types
export interface CMOKernelRequest {
  mode: string;
  tenant_id: string;
  workspace_id: string;
  payload: Record<string, unknown>;
}

export interface CMOKernelResponse {
  success: boolean;
  data?: unknown;
  error?: string;
  run_id?: string;
}

export type CMOWorkflowStep = 
  | 'brand-intake'
  | 'plan-90day'
  | 'funnel-architect'
  | 'campaign-designer'
  | 'content-engine'
  | 'optimization-analyst';

export interface CMOWorkflowState {
  currentStep: CMOWorkflowStep;
  completedSteps: CMOWorkflowStep[];
  brandProfile?: CMOBrandProfile;
  icpSegments?: CMOICPSegment[];
  offers?: CMOOffer[];
  marketingPlan?: CMOMarketingPlan;
  funnels?: CMOFunnel[];
  campaigns?: CMOCampaign[];
}

// Landing Page Types
export type LandingTemplateType =
  | "saas"
  | "lead_magnet"
  | "webinar"
  | "services"
  | "booking"
  | "long_form";

export interface LandingSection {
  type:
    | "problem_solution"
    | "features"
    | "social_proof"
    | "process"
    | "faq"
    | "pricing"
    | "booking"
    | "story";
  heading: string;
  body: string;
  bullets: string[];
  enabled?: boolean;
}

export interface LandingFormField {
  name: string;
  label: string;
  required: boolean;
  type?: "text" | "email" | "tel" | "select" | "textarea";
  options?: string[]; // For select fields
}

export interface LandingPageDraft {
  id?: string;
  tenant_id?: string;
  workspace_id?: string;
  campaign_id?: string;
  campaignName?: string;
  templateType: LandingTemplateType;
  internalName: string;
  urlSlug: string;
  heroHeadline: string;
  heroSubheadline: string;
  heroSupportingPoints: string[];
  sections: LandingSection[];
  primaryCtaLabel: string;
  primaryCtaType: "form" | "calendar";
  formFields: LandingFormField[];
  calendarUrl?: string;
  status?: "draft" | "published" | "archived";
  published_url?: string;
  url?: string;
  published?: boolean;
  autoWired?: boolean;
  // Auto-wired form submission config for lead capture
  formSubmissionConfig?: {
    workspaceId: string;
    campaignId: string | null;
    landingPageSlug: string;
    landingPageUrl: string | null;
  } | null;
  variantId?: string;
  created_at?: string;
  updated_at?: string;
}

export interface LandingPageTemplate {
  id: LandingTemplateType;
  name: string;
  description: string;
  defaultSections: LandingSection["type"][];
  suggestedFormFields: LandingFormField[];
}

// Lead Types
export type LeadStatus = "new" | "working" | "qualified" | "unqualified" | "converted";

export interface LeadRow {
  id: string;
  contactId: string;
  campaignId: string | null;
  status: LeadStatus;
  score: number;
  source: string;
  createdAt: string;
  contact: {
    id?: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
    companyName: string | null;
    roleTitle: string | null;
    status: "prospect" | "customer" | "inactive" | null;
    lifecycleStage: string | null;
    segmentCode: string | null;
  };
  campaign?: {
    name: string | null;
  };
  lastActivity?: {
    type: string;
    createdAt: string;
  } | null;
}

export interface LeadDetailsResponse {
  lead: {
    id: string;
    status: LeadStatus;
    score: number;
    source: string;
    createdAt: string;
  };
  contact: LeadRow["contact"] & { id: string };
  campaign?: { id: string; name: string | null };
  activities: {
    id: string;
    type: string;
    createdAt: string;
    meta: Record<string, any>;
  }[];
}
