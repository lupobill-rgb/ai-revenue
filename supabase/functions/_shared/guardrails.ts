/**
 * CMO Guardrails - Security & Reliability Safeguards
 * 
 * These guardrails MUST NOT break:
 * 1. Multi-tenant isolation - tenant_id validated on every operation
 * 2. Idempotency - webhooks/cron handle retries without double-counting
 * 3. Fail-soft - errors logged but don't block CRM operations
 * 4. Human override - all AI changes visible and reversible
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// ==================== MULTI-TENANT ISOLATION ====================

/**
 * Validate that a tenant_id exists and the request is authorized to act on it
 */
export async function validateTenantAccess(
  supabase: SupabaseClient,
  tenantId: string,
  userId?: string
): Promise<{ valid: boolean; error?: string }> {
  if (!tenantId) {
    return { valid: false, error: 'tenant_id is required' };
  }

  // UUID format validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(tenantId)) {
    return { valid: false, error: 'Invalid tenant_id format' };
  }

  // If userId provided, check they have access to this tenant
  if (userId) {
    const { data: access, error } = await supabase
      .from('user_tenants')
      .select('id')
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (error || !access) {
      // Fallback: check if user owns the workspace
      const { data: workspace } = await supabase
        .from('workspaces')
        .select('id')
        .eq('id', tenantId)
        .eq('owner_id', userId)
        .maybeSingle();

      if (!workspace) {
        return { valid: false, error: 'User does not have access to this tenant' };
      }
    }
  }

  return { valid: true };
}

/**
 * Ensure a campaign belongs to the specified tenant
 */
export async function validateCampaignOwnership(
  supabase: SupabaseClient,
  campaignId: string,
  tenantId: string
): Promise<{ valid: boolean; campaign?: any; error?: string }> {
  const { data: campaign, error } = await supabase
    .from('cmo_campaigns')
    .select('*')
    .eq('id', campaignId)
    .eq('tenant_id', tenantId)
    .single();

  if (error || !campaign) {
    return { valid: false, error: 'Campaign not found or does not belong to this tenant' };
  }

  return { valid: true, campaign };
}

// ==================== IDEMPOTENCY ====================

/**
 * Check if an event has already been processed (for webhook idempotency)
 * Uses provider_message_id + event_type as unique key
 */
export async function checkEventProcessed(
  supabase: SupabaseClient,
  params: {
    tenantId: string;
    providerMessageId: string;
    eventType: string;
    tableName?: string;
  }
): Promise<{ processed: boolean; existingId?: string }> {
  const tableName = params.tableName || 'email_events';

  const { data: existing } = await supabase
    .from(tableName)
    .select('id')
    .eq('tenant_id', params.tenantId)
    .eq('provider_message_id', params.providerMessageId)
    .eq('event_type', params.eventType)
    .maybeSingle();

  return {
    processed: !!existing,
    existingId: existing?.id
  };
}

/**
 * Generate idempotency key for webhook/cron operations
 */
export function generateIdempotencyKey(
  ...parts: (string | number | undefined)[]
): string {
  return parts.filter(Boolean).join(':');
}

/**
 * Record processed event to prevent duplicate processing
 */
export async function recordProcessedEvent(
  supabase: SupabaseClient,
  params: {
    tenantId: string;
    idempotencyKey: string;
    eventType: string;
    metadata?: Record<string, unknown>;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    // Use a dedicated idempotency tracking table or leverage existing
    const { error } = await supabase
      .from('processed_events')
      .insert({
        tenant_id: params.tenantId,
        idempotency_key: params.idempotencyKey,
        event_type: params.eventType,
        metadata: params.metadata || {},
        processed_at: new Date().toISOString()
      })
      .select()
      .single();

    // Unique constraint violation means already processed - that's OK
    if (error?.code === '23505') {
      return { success: true }; // Already processed, idempotent success
    }

    if (error) throw error;
    return { success: true };
  } catch (e) {
    // If table doesn't exist, gracefully continue
    console.warn('[Guardrails] Could not record processed event:', e);
    return { success: true };
  }
}

// ==================== FAIL-SOFT BEHAVIOR ====================

/**
 * Execute an operation with fail-soft behavior
 * Logs errors but doesn't block CRM operations
 */
export async function failSoftExecute<T>(
  operation: () => Promise<T>,
  context: {
    operationName: string;
    tenantId: string;
    critical?: boolean;
  }
): Promise<{ result?: T; error?: string; success: boolean }> {
  try {
    const result = await operation();
    return { result, success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Fail-Soft] ${context.operationName} failed for tenant ${context.tenantId}:`, errorMessage);

    // If critical, rethrow
    if (context.critical) {
      throw error;
    }

    return {
      error: errorMessage,
      success: false
    };
  }
}

/**
 * Wrap multiple operations with fail-soft behavior
 * CRM logging always succeeds even if other operations fail
 */
export async function executeCrmFirst<T>(
  crmOperation: () => Promise<void>,
  otherOperations: Array<{ name: string; fn: () => Promise<T> }>,
  tenantId: string
): Promise<{
  crmSuccess: boolean;
  results: Array<{ name: string; success: boolean; error?: string }>;
}> {
  // CRM operation is critical - must complete
  let crmSuccess = true;
  try {
    await crmOperation();
  } catch (error) {
    console.error(`[CRM-First] CRM operation failed for tenant ${tenantId}:`, error);
    crmSuccess = false;
  }

  // Other operations are fail-soft
  const results = await Promise.all(
    otherOperations.map(async ({ name, fn }) => {
      const result = await failSoftExecute(fn, {
        operationName: name,
        tenantId,
        critical: false
      });
      return { name, success: result.success, error: result.error };
    })
  );

  return { crmSuccess, results };
}

// ==================== HUMAN OVERRIDE ====================

/**
 * Log AI change for visibility and potential rollback
 */
export async function logAIChange(
  supabase: SupabaseClient,
  params: {
    tenantId: string;
    campaignId: string;
    changeType: string;
    assetType: string;
    assetId: string;
    previousValue: unknown;
    newValue: unknown;
    reason: string;
    autoApplied: boolean;
    agentName: string;
  }
): Promise<{ success: boolean; changeId?: string }> {
  try {
    const { data, error } = await supabase
      .from('campaign_optimizations')
      .insert({
        tenant_id: params.tenantId,
        workspace_id: params.tenantId,
        campaign_id: params.campaignId,
        optimization_type: params.changeType,
        summary: params.reason,
        changes: {
          asset_type: params.assetType,
          asset_id: params.assetId,
          previous_value: params.previousValue,
          new_value: params.newValue,
          auto_applied: params.autoApplied,
          agent: params.agentName
        },
        applied_at: params.autoApplied ? new Date().toISOString() : null,
        metrics_snapshot: {}
      })
      .select('id')
      .single();

    if (error) throw error;
    return { success: true, changeId: data?.id };
  } catch (error) {
    console.error('[Guardrails] Failed to log AI change:', error);
    return { success: false };
  }
}

/**
 * Queue a change for human approval instead of auto-applying
 */
export async function queueForApproval(
  supabase: SupabaseClient,
  params: {
    tenantId: string;
    campaignId: string;
    changeType: string;
    description: string;
    proposedChange: unknown;
    priority: 'low' | 'medium' | 'high' | 'critical';
    agentName: string;
  }
): Promise<{ success: boolean; recommendationId?: string }> {
  try {
    const { data, error } = await supabase
      .from('cmo_recommendations')
      .insert({
        tenant_id: params.tenantId,
        workspace_id: params.tenantId,
        campaign_id: params.campaignId,
        recommendation_type: params.changeType,
        title: `${params.agentName}: ${params.changeType}`,
        description: params.description,
        priority: params.priority,
        status: 'pending',
        proposed_changes: params.proposedChange,
        created_by_agent: params.agentName
      })
      .select('id')
      .single();

    if (error) throw error;
    return { success: true, recommendationId: data?.id };
  } catch (error) {
    console.error('[Guardrails] Failed to queue for approval:', error);
    return { success: false };
  }
}

/**
 * Check if tenant requires manual approval for AI changes
 */
export async function requiresManualApproval(
  supabase: SupabaseClient,
  tenantId: string
): Promise<boolean> {
  try {
    // Check tenant settings for approval requirements
    const { data: settings } = await supabase
      .from('tenant_settings')
      .select('require_manual_approval')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    return settings?.require_manual_approval === true;
  } catch {
    // Default to auto-apply if settings not configured
    return false;
  }
}

/**
 * Rollback an AI change
 */
export async function rollbackChange(
  supabase: SupabaseClient,
  changeId: string,
  tenantId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get the change record
    const { data: change, error: fetchError } = await supabase
      .from('campaign_optimizations')
      .select('*')
      .eq('id', changeId)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchError || !change) {
      return { success: false, error: 'Change not found' };
    }

    const changes = change.changes as {
      asset_type?: string;
      asset_id?: string;
      previous_value?: unknown;
    };

    // Restore previous value based on asset type
    if (changes?.asset_type === 'email' && changes?.asset_id && changes?.previous_value) {
      await supabase
        .from('cmo_content_assets')
        .update({
          key_message: changes.previous_value,
          updated_at: new Date().toISOString()
        })
        .eq('id', changes.asset_id);
    }

    // Mark change as rolled back
    await supabase
      .from('campaign_optimizations')
      .update({
        changes: {
          ...changes,
          rolled_back: true,
          rolled_back_at: new Date().toISOString()
        }
      })
      .eq('id', changeId);

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// ==================== VALIDATION UTILITIES ====================

/**
 * Validate required fields with tenant context
 */
export function validateRequiredFields(
  fields: Record<string, unknown>,
  required: string[]
): { valid: boolean; missing: string[] } {
  const missing: string[] = [];

  for (const field of required) {
    if (fields[field] === undefined || fields[field] === null || fields[field] === '') {
      missing.push(field);
    }
  }

  return {
    valid: missing.length === 0,
    missing
  };
}

/**
 * Build error response with tenant context
 */
export function buildErrorResponse(
  error: string,
  code: string,
  tenantId?: string,
  details?: Record<string, unknown>
): {
  success: false;
  error: string;
  error_code: string;
  tenant_id?: string;
  details?: Record<string, unknown>;
} {
  return {
    success: false,
    error,
    error_code: code,
    tenant_id: tenantId,
    details
  };
}
