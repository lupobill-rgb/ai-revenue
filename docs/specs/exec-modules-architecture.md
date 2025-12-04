# Executive Modules Architecture

## Overview

UbiGrowth OS provides four AI-powered executive modules, each following an identical architecture pattern. CMO is the template module; CRO, CFO, and COO follow the same structure.

## Module Registry

| Module ID | Name | Prefix | Orchestrator |
|-----------|------|--------|--------------|
| `ai_cmo` | AI CMO Module | `cmo_*` | CMO Orchestrator |
| `ai_cro` | AI CRO Module | `cro_*` | CRO Orchestrator |
| `ai_cfo` | AI CFO Module | `cfo_*` | CFO Orchestrator |
| `ai_coo` | AI COO Module | `coo_*` | COO Orchestrator |

## Shared Architecture Pattern

### 1. Database Tables

Each module has its own prefixed tables with identical RLS patterns:

```
{prefix}_*           # All tables for the module
tenant_id            # Required on all tables
workspace_id         # Required on all tables
RLS: tenant_isolation policy on all tables
```

**CMO Tables (Template):**
- `cmo_brand_profiles`, `cmo_icp_segments`, `cmo_offers`
- `cmo_marketing_plans`, `cmo_funnels`, `cmo_funnel_stages`
- `cmo_campaigns`, `cmo_campaign_channels`, `cmo_content_assets`
- `cmo_content_variants`, `cmo_metrics_snapshots`, `cmo_recommendations`
- `cmo_calendar_events`, `cmo_weekly_summaries`

**CRO Tables (To Create):**
- `cro_experiments`, `cro_variants`, `cro_hypotheses`
- `cro_metrics`, `cro_segments`, `cro_recommendations`

**CFO Tables (To Create):**
- `cfo_budgets`, `cfo_forecasts`, `cfo_transactions`
- `cfo_reports`, `cfo_metrics`, `cfo_recommendations`

**COO Tables (To Create):**
- `coo_workflows`, `coo_processes`, `coo_tasks`
- `coo_metrics`, `coo_reports`, `coo_recommendations`

### 2. Module Manifest

Each module has a manifest at `registry/modules/{module_id}.manifest.json`:

```json
{
  "id": "ai_{role}",
  "name": "AI {ROLE} Module",
  "version": "2.0.0",
  "entry_agent": "{ROLE} Orchestrator",
  "orchestrator_prompt": "/agents/{role}/orchestrator.system.prompt.txt",
  "modes": ["setup", "strategy", ...],
  "requires": ["supabase", "kernel", "ai_gateway"],
  "docs": ["/knowledge/{role}/backend_requirements.md", ...],
  "schemas": ["{role}_*"],
  "ui": { "basePath": "/{role}", "primaryScreens": [...] },
  "permissions": { "tenant": true, "role": ["admin", "..."] },
  "agents": { ... }
}
```

### 3. Agent Structure

Each module has agents in `agents/{role}/`:

```
agents/{role}/
├── orchestrator.prompt.txt        # High-level orchestrator
├── orchestrator.system.prompt.txt # Detailed system prompt
├── setup/                         # Setup/intake agents
├── strategy/                      # Strategy planning agents
├── {mode}/                        # Mode-specific agents
└── analytics/                     # Analytics/optimization agents
```

### 4. Edge Functions

Each module has edge functions prefixed with `{role}-`:

```
supabase/functions/{role}-kernel/       # Router/orchestrator
supabase/functions/{role}-{agent}/      # Agent functions
supabase/functions/{role}-cron-*/       # Scheduled tasks
```

### 5. Kernel Integration

All modules use a shared kernel interface:

```typescript
import { runKernel } from '@/kernel';

// Unified call pattern
const result = await runKernel({
  module: 'ai_cmo',  // or 'ai_cro', 'ai_cfo', 'ai_coo'
  mode: 'strategy',
  tenant_id: 'uuid',
  workspace_id: 'uuid',
  payload: { ... }
});
```

## Shared Components

### Kernel Core (`kernel/core/`)
- Module registration
- Agent routing
- Prompt resolution

### Shared Helpers (`supabase/functions/_shared/`)
- Rate limiting
- Authentication
- Webhook verification
- Tenant validation

### UI Components (`src/components/{role}/shared/`)
- AgentConsole
- AgentHistory
- ResourceTable
- TenantHeader

## Tenant Isolation

**All modules MUST:**
1. Include `tenant_id` on every table
2. Use RLS with `tenant_isolation` policy
3. Validate `tenant_id` in every edge function
4. Log all agent runs to `agent_runs` table

```sql
-- Standard RLS policy for all exec module tables
CREATE POLICY "tenant_isolation" ON {prefix}_{table}
FOR ALL USING (
  tenant_id = auth.uid() OR 
  tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid())
);
```

## Agent Runs Logging

All agent executions are logged to `agent_runs`:

```typescript
await supabase.from('agent_runs').insert({
  tenant_id,
  workspace_id,
  agent: '{role}-{agent-name}',
  mode: '{mode}',
  status: 'running',
  input: payload,
  created_at: new Date().toISOString()
});
```

## Module Lifecycle

1. **Registration**: Module manifest registered via `registerModule()`
2. **Discovery**: Kernel discovers available modules via `getAllModules()`
3. **Routing**: Requests routed via `runKernel()` to correct agent
4. **Execution**: Agent function executes with tenant context
5. **Logging**: Results logged to `agent_runs`
6. **Response**: Structured response returned to frontend

## Adding a New Module

1. Create manifest: `registry/modules/ai_{role}.manifest.json`
2. Create prompts: `agents/{role}/*.prompt.txt`
3. Create tables: `{role}_*` with RLS
4. Create edge functions: `{role}-*`
5. Register module: Add to `kernel/modules/index.ts`
6. Create UI: `src/pages/{Role}Dashboard.tsx`

## Security Requirements

- ✅ Tenant isolation via RLS
- ✅ JWT validation in all edge functions
- ✅ Rate limiting per endpoint
- ✅ HMAC webhook verification
- ✅ Service role only for cron/internal
- ✅ Agent run audit logging
