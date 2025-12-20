# CMO Module Backend Specification

## Overview
The AI CMO backend is a set of Supabase Edge Functions that orchestrate marketing automation through AI-powered agents.

## Edge Functions

### Core Functions
| Function | Mode | Purpose |
|----------|------|---------|
| `cmo-kernel` | router | Routes requests to appropriate agent function |
| `cmo-brand-intake` | setup | Conversational brand & ICP extraction |
| `cmo-plan-90day` | strategy | Generates 90-day marketing plans |
| `cmo-funnel-architect` | funnels | Designs funnel stages & campaigns |
| `cmo-campaign-designer` | campaigns | Creates multi-channel campaign blueprints |
| `cmo-content-engine` | content | Produces brand-consistent content assets |
| `cmo-optimization-analyst` | optimization | Analyzes performance & recommends improvements |

### Supporting Functions
| Function | Purpose |
|----------|---------|
| `cmo-generate-content` | Generates specific content pieces |
| `cmo-generate-funnel` | Creates funnel from plan context |
| `cmo-create-plan` | Persists generated plan to database |
| `cmo-launch-campaign` | Activates campaign deployment |
| `cmo-record-metrics` | Records performance snapshots |
| `cmo-summarize-weekly` | Generates weekly performance summaries |
| `cmo-webhook-outbound` | Handles external webhook delivery |
| `cmo-cron-weekly` | Scheduled weekly automation tasks |

## Database Schema

### Primary Tables
- `cmo_brand_profiles` - Brand identity, voice, positioning
- `cmo_icp_segments` - Ideal customer profiles
- `cmo_offers` - Products/services definitions
- `cmo_marketing_plans` - 90-day strategic plans
- `cmo_funnels` - Funnel configurations
- `cmo_funnel_stages` - Individual stage definitions

### Campaign Tables
- `cmo_campaigns` - Campaign configurations
- `cmo_campaign_channels` - Channel-specific settings
- `cmo_content_assets` - Generated content pieces
- `cmo_content_variants` - A/B test variants

### Analytics Tables
- `cmo_metrics_snapshots` - Point-in-time metrics
- `cmo_recommendations` - AI-generated recommendations
- `cmo_weekly_summaries` - Weekly rollup reports
- `cmo_calendar_events` - Scheduled activities

## Security

### RLS Policies
All tables enforce tenant isolation via:
- `tenant_isolation` policy on primary tables
- `user_has_workspace_access()` function for workspace-scoped access
- Derived access functions for child tables:
  - `funnel_stage_workspace_access()`
  - `campaign_channel_workspace_access()`
  - `content_variant_workspace_access()`

### Authentication
- All functions require authenticated user via JWT
- `cmo-kernel` validates auth before routing
- Service role reserved for internal/cron functions only

## AI Gateway Integration

### Model
- Default: `google/gemini-2.5-flash`
- Endpoint: `https://ai.gateway.lovable.dev/v1/chat/completions`

### Pattern
```typescript
const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${LOVABLE_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "google/gemini-2.5-flash",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: contextPrompt }
    ],
    stream: true,
  }),
});
```

### Error Handling
- 429: Rate limit exceeded → surface to user
- 402: Payment required → surface to user
- 500: Log and return generic error

## Agent Run Logging

All agent executions are logged to `agent_runs` table:
```typescript
{
  id: uuid,
  agent: "cmo-plan-90day",
  mode: "strategy",
  tenant_id: uuid,
  workspace_id: uuid,
  status: "pending" | "running" | "completed" | "failed",
  input: jsonb,
  output: jsonb,
  duration_ms: integer,
  error_message: text
}
```

## Rate Limiting

Implemented via `check_and_increment_rate_limit()` SQL function:
- Per-minute, per-hour, per-day windows
- Scoped by endpoint + tenant + IP
- Fail-closed on any error

## Campaign Run Status Updates

### Who Can Call `update_campaign_run_status()`
- **ONLY** the `run-job-queue` edge function (via service_role)
- Regular authenticated users: ❌ DENIED
- Anonymous users: ❌ DENIED
- Other edge functions: ❌ DENIED (unless using service_role key)

### Access Control
- EXECUTE revoked from `PUBLIC`, `authenticated`, `anon`
- EXECUTE granted only to `service_role`
- Function validates `request.jwt.claim.role = 'service_role'`

### Status Transitions (Enforced)
```
queued → running → completed|partial|failed
queued → failed (scheduler rejection only)
```
No backwards transitions allowed.

### Protected Fields (Immutable)
- `tenant_id`, `workspace_id`, `campaign_id`, `created_by`, `scheduled_for`
