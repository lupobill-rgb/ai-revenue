# CMO Backend Requirements

## Edge Function Architecture

### Core Agent Functions
| Function | Mode | Input | Output |
|----------|------|-------|--------|
| `cmo-brand-intake` | setup | `{ messages, currentStep, existingData }` | Streamed AI response |
| `cmo-plan-90day` | strategy | `{ workspaceId, primaryGoal, budget, targetMetrics, constraints, startDate }` | Streamed plan JSON |
| `cmo-funnel-architect` | funnels | `{ workspaceId, planId?, funnelType? }` | Streamed funnel JSON |
| `cmo-campaign-designer` | campaigns | `{ workspaceId, funnelId?, planId?, campaignGoal, channels, preferences }` | Streamed campaign JSON |
| `cmo-content-engine` | content | `{ workspaceId, campaignId, funnelStage, channels, ctaIntent, contentTypes }` | Streamed content JSON |
| `cmo-optimization-analyst` | optimization | `{ workspaceId, planId?, funnelId?, period? }` | Streamed recommendations JSON |

### Kernel Routing
```typescript
// cmo-kernel routes based on mode
const MODE_TO_FUNCTION = {
  setup: 'cmo-brand-intake',
  strategy: 'cmo-plan-90day',
  funnels: 'cmo-funnel-architect',
  campaigns: 'cmo-campaign-designer',
  content: 'cmo-content-engine',
  optimization: 'cmo-optimization-analyst'
};
```

## Database Operations

### Required Queries
```typescript
// All queries MUST be tenant-scoped
supabase.from('cmo_brand_profiles').select('*').eq('workspace_id', workspaceId)
supabase.from('cmo_icp_segments').select('*').eq('workspace_id', workspaceId)
supabase.from('cmo_offers').select('*').eq('workspace_id', workspaceId)
```

### Insert Requirements
- All inserts MUST include `tenant_id` and `workspace_id`
- Use `created_by: user.id` when available
- Never insert without workspace context

## AI Gateway Contract

### Request Format
```typescript
{
  model: "google/gemini-2.5-flash",
  messages: [
    { role: "system", content: systemPrompt },
    { role: "user", content: contextPrompt }
  ],
  stream: true
}
```

### Required Headers
```typescript
{
  Authorization: `Bearer ${LOVABLE_API_KEY}`,
  "Content-Type": "application/json"
}
```

### Error Responses
- `429` → Return `{ error: "Rate limits exceeded" }` with status 429
- `402` → Return `{ error: "Payment required" }` with status 402
- `500` → Log error, return generic message

## Agent Run Logging

Every agent execution MUST log to `agent_runs`:
```typescript
// Before execution
await supabase.from('agent_runs').insert({
  agent: functionName,
  mode: requestMode,
  tenant_id: tenantId,
  workspace_id: workspaceId,
  status: 'running',
  input: requestPayload
});

// After execution
await supabase.from('agent_runs').update({
  status: 'completed',
  output: responseData,
  duration_ms: elapsed,
  completed_at: new Date().toISOString()
});
```

## Security Requirements

### Authentication
- Validate JWT on all requests
- Extract user from `supabase.auth.getUser()`
- Reject unauthenticated requests with 401

### Tenant Isolation
- Never query without workspace_id filter
- Validate user has workspace access before operations
- Use RLS as defense-in-depth

### CORS Headers
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
```
