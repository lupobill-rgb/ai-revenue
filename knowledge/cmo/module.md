# AI CMO Module

> Chief Marketing Officer - AI-powered marketing automation, funnel design, and campaign optimization.

## Purpose

The CMO module transforms marketing strategy from manual planning into AI-orchestrated execution. It handles the complete marketing lifecycle: brand definition → strategy planning → funnel architecture → campaign design → content generation → performance optimization.

## Core Modes

| Mode | Agent | Function | Description |
|------|-------|----------|-------------|
| `setup` | Brand & ICP Architect | `cmo-brand-intake` | Capture brand identity, ICP segments, and offers |
| `strategy` | Strategy Planner | `cmo-plan-90day` | Generate 90-day marketing plans with milestones |
| `funnels` | Funnel Architect | `cmo-funnel-architect` | Design funnel stages with KPIs and campaigns |
| `campaigns` | Campaign Designer | `cmo-campaign-designer` | Create multi-channel campaign blueprints |
| `content` | Content Engine | `cmo-content-engine` | Generate brand-consistent assets with A/B variants |
| `optimization` | Optimization Analyst | `cmo-optimization-analyst` | Analyze performance and recommend improvements |

## Database Tables

### Core Entities
- `cmo_brand_profiles` - Brand identity, voice, positioning
- `cmo_icp_segments` - Ideal customer profiles with pain points, goals, objections
- `cmo_offers` - Products/services with benefits and pricing

### Strategy & Planning
- `cmo_marketing_plans` - 90-day plans with monthly breakdowns
- `cmo_funnels` - Funnel definitions and conversion targets
- `cmo_funnel_stages` - Individual stages with KPIs and campaigns

### Execution
- `cmo_campaigns` - Campaign blueprints with objectives and channels
- `cmo_campaign_channels` - Channel-specific settings and budgets
- `cmo_content_assets` - Generated marketing assets
- `cmo_content_variants` - A/B test variants

### Analytics
- `cmo_metrics_snapshots` - Performance data by campaign/channel
- `cmo_weekly_summaries` - AI-generated weekly reports
- `cmo_recommendations` - Optimization suggestions
- `cmo_calendar_events` - Content calendar events

## Agent Prompts

```
agents/cmo/
├── orchestrator.prompt.txt           # High-level routing
├── orchestrator.system.prompt.txt    # Detailed system prompt
├── setup/
│   └── brandIntake.prompt.txt        # Brand & ICP intake
├── strategy/
│   └── plan90d.prompt.txt            # 90-day planning
├── funnels/
│   └── funnelArchitect.prompt.txt    # Funnel design
├── campaigns/
│   └── campaignDesigner.prompt.txt   # Campaign blueprints
├── content/
│   └── contentEngine.prompt.txt      # Asset generation
└── analytics/
    └── optimizationAnalyst.prompt.txt # Performance analysis
```

## Edge Functions

| Function | Purpose |
|----------|---------|
| `cmo-kernel` | Central router for all CMO operations |
| `cmo-brand-intake` | Process brand setup conversations |
| `cmo-plan-90day` | Generate marketing plans |
| `cmo-funnel-architect` | Design funnel structures |
| `cmo-campaign-designer` | Create campaign blueprints |
| `cmo-content-engine` | Generate marketing content |
| `cmo-optimization-analyst` | Analyze and recommend |
| `cmo-generate-funnel` | CRUD for funnels |
| `cmo-launch-campaign` | CRUD for campaigns |
| `cmo-create-plan` | CRUD for plans |
| `cmo-record-metrics` | Ingest performance data |
| `cmo-summarize-weekly` | Generate weekly summaries |
| `cmo-cron-weekly` | Scheduled weekly reports |

## UI Screens

| Route | Component | Purpose |
|-------|-----------|---------|
| `/cmo` | CMODashboard | Overview with metrics and quick actions |
| `/cmo/setup` | CMOBrandIntake | Brand intake wizard |
| `/cmo/plan` | CMO90DayPlanner | Plan generation and viewing |
| `/cmo/funnels` | CMOFunnelArchitect | Funnel design interface |
| `/cmo/campaigns` | CMOCampaigns | Campaign management |
| `/cmo/content` | CMOContent | Content asset library |
| `/cmo/calendar` | CMOCalendar | Content calendar |
| `/cmo/analytics` | CMOAnalytics | Performance dashboard |

## Workflow Sequence

```
1. Setup (Brand Intake)
   └─> Brand profile, ICP segments, offers created

2. Strategy (90-Day Plan)
   └─> Marketing plan with milestones and KPIs

3. Funnels (Architecture)
   └─> Funnel stages linked to plan

4. Campaigns (Design)
   └─> Campaign blueprints per funnel stage

5. Content (Generation)
   └─> Assets with A/B variants per campaign

6. Optimization (Analysis)
   └─> Recommendations based on metrics
```

## Tenant Isolation

All tables enforce RLS with `tenant_isolation` policy:
```sql
(tenant_id = auth.uid() OR tenant_id IN (
  SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()
))
```

## Integration Points

- **CRM**: Leads flow from CMO campaigns to CRM pipeline
- **CRO**: Campaign performance informs revenue forecasts
- **Storage**: Assets stored in `cmo-assets` bucket
- **AI Gateway**: All generation uses Lovable AI models
