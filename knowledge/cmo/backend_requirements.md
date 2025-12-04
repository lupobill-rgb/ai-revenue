# AI CMO – Backend Requirements (v2)

## Stack
- Supabase (Postgres + Edge Functions)
- TypeScript
- Auth: Supabase Auth with tenant_id
- RLS: Enabled on all cmo_* tables
- Logging: agent_runs with tenant_id, agent, mode, input, output

## Tables
- cmo_brand_profiles
- cmo_icp_segments
- cmo_offers
- cmo_plans_90d
- cmo_plan_milestones
- cmo_funnels
- cmo_funnel_stages
- cmo_campaigns
- cmo_campaign_channels
- cmo_content_assets
- cmo_content_variants
- cmo_calendar_events
- cmo_metrics_snapshots
- cmo_weekly_summaries
- cmo_recommendations

## Functions / Endpoints
- create_plan_90d(plan_json)
- generate_funnel(plan_id)
- launch_campaign(campaign_json)
- generate_content(campaign_id)
- record_metrics(snapshot_json)
- summarize_performance(tenant_id)

## Edge Functions
| Function | Purpose |
|----------|---------|
| `cmo-kernel` | Routes mode → agent function |
| `cmo-brand-intake` | Conversational brand setup |
| `cmo-plan-90day` | 90-day plan generation |
| `cmo-funnel-architect` | Funnel stage design |
| `cmo-campaign-designer` | Campaign blueprint creation |
| `cmo-content-engine` | Content asset generation |
| `cmo-optimization-analyst` | Performance recommendations |
| `cmo-create-plan` | Persists plan to DB |
| `cmo-generate-funnel` | Creates funnel from plan |
| `cmo-launch-campaign` | Activates campaign |
| `cmo-generate-content` | Generates content pieces |
| `cmo-record-metrics` | Records metric snapshots |
| `cmo-summarize-weekly` | Weekly performance summary |
| `cmo-webhook-outbound` | External webhook delivery |
| `cmo-cron-weekly` | Scheduled weekly tasks |

## Security
- All queries scoped by workspace_id
- RLS policies use tenant_isolation or user_has_workspace_access()
- JWT validation on all requests
- Service role reserved for internal/cron only

## AI Gateway
- Endpoint: `https://ai.gateway.lovable.dev/v1/chat/completions`
- Model: `google/gemini-2.5-flash`
- Auth: `Bearer ${LOVABLE_API_KEY}`
- Streaming: enabled

## Error Handling
- 429 → Rate limit exceeded
- 402 → Payment required
- 500 → Log and return generic error
