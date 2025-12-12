# CMO Guardrails

Security and reliability safeguards that MUST NOT break.

## 1. Multi-Tenant Isolation

**Every kernel run includes tenant_id. Orchestrator must never see or act across tenants.**

### Validation Pattern

```typescript
// Every edge function MUST validate tenant_id
if (!tenant_id) {
  return new Response(JSON.stringify({ 
    error: 'tenant_id is required',
    error_code: 'MISSING_TENANT_ID'
  }), { status: 400 });
}

// Campaign ownership check
const { data: campaign, error } = await supabase
  .from('cmo_campaigns')
  .select('*')
  .eq('id', campaign_id)
  .eq('tenant_id', tenant_id)  // CRITICAL: Always filter by tenant
  .single();

if (error || !campaign) {
  return new Response(JSON.stringify({ 
    error: 'Campaign not found or does not belong to this tenant',
    error_code: 'INVALID_CAMPAIGN_TENANT'
  }), { status: 404 });
}
```

### Rules
- All queries MUST include `.eq('tenant_id', tenantId)`
- Never use service role without tenant filtering
- Log tenant_id in all error messages for audit
- RLS policies are defense-in-depth, not primary protection

## 2. Idempotency

**Webhooks and cron loops must handle retries without double-counting.**

### Implementation

```typescript
// Add idempotency key to all webhook processing
const idempotencyKey = `${providerMessageId}:${eventType}`;

// Check if already processed
const { data: existing } = await supabase
  .from('crm_activities')
  .select('id')
  .eq('tenant_id', tenantId)
  .eq('meta->>idempotency_key', idempotencyKey)
  .maybeSingle();

if (existing) {
  console.log(`Idempotent skip - already processed: ${existing.id}`);
  return { success: true, duplicate: true };
}
```

### Email Events Table
Unique constraint on `(tenant_id, provider_message_id, event_type)` prevents duplicate email events.

### Cron Jobs
- Use `agent_runs` table to track execution
- Check for recent runs before starting
- Log run_id for correlation

## 3. Fail-Soft Behavior

**If any specialist fails: log error, don't block CRM, don't take destructive actions.**

### Pattern

```typescript
import { failSoftExecute, executeCrmFirst } from './_shared/guardrails.ts';

// CRM logging is critical - other operations are fail-soft
const { crmSuccess, results } = await executeCrmFirst(
  // Critical: CRM logging
  async () => {
    await logCrmActivity(supabase, { 
      tenant_id, contact_id, activity_type, meta 
    });
  },
  // Non-critical: these can fail without blocking
  [
    { name: 'update_stats', fn: () => updateDailyStats(...) },
    { name: 'trigger_orchestrator', fn: () => callOrchestrator(...) },
    { name: 'send_notification', fn: () => sendWebhook(...) }
  ],
  tenant_id
);

// CRM always succeeds, other operations logged if failed
console.log(`CRM: ${crmSuccess}, Others: ${JSON.stringify(results)}`);
```

### Rules
- NEVER block CRM logging on secondary operations
- Log all errors but continue processing
- No partial destructive actions (all-or-nothing for content updates)
- Rollback capability for all applied changes

## 4. Human Override

**AI changes are either auto-applied but visible in logs, or staged for approval.**

### Visibility

Every AI change is logged to `campaign_optimizations` table:

```typescript
await supabase.from('campaign_optimizations').insert({
  tenant_id,
  workspace_id,
  campaign_id,
  optimization_type: 'update_email',
  summary: 'Improved subject line based on low open rate',
  changes: {
    asset_type: 'email',
    asset_id: emailId,
    previous_value: oldSubject,
    new_value: newSubject,
    auto_applied: true,
    agent: 'cmo_optimizer'
  },
  applied_at: new Date().toISOString()
});
```

### Manual Approval Mode

For high-risk tenants, changes are queued instead of auto-applied:

```typescript
// Check tenant setting
const { data: settings } = await supabase
  .from('tenant_settings')
  .select('require_manual_approval')
  .eq('tenant_id', tenant_id)
  .maybeSingle();

if (settings?.require_manual_approval) {
  // Queue for approval instead of applying
  await supabase.from('cmo_recommendations').insert({
    tenant_id,
    campaign_id,
    recommendation_type: 'optimization',
    title: 'AI Optimization Recommendation',
    description: change.reason,
    priority: 'high',
    status: 'pending',
    proposed_changes: change
  });
} else {
  // Auto-apply
  await applyChange(change);
}
```

### Rollback

All changes can be rolled back:

```typescript
import { rollbackChange } from './_shared/guardrails.ts';

const result = await rollbackChange(supabase, changeId, tenantId);
```

## Shared Module

Import guardrails in edge functions:

```typescript
import { 
  validateTenantAccess,
  validateCampaignOwnership,
  checkEventProcessed,
  failSoftExecute,
  executeCrmFirst,
  logAIChange,
  queueForApproval,
  requiresManualApproval,
  rollbackChange
} from './_shared/guardrails.ts';
```

## Testing Checklist

| Guardrail | Test |
|-----------|------|
| Tenant isolation | Query with wrong tenant_id returns 404 |
| Idempotency | Same webhook twice = one event |
| Fail-soft | Optimizer failure doesn't block CRM logging |
| Human override | Changes visible in campaign_optimizations |
| Rollback | AI change can be reversed |

## Monitoring

```sql
-- Check for cross-tenant violations (should be 0)
SELECT COUNT(*) 
FROM agent_runs a1
JOIN agent_runs a2 ON a1.tenant_id != a2.tenant_id 
  AND a1.input->>'campaign_id' = a2.input->>'campaign_id';

-- Check idempotency (duplicate detection)
SELECT meta->>'idempotency_key', COUNT(*)
FROM crm_activities
GROUP BY meta->>'idempotency_key'
HAVING COUNT(*) > 1;

-- Check AI change visibility
SELECT campaign_id, COUNT(*) as changes_count
FROM campaign_optimizations
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY campaign_id
ORDER BY changes_count DESC;
```
