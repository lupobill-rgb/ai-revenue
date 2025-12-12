/**
 * CRM + Analytics Spine - Shared Edge Function Utilities
 * 
 * All CMO actions MUST flow through this unified backbone.
 * This module provides helpers for edge functions to integrate with:
 * - crm_contacts / crm_leads (via crm_upsert_contact_and_lead RPC)
 * - crm_activities (activity logging)
 * - campaign_channel_stats_daily (analytics roll-up)
 * 
 * NO ORPHANED DATA - every event maps back to campaign_id and tenant_id
 */

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Supported channels
 */
export type CrmChannel = 'email' | 'sms' | 'voice' | 'linkedin' | 'landing_page';

/**
 * Activity types for crm_activities
 */
export type ActivityType = 
  | 'landing_form_submit'
  | 'email_sent' | 'email_opened' | 'email_clicked' | 'email_replied' | 'email_bounced' | 'email_unsubscribed'
  | 'sms_sent' | 'sms_delivered' | 'sms_replied'
  | 'voice_call_initiated' | 'voice_call_completed' | 'voice_call_no_answer' | 'voice_meeting_booked'
  | 'linkedin_connection_sent' | 'linkedin_connection_accepted' | 'linkedin_message_sent' | 'linkedin_message_replied'
  | 'status_change' | 'meeting_booked' | 'meeting_completed' | 'meeting_no_show';

/**
 * Stat types for campaign_channel_stats_daily
 */
export type StatType = 'sends' | 'deliveries' | 'opens' | 'clicks' | 'replies' | 'bounces' | 'meetings_booked';

/**
 * Maps activity types to stat types
 */
const ACTIVITY_TO_STAT: Partial<Record<ActivityType, StatType>> = {
  email_sent: 'sends',
  email_opened: 'opens',
  email_clicked: 'clicks',
  email_replied: 'replies',
  email_bounced: 'bounces',
  sms_sent: 'sends',
  sms_delivered: 'deliveries',
  sms_replied: 'replies',
  linkedin_message_sent: 'sends',
  linkedin_message_replied: 'replies',
  voice_call_completed: 'sends',
  voice_meeting_booked: 'meetings_booked',
  meeting_booked: 'meetings_booked'
};

/**
 * Create Supabase client with service role for CRM operations
 */
export function createServiceClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
}

/**
 * Log an activity to crm_activities
 * This is the canonical way to record any customer interaction
 * 
 * GUARDRAIL: This operation is fail-soft - errors are logged but don't propagate
 */
export async function logCrmActivity(
  supabase: SupabaseClient,
  params: {
    tenant_id: string;
    contact_id: string;
    lead_id?: string;
    activity_type: ActivityType;
    meta: Record<string, unknown>;
    new_status?: string;
    idempotency_key?: string;
  }
): Promise<{ success: boolean; activity_id?: string; error?: string; duplicate?: boolean }> {
  try {
    // GUARDRAIL: Validate tenant_id
    if (!params.tenant_id) {
      console.error('[CRM Spine] GUARDRAIL VIOLATION: Missing tenant_id');
      return { success: false, error: 'tenant_id is required' };
    }

    // GUARDRAIL: Idempotency check
    if (params.idempotency_key) {
      const { data: existing } = await supabase
        .from('crm_activities')
        .select('id')
        .eq('tenant_id', params.tenant_id)
        .eq('meta->>idempotency_key', params.idempotency_key)
        .maybeSingle();

      if (existing) {
        console.log(`[CRM Spine] Idempotent skip - activity already exists: ${existing.id}`);
        return { success: true, activity_id: existing.id, duplicate: true };
      }
    }

    // Add idempotency key to meta
    const metaWithKey = params.idempotency_key 
      ? { ...params.meta, idempotency_key: params.idempotency_key }
      : params.meta;

    // Use the RPC if status change is needed
    if (params.new_status) {
      const { data, error } = await supabase.rpc('crm_log_activity', {
        in_tenant_id: params.tenant_id,
        in_contact_id: params.contact_id,
        in_lead_id: params.lead_id || null,
        in_activity_type: params.activity_type,
        in_meta: metaWithKey,
        in_new_status: params.new_status
      });

      if (error) throw error;
      return { success: true, activity_id: data };
    }

    // Direct insert for simple activities
    const { data, error } = await supabase
      .from('crm_activities')
      .insert({
        tenant_id: params.tenant_id,
        contact_id: params.contact_id,
        lead_id: params.lead_id,
        activity_type: params.activity_type,
        meta: metaWithKey
      })
      .select('id')
      .single();

    if (error) throw error;
    return { success: true, activity_id: data?.id };
  } catch (error) {
    // GUARDRAIL: Fail-soft - log error but don't crash
    console.error('[CRM Spine] Failed to log activity (fail-soft):', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Update campaign_channel_stats_daily
 * Uses the upsert_campaign_daily_stat RPC for atomic updates
 */
export async function updateDailyStats(
  supabase: SupabaseClient,
  params: {
    tenant_id: string;
    campaign_id: string;
    channel: CrmChannel;
    stat_type: StatType;
    increment?: number;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const { error } = await supabase.rpc('upsert_campaign_daily_stat', {
      p_tenant_id: params.tenant_id,
      p_campaign_id: params.campaign_id,
      p_channel: params.channel,
      p_day: today,
      p_stat_type: params.stat_type,
      p_increment: params.increment || 1
    });

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('[CRM Spine] Failed to update daily stats:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Upsert contact and create lead using centralized RPC
 * This is the ONLY way to create contacts/leads from any channel
 */
export async function upsertContactAndLead(
  supabase: SupabaseClient,
  params: {
    tenant_id: string;
    email: string;
    phone?: string;
    first_name?: string;
    last_name?: string;
    company?: string;
    job_title?: string;
    campaign_id?: string;
    source: string;
  }
): Promise<{ success: boolean; contact_id?: string; lead_id?: string; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('crm_upsert_contact_and_lead', {
      in_tenant_id: params.tenant_id,
      in_email: params.email,
      in_phone: params.phone || null,
      in_first_name: params.first_name || null,
      in_last_name: params.last_name || null,
      in_company: params.company || null,
      in_job_title: params.job_title || null,
      in_campaign_id: params.campaign_id || null,
      in_source: params.source
    });

    if (error) throw error;
    if (!data || data.length === 0) throw new Error('No data returned from RPC');

    return {
      success: true,
      contact_id: data[0].contact_id,
      lead_id: data[0].lead_id
    };
  } catch (error) {
    console.error('[CRM Spine] Failed to upsert contact/lead:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get the stat type to increment for a given activity
 */
export function getStatTypeForActivity(activityType: ActivityType): StatType | null {
  return ACTIVITY_TO_STAT[activityType] || null;
}

/**
 * Determine if an activity should pause outbound sequences
 */
export function shouldPauseSequence(activityType: ActivityType): boolean {
  return [
    'email_replied',
    'sms_replied', 
    'linkedin_message_replied',
    'voice_meeting_booked',
    'meeting_booked',
    'email_unsubscribed'
  ].includes(activityType);
}

/**
 * Pause sequences for a lead (when reply/booking received)
 */
export async function pauseSequencesForLead(
  supabase: SupabaseClient,
  params: {
    tenant_id: string;
    lead_id?: string;
    contact_id?: string;
  }
): Promise<{ success: boolean; paused_count: number }> {
  if (!params.lead_id && !params.contact_id) {
    return { success: false, paused_count: 0 };
  }

  try {
    // Find prospect by lead_id or contact email
    let prospectId: string | null = null;

    if (params.lead_id) {
      const { data: prospect } = await supabase
        .from('prospects')
        .select('id')
        .eq('lead_id', params.lead_id)
        .single();
      prospectId = prospect?.id;
    }

    if (!prospectId && params.contact_id) {
      // Find via contact email
      const { data: contact } = await supabase
        .from('crm_contacts')
        .select('email')
        .eq('id', params.contact_id)
        .single();

      if (contact?.email) {
        const { data: prospect } = await supabase
          .from('prospects')
          .select('id')
          .eq('email', contact.email)
          .eq('tenant_id', params.tenant_id)
          .single();
        prospectId = prospect?.id;
      }
    }

    if (!prospectId) {
      return { success: true, paused_count: 0 };
    }

    // Pause active sequence runs
    const { data: updated, error } = await supabase
      .from('outbound_sequence_runs')
      .update({ status: 'paused', updated_at: new Date().toISOString() })
      .eq('prospect_id', prospectId)
      .eq('status', 'active')
      .select('id');

    if (error) throw error;

    return { success: true, paused_count: updated?.length || 0 };
  } catch (error) {
    console.error('[CRM Spine] Failed to pause sequences:', error);
    return { success: false, paused_count: 0 };
  }
}

/**
 * Standard webhook processing - the pattern all channel webhooks should follow
 */
export async function processChannelWebhook(
  supabase: SupabaseClient,
  params: {
    channel: CrmChannel;
    activity_type: ActivityType;
    tenant_id: string;
    campaign_id?: string;
    contact_id: string;
    lead_id?: string;
    meta: Record<string, unknown>;
    new_status?: string;
    trigger_orchestrator?: boolean;
    orchestrator_action?: string;
  }
): Promise<{
  success: boolean;
  activity_logged: boolean;
  stats_updated: boolean;
  sequences_paused: boolean;
  orchestrator_triggered: boolean;
  errors: string[];
}> {
  const errors: string[] = [];
  let activity_logged = false;
  let stats_updated = false;
  let sequences_paused = false;
  let orchestrator_triggered = false;

  // 1. Log activity
  const activityResult = await logCrmActivity(supabase, {
    tenant_id: params.tenant_id,
    contact_id: params.contact_id,
    lead_id: params.lead_id,
    activity_type: params.activity_type,
    meta: params.meta,
    new_status: params.new_status
  });

  activity_logged = activityResult.success;
  if (!activityResult.success) {
    errors.push(`Activity logging failed: ${activityResult.error}`);
  }

  // 2. Update daily stats if campaign_id present
  if (params.campaign_id) {
    const statType = getStatTypeForActivity(params.activity_type);
    if (statType) {
      const statsResult = await updateDailyStats(supabase, {
        tenant_id: params.tenant_id,
        campaign_id: params.campaign_id,
        channel: params.channel,
        stat_type: statType
      });
      stats_updated = statsResult.success;
      if (!statsResult.success) {
        errors.push(`Stats update failed: ${statsResult.error}`);
      }
    }
  }

  // 3. Pause sequences if needed
  if (shouldPauseSequence(params.activity_type)) {
    const pauseResult = await pauseSequencesForLead(supabase, {
      tenant_id: params.tenant_id,
      lead_id: params.lead_id,
      contact_id: params.contact_id
    });
    sequences_paused = pauseResult.paused_count > 0;
  }

  // 4. Trigger orchestrator if requested
  if (params.trigger_orchestrator && params.orchestrator_action) {
    try {
      const { error } = await supabase.functions.invoke('cmo-orchestrator', {
        body: {
          tenant_id: params.tenant_id,
          workspace_id: params.tenant_id,
          action: params.orchestrator_action,
          context: {
            campaign_id: params.campaign_id,
            lead_id: params.lead_id,
            trigger_source: `${params.channel}_webhook`
          },
          payload: {
            activity_type: params.activity_type,
            contact_id: params.contact_id,
            lead_id: params.lead_id,
            meta: params.meta
          }
        }
      });
      orchestrator_triggered = !error;
      if (error) {
        errors.push(`Orchestrator trigger failed: ${error.message}`);
      }
    } catch (e) {
      errors.push(`Orchestrator exception: ${e instanceof Error ? e.message : 'Unknown'}`);
    }
  }

  return {
    success: errors.length === 0,
    activity_logged,
    stats_updated,
    sequences_paused,
    orchestrator_triggered,
    errors
  };
}
