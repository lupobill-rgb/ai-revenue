import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface IntegrationStatus {
  name: string;
  configured: boolean;
  ready: boolean;
  error?: string;
}

interface OrchestrationInput {
  tenant_id: string;
  workspace_id?: string;
  campaign_id: string;
  action: 'validate' | 'launch' | 'optimize' | 'pause' | 'resume';
  channels?: string[];
  auto_create_deals?: boolean;
  pipeline_stage?: string;
}

interface OrchestrationResult {
  success: boolean;
  campaign_id: string;
  integrations: IntegrationStatus[];
  channels_launched: string[];
  leads_processed: number;
  deals_created: number;
  pipeline_value: number;
  errors: string[];
  recommendations: string[];
}

// Validate all required integrations for campaign channels
async function validateIntegrations(
  supabase: any,
  workspaceId: string,
  channels: string[]
): Promise<IntegrationStatus[]> {
  const statuses: IntegrationStatus[] = [];

  // Always check email settings
  if (channels.includes('email')) {
    const { data: emailSettings } = await supabase
      .from('ai_settings_email')
      .select('*')
      .eq('tenant_id', workspaceId)
      .maybeSingle();

    statuses.push({
      name: 'email',
      configured: !!emailSettings?.from_address,
      ready: !!emailSettings?.from_address && emailSettings.from_address !== 'onboarding@resend.dev',
      error: !emailSettings?.from_address ? 'Email settings not configured' : undefined,
    });
  }

  // Check social integrations
  if (channels.includes('social') || channels.includes('linkedin') || channels.includes('instagram') || channels.includes('facebook') || channels.includes('tiktok')) {
    const { data: socialSettings } = await supabase
      .from('ai_settings_social')
      .select('*')
      .eq('tenant_id', workspaceId)
      .maybeSingle();

    // Also check social_integrations table
    const { data: socialIntegrations } = await supabase
      .from('social_integrations')
      .select('platform, is_active')
      .eq('workspace_id', workspaceId)
      .eq('is_active', true);

    const activePlatforms = socialIntegrations?.map((i: any) => i.platform) || [];

    statuses.push({
      name: 'social',
      configured: !!socialSettings?.is_connected || activePlatforms.length > 0,
      ready: activePlatforms.length > 0,
      error: activePlatforms.length === 0 ? 'No active social platforms connected' : undefined,
    });
  }

  // Check voice/Eleven Labs settings
  if (channels.includes('voice')) {
    const { data: voiceSettings } = await supabase
      .from('ai_settings_voice')
      .select('*')
      .eq('tenant_id', workspaceId)
      .maybeSingle();

    const elevenLabsApiKey = voiceSettings?.elevenlabs_api_key;
    const elevenLabsVoiceId = voiceSettings?.default_elevenlabs_voice_id;

    statuses.push({
      name: 'voice',
      configured: !!elevenLabsApiKey,
      ready: !!elevenLabsApiKey && !!elevenLabsVoiceId,
      error: !elevenLabsApiKey ? 'Eleven Labs API key not configured' : 
             !elevenLabsVoiceId ? 'No Eleven Labs voice ID configured' : undefined,
    });
  }

  // Master Prompt v3: Check voice_vm (voicemail) settings
  if (channels.includes('voice_vm') || channels.includes('voicemail')) {
    const { data: voiceSettings } = await supabase
      .from('ai_settings_voice')
      .select('*')
      .eq('tenant_id', workspaceId)
      .maybeSingle();

    const elevenLabsApiKey = voiceSettings?.elevenlabs_api_key;
    const elevenLabsVoiceId = voiceSettings?.default_elevenlabs_voice_id;

    statuses.push({
      name: 'voice_vm',
      configured: !!elevenLabsApiKey,
      ready: !!elevenLabsApiKey && !!elevenLabsVoiceId,
      error: !elevenLabsApiKey ? 'Eleven Labs API key not configured for voicemail' : 
             !elevenLabsVoiceId ? 'No Eleven Labs voice ID configured for voicemail' : undefined,
    });
  }

  // Master Prompt v3: Check SMS/Twilio settings
  if (channels.includes('sms')) {
    const { data: smsSettings } = await supabase
      .from('ai_settings_sms')
      .select('*')
      .eq('tenant_id', workspaceId)
      .maybeSingle();

    statuses.push({
      name: 'sms',
      configured: true, // SMS can work with default Twilio config
      ready: true,
      error: undefined,
    });
  }

  // Check calendar integration for booking campaigns
  if (channels.includes('calendar') || channels.includes('booking')) {
    const { data: calendarSettings } = await supabase
      .from('ai_settings_calendar')
      .select('*')
      .eq('tenant_id', workspaceId)
      .maybeSingle();

    statuses.push({
      name: 'calendar',
      configured: !!calendarSettings?.booking_url,
      ready: !!calendarSettings?.booking_url && calendarSettings.booking_url.length > 5,
      error: !calendarSettings?.booking_url ? 'Calendar booking URL not configured' : undefined,
    });
  }

  // Check domain settings
  if (channels.includes('landing_page') || channels.includes('web')) {
    const { data: domainSettings } = await supabase
      .from('ai_settings_domain')
      .select('*')
      .eq('tenant_id', workspaceId)
      .maybeSingle();

    statuses.push({
      name: 'domain',
      configured: !!domainSettings?.domain,
      ready: !!domainSettings?.cname_verified,
      error: !domainSettings?.domain ? 'Custom domain not configured' : 
             !domainSettings?.cname_verified ? 'Domain DNS not verified' : undefined,
    });
  }

  // Check Stripe for revenue/payment campaigns
  if (channels.includes('payment') || channels.includes('stripe')) {
    const { data: stripeSettings } = await supabase
      .from('ai_settings_stripe')
      .select('*')
      .eq('tenant_id', workspaceId)
      .maybeSingle();

    statuses.push({
      name: 'stripe',
      configured: !!stripeSettings?.stripe_publishable_key,
      ready: !!stripeSettings?.is_connected,
      error: !stripeSettings?.stripe_publishable_key ? 'Stripe not configured' : undefined,
    });
  }

  // Check LinkedIn for outbound
  if (channels.includes('linkedin_outbound')) {
    const { data: linkedinSettings } = await supabase
      .from('ai_settings_linkedin')
      .select('*')
      .eq('tenant_id', workspaceId)
      .maybeSingle();

    statuses.push({
      name: 'linkedin',
      configured: !!linkedinSettings?.linkedin_profile_url,
      ready: !!linkedinSettings?.linkedin_profile_url,
      error: !linkedinSettings?.linkedin_profile_url ? 'LinkedIn profile not configured' : undefined,
    });
  }

  // Check CRM webhooks
  const { data: crmSettings } = await supabase
    .from('ai_settings_crm_webhooks')
    .select('*')
    .eq('tenant_id', workspaceId)
    .maybeSingle();

  statuses.push({
    name: 'crm',
    configured: true, // Internal CRM always available
    ready: true,
    error: undefined,
  });

  return statuses;
}

// Process campaign leads and create/update CRM deals
async function processLeadsForPipeline(
  supabase: any,
  workspaceId: string,
  campaignId: string,
  autoCreateDeals: boolean,
  pipelineStage: string
): Promise<{ leadsProcessed: number; dealsCreated: number; pipelineValue: number }> {
  let leadsProcessed = 0;
  let dealsCreated = 0;
  let pipelineValue = 0;

  // Get campaign details
  const { data: campaign } = await supabase
    .from('cmo_campaigns')
    .select('*')
    .eq('id', campaignId)
    .single();

  if (!campaign) {
    return { leadsProcessed: 0, dealsCreated: 0, pipelineValue: 0 };
  }

  // Get leads associated with this campaign via content assets
  const { data: assets } = await supabase
    .from('cmo_content_assets')
    .select('id, content_type')
    .eq('campaign_id', campaignId);

  // Also get leads from automation steps
  const { data: automationSteps } = await supabase
    .from('automation_steps')
    .select('config')
    .eq('automation_id', campaignId);

  // Collect lead IDs from various sources
  const leadIds = new Set<string>();

  // Get leads from workspace that were contacted/engaged
  const { data: leads } = await supabase
    .from('leads')
    .select('id, first_name, last_name, email, company, status, lead_score')
    .eq('workspace_id', workspaceId)
    .in('status', ['qualified', 'engaged', 'contacted'])
    .order('lead_score', { ascending: false })
    .limit(100);

  if (leads) {
    leads.forEach((lead: any) => leadIds.add(lead.id));
    leadsProcessed = leads.length;
  }

  // Create deals for qualified leads if auto_create_deals is true
  if (autoCreateDeals && leads && leads.length > 0) {
    const qualifiedLeads = leads.filter((l: any) => l.status === 'qualified' || (l.lead_score && l.lead_score >= 50));

    for (const lead of qualifiedLeads) {
      // Check if deal already exists for this lead
      const { data: existingDeal } = await supabase
        .from('deals')
        .select('id, value')
        .eq('lead_id', lead.id)
        .maybeSingle();

      if (existingDeal) {
        pipelineValue += existingDeal.value || 0;
        continue;
      }

      // Create new deal
      const estimatedValue = lead.lead_score ? lead.lead_score * 100 : 5000; // Estimate based on score
      const { data: newDeal, error: dealError } = await supabase
        .from('deals')
        .insert({
          workspace_id: workspaceId,
          tenant_id: workspaceId,
          lead_id: lead.id,
          name: `${lead.company || lead.first_name || 'New'} - ${campaign.campaign_name}`,
          value: estimatedValue,
          stage: pipelineStage || 'qualification',
          source: `Campaign: ${campaign.campaign_name}`,
          probability: 20,
          expected_close_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
        })
        .select()
        .single();

      if (!dealError && newDeal) {
        dealsCreated++;
        pipelineValue += estimatedValue;

        // Log deal creation activity
        await supabase.from('lead_activities').insert({
          lead_id: lead.id,
          activity_type: 'deal_created',
          description: `Deal created from campaign: ${campaign.campaign_name}`,
          metadata: {
            campaign_id: campaignId,
            deal_id: newDeal.id,
            deal_value: estimatedValue,
          },
        });
      }
    }
  }

  return { leadsProcessed, dealsCreated, pipelineValue };
}

// Launch campaign across all configured channels
async function launchCampaign(
  supabase: any,
  supabaseAdmin: any,
  workspaceId: string,
  campaignId: string,
  channels: string[],
  authHeader: string
): Promise<{ channelsLaunched: string[]; errors: string[] }> {
  const channelsLaunched: string[] = [];
  const errors: string[] = [];

  // Get campaign with target_tags and target_segment_codes
  const { data: campaign } = await supabase
    .from('cmo_campaigns')
    .select('target_tags, target_segment_codes')
    .eq('id', campaignId)
    .single();

  const targetTags: string[] = campaign?.target_tags || [];
  const targetSegments: string[] = campaign?.target_segment_codes || [];

  // Update campaign status to active
  await supabase
    .from('cmo_campaigns')
    .update({ status: 'active', start_date: new Date().toISOString() })
    .eq('id', campaignId);

  // Get campaign assets
  const { data: assets } = await supabase
    .from('cmo_content_assets')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('status', 'draft');

  if (!assets || assets.length === 0) {
    errors.push('No campaign assets found to launch');
    return { channelsLaunched, errors };
  }

  // Helper function to get leads filtered by target_tags and/or target_segments
  async function getFilteredLeads(requiredFields: string[], limit: number = 100) {
    let query = supabase
      .from('leads')
      .select(`id, ${requiredFields.join(', ')}`)
      .eq('workspace_id', workspaceId);

    // Filter by target_tags if campaign has them configured
    if (targetTags.length > 0) {
      query = query.overlaps('tags', targetTags);
      console.log(`[launchCampaign] Filtering leads by tags: ${targetTags.join(', ')}`);
    }

    // Filter by target_segment_codes if campaign has them configured
    if (targetSegments.length > 0) {
      query = query.in('segment_code', targetSegments);
      console.log(`[launchCampaign] Filtering leads by segments: ${targetSegments.join(', ')}`);
    }

    return await query.limit(limit);
  }

  // Launch email campaigns
  const emailAssets = assets.filter((a: any) => a.content_type === 'email');
  if (emailAssets.length > 0 && (channels.includes('email') || channels.length === 0)) {
    try {
      // Get leads with emails, filtered by target_tags
      const { data: leads } = await getFilteredLeads(['email', 'first_name', 'last_name', 'company']);
      const emailLeads = (leads || []).filter((l: any) => l.email);

      console.log(`[launchCampaign] Found ${emailLeads.length} leads for email campaign${targetTags.length > 0 ? ` (filtered by tags: ${targetTags.join(', ')})` : ''}`);

      if (emailLeads.length > 0) {
        // Queue emails via channel_outbox
        for (const asset of emailAssets) {
          for (const lead of emailLeads) {
            await supabaseAdmin
              .from('channel_outbox')
              .insert({
                tenant_id: workspaceId,
                workspace_id: workspaceId,
                channel: 'email',
                provider: 'resend',
                recipient_id: lead.id,
                recipient_email: lead.email,
                payload: {
                  campaign_id: campaignId,
                  asset_id: asset.id,
                  subject: asset.title,
                  html_body: asset.key_message,
                },
                status: 'scheduled',
                scheduled_at: new Date().toISOString(),
                idempotency_key: `${campaignId}_${asset.id}_${lead.id}_${new Date().toISOString().slice(0, 10)}`,
              });
          }
          
          // Update asset status
          await supabase
            .from('cmo_content_assets')
            .update({ status: 'scheduled' })
            .eq('id', asset.id);
        }
        channelsLaunched.push('email');
      }
    } catch (e) {
      errors.push(`Email launch failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  }

  // Launch social campaigns
  const socialAssets = assets.filter((a: any) => a.content_type === 'social_post');
  if (socialAssets.length > 0 && (channels.includes('social') || channels.length === 0)) {
    try {
      // Check for active social integrations
      const { data: socialIntegrations } = await supabase
        .from('social_integrations')
        .select('platform, access_token')
        .eq('workspace_id', workspaceId)
        .eq('is_active', true);

      if (socialIntegrations && socialIntegrations.length > 0) {
        for (const asset of socialAssets) {
          for (const integration of socialIntegrations) {
            await supabaseAdmin
              .from('channel_outbox')
              .insert({
                tenant_id: workspaceId,
                workspace_id: workspaceId,
                channel: 'social',
                provider: integration.platform,
                payload: {
                  campaign_id: campaignId,
                  asset_id: asset.id,
                  content: asset.key_message,
                  platform: integration.platform,
                },
                status: 'scheduled',
                scheduled_at: new Date().toISOString(),
                idempotency_key: `${campaignId}_${asset.id}_${integration.platform}_${new Date().toISOString().slice(0, 10)}`,
              });
          }
          
          await supabase
            .from('cmo_content_assets')
            .update({ status: 'scheduled' })
            .eq('id', asset.id);
        }
        channelsLaunched.push('social');
      }
    } catch (e) {
      errors.push(`Social launch failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  }

  // Launch voice campaigns
  const voiceAssets = assets.filter((a: any) => a.content_type === 'voice_script');
  if (voiceAssets.length > 0 && (channels.includes('voice') || channels.length === 0)) {
    try {
      // Get voice settings
      const { data: voiceSettings } = await supabase
        .from('ai_settings_voice')
        .select('*')
        .eq('tenant_id', workspaceId)
        .maybeSingle();

      if (voiceSettings?.default_vapi_assistant_id) {
        // Get leads with phone numbers, filtered by target_tags
        const { data: leads } = await getFilteredLeads(['phone', 'first_name', 'last_name', 'company'], 50);
        const phoneLeads = (leads || []).filter((l: any) => l.phone);

        console.log(`[launchCampaign] Found ${phoneLeads.length} leads for voice campaign${targetTags.length > 0 ? ` (filtered by tags: ${targetTags.join(', ')})` : ''}`);

        if (phoneLeads.length > 0) {
          for (const asset of voiceAssets) {
            for (const lead of phoneLeads) {
              await supabaseAdmin
                .from('channel_outbox')
                .insert({
                  tenant_id: workspaceId,
                  workspace_id: workspaceId,
                  channel: 'voice',
                  provider: 'vapi',
                  recipient_id: lead.id,
                  recipient_phone: lead.phone,
                  payload: {
                    campaign_id: campaignId,
                    asset_id: asset.id,
                    assistant_id: voiceSettings.default_vapi_assistant_id,
                    phone_number_id: voiceSettings.default_phone_number_id,
                    script: asset.key_message,
                  },
                  status: 'scheduled',
                  scheduled_at: new Date().toISOString(),
                  idempotency_key: `${campaignId}_${asset.id}_${lead.id}_voice_${new Date().toISOString().slice(0, 10)}`,
                });
            }
            
            await supabase
              .from('cmo_content_assets')
              .update({ status: 'scheduled' })
              .eq('id', asset.id);
          }
          channelsLaunched.push('voice');
        }
      }
    } catch (e) {
      errors.push(`Voice launch failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  }

  // Master Prompt v3: Launch voice_vm (ringless voicemail) campaigns
  const voicemailAssets = assets.filter((a: any) => a.content_type === 'voice_script' || a.content_type === 'voicemail');
  if (voicemailAssets.length > 0 && (channels.includes('voice_vm') || channels.includes('voicemail'))) {
    try {
      // Get voice settings for voicemail
      const { data: voiceSettings } = await supabase
        .from('ai_settings_voice')
        .select('*')
        .eq('tenant_id', workspaceId)
        .maybeSingle();

      if (voiceSettings?.default_vapi_assistant_id) {
        // Get leads with phone numbers, filtered by target_tags/segments
        const { data: leads } = await getFilteredLeads(['phone', 'first_name', 'last_name', 'company'], 100);
        const phoneLeads = (leads || []).filter((l: any) => l.phone);

        console.log(`[launchCampaign] Found ${phoneLeads.length} leads for voicemail campaign${targetTags.length > 0 ? ` (filtered by tags: ${targetTags.join(', ')})` : ''}`);

        if (phoneLeads.length > 0) {
          for (const asset of voicemailAssets) {
            for (const lead of phoneLeads) {
              await supabaseAdmin
                .from('channel_outbox')
                .insert({
                  tenant_id: workspaceId,
                  workspace_id: workspaceId,
                  channel: 'voice_vm',
                  provider: 'vapi',
                  recipient_id: lead.id,
                  recipient_phone: lead.phone,
                  payload: {
                    campaign_id: campaignId,
                    asset_id: asset.id,
                    voicemail_asset_id: asset.id,
                    script: asset.key_message,
                    ringless: true,
                  },
                  status: 'scheduled',
                  scheduled_at: new Date().toISOString(),
                  idempotency_key: `${campaignId}_${asset.id}_${lead.id}_voicemail_${new Date().toISOString().slice(0, 10)}`,
                });
            }
            
            await supabase
              .from('cmo_content_assets')
              .update({ status: 'scheduled' })
              .eq('id', asset.id);
          }
          channelsLaunched.push('voice_vm');
        }
      }
    } catch (e) {
      errors.push(`Voicemail launch failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  }

  // Master Prompt v3: Launch SMS campaigns
  const smsAssets = assets.filter((a: any) => a.content_type === 'sms' || a.content_type === 'text_message');
  if (smsAssets.length > 0 && (channels.includes('sms') || channels.length === 0)) {
    try {
      // Check for Twilio settings
      const { data: smsSettings } = await supabase
        .from('ai_settings_sms')
        .select('*')
        .eq('tenant_id', workspaceId)
        .maybeSingle();

      // For now, allow SMS even without explicit settings (will use default Twilio config)
      // Get leads with phone numbers, filtered by target_tags/segments
      const { data: leads } = await getFilteredLeads(['phone', 'first_name', 'last_name', 'company'], 200);
      const phoneLeads = (leads || []).filter((l: any) => l.phone);

      console.log(`[launchCampaign] Found ${phoneLeads.length} leads for SMS campaign${targetTags.length > 0 ? ` (filtered by tags: ${targetTags.join(', ')})` : ''}`);

      if (phoneLeads.length > 0) {
        for (const asset of smsAssets) {
          for (const lead of phoneLeads) {
            // Master Prompt v3: SMS execution rules - one message per step per lead
            await supabaseAdmin
              .from('channel_outbox')
              .insert({
                tenant_id: workspaceId,
                workspace_id: workspaceId,
                channel: 'sms',
                provider: 'twilio',
                recipient_id: lead.id,
                recipient_phone: lead.phone,
                payload: {
                  campaign_id: campaignId,
                  asset_id: asset.id,
                  message: asset.key_message || asset.content_text,
                },
                status: 'scheduled',
                scheduled_at: new Date().toISOString(),
                idempotency_key: `${campaignId}_${asset.id}_${lead.id}_sms_${new Date().toISOString().slice(0, 10)}`,
              });
          }
          
          await supabase
            .from('cmo_content_assets')
            .update({ status: 'scheduled' })
            .eq('id', asset.id);
        }
        channelsLaunched.push('sms');
      }
    } catch (e) {
      errors.push(`SMS launch failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  }

  return { channelsLaunched, errors };
}

// Generate idempotency key for kernel events
async function makeIdempotencyKey(parts: string[]): Promise<string> {
  const data = new TextEncoder().encode(parts.join('|'));
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 40);
}

// Emit kernel event to kernel_events table (OS v1 contract)
// CRITICAL: tenant_id and workspace_id must be kept separate
// CORRELATION_ID: Request-level unique ID for tracing (includes requestId)
// IDEMPOTENCY_KEY: Hash that prevents duplicate processing (action-level)
async function emitKernelEvent(
  supabaseAdmin: any,
  tenantId: string,
  workspaceId: string,
  campaignId: string,
  eventType: string,
  action: string,
  payload: any,
  requestId: string
): Promise<{ event_id: string | null; inserted: boolean; correlation_id: string }> {
  const occurredAt = new Date().toISOString();
  
  // Correlation ID is request-level for tracing (unique per request)
  const correlationId = `campaign_${campaignId}_${eventType}_${action}_${requestId}`;
  
  // Idempotency key is action-level (daily granularity prevents duplicate processing)
  // Same action on same campaign within same day = blocked
  // Same action on same campaign on different day = allowed
  const idempotencyKey = await makeIdempotencyKey([
    tenantId,
    eventType,
    action,
    'cmo_campaigns',
    'campaign',
    campaignId,
    occurredAt.slice(0, 10), // Daily granularity
  ]);

  try {
    // Insert into kernel_events (OS v1 contract: Event → Kernel → Decision → Action)
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('kernel_events')
      .insert({
        tenant_id: tenantId,
        correlation_id: correlationId,
        type: eventType,
        source: 'cmo_campaigns',
        entity_type: 'campaign',
        entity_id: campaignId,
        payload_json: {
          ...payload,
          workspace_id: workspaceId, // Include workspace_id in payload for context
          request_id: requestId,
        },
        status: 'pending',
        idempotency_key: idempotencyKey,
        occurred_at: occurredAt,
      })
      .select('id')
      .single();

    if (!insertError && inserted?.id) {
      console.log(`[kernel] Event emitted: ${eventType}/${action} (id: ${inserted.id}, correlation: ${correlationId})`);
      return { event_id: inserted.id, inserted: true, correlation_id: correlationId };
    }

    // Handle idempotency conflict (23505 = unique_violation)
    if (insertError?.code === '23505') {
      console.log(`[kernel] Duplicate event suppressed: ${eventType}/${action} (key: ${idempotencyKey})`);
      return { event_id: null, inserted: false, correlation_id: correlationId };
    }

    console.error('[kernel] Event insert failed:', insertError);
    return { event_id: null, inserted: false, correlation_id: correlationId };
  } catch (e) {
    console.error('[kernel] Event emission error:', e);
    return { event_id: null, inserted: false, correlation_id: correlationId };
  }
}

// Also log to agent_runs for audit trail (separate from kernel)
async function logAuditEvent(
  supabaseAdmin: any,
  tenantId: string,
  workspaceId: string,
  agent: string,
  mode: string,
  input: any,
  output: any,
  status: string
): Promise<void> {
  try {
    await supabaseAdmin.from('agent_runs').insert({
      tenant_id: tenantId,
      workspace_id: workspaceId,
      agent,
      mode,
      input,
      output,
      status,
    });
  } catch (e) {
    console.error('[audit] Failed to log:', e);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } }
    });

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const input: OrchestrationInput = await req.json();
    const { tenant_id, workspace_id, campaign_id, action, channels = [], auto_create_deals = true, pipeline_stage = 'qualification' } = input;

    // Generate unique request ID for correlation tracking
    const requestId = crypto.randomUUID();

    // Input validation with defensive null checks
    if (!tenant_id || typeof tenant_id !== 'string' || tenant_id.length < 10) {
      return new Response(JSON.stringify({ 
        error: 'Invalid tenant_id: must be a valid UUID string' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!campaign_id || typeof campaign_id !== 'string') {
      return new Response(JSON.stringify({ 
        error: 'Invalid campaign_id: must be a non-empty string' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!action || !['validate', 'launch', 'optimize', 'pause', 'resume'].includes(action)) {
      return new Response(JSON.stringify({ 
        error: 'Invalid action: must be validate, launch, optimize, pause, or resume' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // CRITICAL: tenant_id and workspace_id are distinct concepts
    // tenant_id = logical tenant for RLS and isolation
    // workspace_id = operational workspace for data scoping
    // They may be the same in single-workspace tenants, but must be tracked separately
    const tenantId = tenant_id;
    const workspaceId = workspace_id || tenant_id;
    const result: OrchestrationResult = {
      success: false,
      campaign_id,
      integrations: [],
      channels_launched: [],
      leads_processed: 0,
      deals_created: 0,
      pipeline_value: 0,
      errors: [],
      recommendations: [],
    };

    console.log(`[cmo-campaign-orchestrate] Action: ${action} for campaign ${campaign_id}, tenant: ${workspaceId}`);

    // Step 1: Validate integrations
    const campaignChannels = channels.length > 0 ? channels : ['email', 'social', 'voice'];
    result.integrations = await validateIntegrations(supabase, workspaceId, campaignChannels);

    const notReadyIntegrations = result.integrations.filter(i => !i.ready && campaignChannels.some(c => c.includes(i.name) || i.name.includes(c)));
    
    if (action === 'validate') {
      result.success = notReadyIntegrations.length === 0;
      if (!result.success) {
        result.errors = notReadyIntegrations.map(i => i.error || `${i.name} not ready`);
        result.recommendations = [
          'Configure missing integrations in Settings > Integrations',
          ...notReadyIntegrations.map(i => `Set up ${i.name} integration`),
        ];
      }
      
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 2: Process leads for pipeline
    const pipelineResult = await processLeadsForPipeline(
      supabase,
      workspaceId,
      campaign_id,
      auto_create_deals,
      pipeline_stage
    );
    result.leads_processed = pipelineResult.leadsProcessed;
    result.deals_created = pipelineResult.dealsCreated;
    result.pipeline_value = pipelineResult.pipelineValue;

    // Step 3: Handle action
    if (action === 'launch') {
      // Emit kernel event for campaign launch (OS v1 contract)
      const kernelResult = await emitKernelEvent(
        supabaseAdmin, 
        tenantId, 
        workspaceId, 
        campaign_id, 
        'campaign_launched', 
        action,
        {
          campaign_id,
          channels: campaignChannels,
          leads_count: result.leads_processed,
          deals_created: result.deals_created,
        },
        requestId
      );

      // Launch across channels
      const launchResult = await launchCampaign(
        supabase,
        supabaseAdmin,
        workspaceId,
        campaign_id,
        campaignChannels,
        authHeader
      );
      result.channels_launched = launchResult.channelsLaunched;
      result.errors.push(...launchResult.errors);
      result.success = launchResult.channelsLaunched.length > 0;

      // Add recommendations
      if (result.deals_created > 0) {
        result.recommendations.push(`${result.deals_created} new deals created - review in CRM Pipeline`);
      }
      if (result.pipeline_value > 0) {
        result.recommendations.push(`$${result.pipeline_value.toLocaleString()} added to pipeline`);
      }
    } else if (action === 'optimize') {
      // Trigger optimizer
      try {
        const { data: campaign } = await supabase
          .from('cmo_campaigns')
          .select('*')
          .eq('id', campaign_id)
          .single();

        if (campaign) {
          // Fetch metrics
          const { data: metrics } = await supabase
            .from('campaign_metrics')
            .select('*')
            .eq('campaign_id', campaign_id)
            .maybeSingle();

          // Call optimizer
          const { data: optimizationResult } = await supabase.functions.invoke('cmo-optimizer', {
            body: {
              tenant_id: workspaceId,
              workspace_id: workspaceId,
              campaign_id,
              goal: campaign.objective || 'leads',
              metrics: metrics || { opens: 0, clicks: 0, replies: 0, booked_meetings: 0 },
            },
          });

          if (optimizationResult?.changes) {
            result.recommendations = optimizationResult.changes.map((c: any) => c.reason);
          }
          result.success = true;
        }
      } catch (e) {
        result.errors.push(`Optimization failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
      }
    } else if (action === 'pause') {
      await supabase
        .from('cmo_campaigns')
        .update({ status: 'paused' })
        .eq('id', campaign_id);
      
      // Pause scheduled outbox items
      await supabaseAdmin
        .from('channel_outbox')
        .update({ status: 'paused' })
        .match({ 'payload->>campaign_id': campaign_id, status: 'scheduled' });
      
      result.success = true;
    } else if (action === 'resume') {
      await supabase
        .from('cmo_campaigns')
        .update({ status: 'active' })
        .eq('id', campaign_id);
      
      // Resume paused outbox items
      await supabaseAdmin
        .from('channel_outbox')
        .update({ status: 'scheduled' })
        .match({ 'payload->>campaign_id': campaign_id, status: 'paused' });
      
      result.success = true;
    }

    // Log orchestration run to audit trail (separate from kernel events)
    await logAuditEvent(
      supabaseAdmin,
      tenantId,
      workspaceId,
      'cmo-campaign-orchestrate',
      action,
      input,
      result,
      result.success ? 'completed' : 'failed'
    );

    console.log(`[cmo-campaign-orchestrate] Completed: ${result.success ? 'Success' : 'Failed'}, channels: ${result.channels_launched.join(', ')}`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[cmo-campaign-orchestrate] Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
