# CMO Execution Loop

The CMO module runs an automated daily execution loop that keeps campaigns optimizing without manual intervention.

## Architecture

```
pg_cron (Supabase)
       │
       ▼
cmo-optimizer-cron (edge function)
       │
       ├── For each tenant with autopilot campaigns:
       │   │
       │   ▼
       │   cmo-orchestrator (action: optimize_all_autopilot_campaigns)
       │   │
       │   ├── Aggregate CRM + analytics metrics
       │   │
       │   ▼
       │   cmo-optimizer (per campaign)
       │   │
       │   ├── Analyze performance
       │   ├── Generate recommendations
       │   └── Apply approved changes
       │
       └── Log to agent_runs for audit trail
```

## Execution Modes

### 1. `optimize` (Default)
Runs optimizer on all autopilot-enabled campaigns:
- Aggregates metrics from `campaign_channel_stats_daily`
- Calls optimizer for each campaign
- Applies changes if autopilot is enabled
- Updates `last_optimization_at` on campaigns

### 2. `full` (Daily Loop)
Complete daily execution including:
- Campaign optimization
- Stale content detection (14+ days old)
- Underperforming campaign alerts (< 1% reply rate)
- Logging to `agent_runs`

### 3. `summarize` (Weekly)
Generates weekly performance summaries:
- Calls `cmo-summarize-weekly` for each tenant
- Creates summary reports

## Setting Up pg_cron

### Prerequisites
1. Enable `pg_cron` extension in Supabase
2. Enable `pg_net` extension for HTTP calls

### Daily Optimization (6 AM UTC)
```sql
SELECT cron.schedule(
  'cmo-daily-optimization',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://nyzgsizvtqhafoxixyrd.supabase.co/functions/v1/cmo-optimizer-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'INTERNAL_FUNCTION_SECRET' LIMIT 1)
    ),
    body := '{"cron": true, "mode": "optimize"}'::jsonb
  );
  $$
);
```

### Full Daily Loop (6 AM UTC)
```sql
SELECT cron.schedule(
  'cmo-daily-loop',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://nyzgsizvtqhafoxixyrd.supabase.co/functions/v1/cmo-optimizer-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'INTERNAL_FUNCTION_SECRET' LIMIT 1)
    ),
    body := '{"cron": true, "mode": "full"}'::jsonb
  );
  $$
);
```

### Weekly Summary (Monday 9 AM UTC)
```sql
SELECT cron.schedule(
  'cmo-weekly-summary',
  '0 9 * * 1',
  $$
  SELECT net.http_post(
    url := 'https://nyzgsizvtqhafoxixyrd.supabase.co/functions/v1/cmo-cron-weekly',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'INTERNAL_FUNCTION_SECRET' LIMIT 1)
    ),
    body := '{"cron": true}'::jsonb
  );
  $$
);
```

## What the Loop Does

### Campaign Optimization
For each campaign with `autopilot_enabled = true`:

1. **Aggregate Metrics**
   - Pulls from `campaign_channel_stats_daily`
   - Sums sends, opens, clicks, replies, meetings
   - Falls back to `campaign_metrics` if no daily stats

2. **Call Optimizer Agent**
   - Passes campaign goal (leads/meetings/revenue)
   - Includes current content assets
   - Respects constraints (brand voice, budget)

3. **Apply Changes**
   - Updates email subjects/bodies
   - Adjusts SMS copy
   - Modifies voice scripts
   - Changes wait/delay times
   - Kills underperforming variants

4. **Log Results**
   - Records to `campaign_optimizations` table
   - Updates `cmo_campaigns.last_optimization_at`
   - Logs run to `agent_runs`

### Daily Loop Additions
- **Stale Content Detection**: Flags assets not updated in 14+ days
- **Underperforming Alerts**: Campaigns with 50+ sends but < 1% reply rate
- **Audit Logging**: Complete run log to `agent_runs`

## Autopilot Flag

The `cmo_campaigns.autopilot_enabled` flag controls behavior:

| autopilot_enabled | Behavior |
|-------------------|----------|
| `true` | Optimizer applies changes automatically |
| `false` | Optimizer only suggests, no auto-apply |

## Monitoring

### Check Cron Jobs
```sql
SELECT * FROM cron.job ORDER BY jobid DESC;
```

### View Recent Runs
```sql
SELECT * FROM cron.job_run_details ORDER BY runid DESC LIMIT 20;
```

### Check Agent Runs
```sql
SELECT * FROM agent_runs 
WHERE agent = 'cmo_orchestrator_cron' 
ORDER BY created_at DESC 
LIMIT 10;
```

## Edge Function Endpoints

| Function | Purpose | JWT Required |
|----------|---------|--------------|
| `cmo-optimizer-cron` | Cron entrypoint for optimization | No (internal secret) |
| `cmo-orchestrator` | Main orchestration hub | Yes (or internal) |
| `cmo-optimizer` | Campaign optimization agent | No (or internal) |
| `cmo-cron-weekly` | Weekly summary generation | No (internal secret) |
| `cmo-summarize-weekly` | Per-tenant summary | Yes |

## Security

- All cron functions require `x-internal-secret` header
- Secret stored in Supabase Vault as `INTERNAL_FUNCTION_SECRET`
- Service role key used for database operations in cron context
- Tenant isolation maintained via `tenant_id` filtering
