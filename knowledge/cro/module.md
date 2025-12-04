# AI CRO Module

> Chief Revenue Officer - AI-powered revenue operations, forecasting, deal reviews, and pipeline optimization.

## Purpose

The CRO module transforms revenue operations from spreadsheet chaos into AI-driven precision. It wraps existing CRM data (leads, deals) with intelligent forecasting, deal health scoring, and actionable revenue recommendations.

## Core Modes

| Mode | Agent | Function | Description |
|------|-------|----------|-------------|
| `setup` | Pipeline Architect | `cro-pipeline-intake` | Map pipeline stages, products, territories |
| `forecast` | Forecast Planner | `cro-forecast-planner` | Build commit/base/stretch forecasts |
| `deal_review` | Deal Reviewer | `cro-deal-review` | Analyze deal health with risk scoring |
| `optimization` | Revenue Optimizer | `cro-revenue-moves` | Generate prioritized revenue actions |

## Database Tables

### Core Entities
- `cro_targets` - Quota/targets by period and owner (rep, team, global)
- `cro_forecasts` - Revenue forecasts by scenario (commit, base, stretch)

### Analysis
- `cro_deal_reviews` - AI deal analysis with scores, risks, next steps
- `cro_recommendations` - Prioritized revenue actions

### Related (from CRM)
- `deals` - Core deal/opportunity data
- `leads` - Lead pipeline data
- `lead_activities` - Touchpoint history

## Agent Prompts

```
agents/cro/
├── orchestrator.system.prompt.txt    # Central routing
├── setup/
│   └── pipelineIntake.prompt.txt     # Pipeline mapping
├── forecast/
│   └── forecastPlanner.prompt.txt    # Forecast generation
├── deals/
│   └── dealReview.prompt.txt         # Deal health analysis
└── optimization/
    └── revenueMoves.prompt.txt       # Revenue acceleration
```

## Prompt Highlights

### Pipeline Intake
- Maps existing stages, products, territories
- Calculates baseline win rates and cycle times
- Identifies strongest sources and bottleneck stages

### Forecast Planner
- **Commit**: Deals >70% probability in period
- **Base**: Commit + 50% of 40-70% deals
- **Stretch**: Base + upside from <40% + new pipeline
- Tracks weekly milestones and risks

### Deal Review (Scoring Rubric)
| Factor | Points | Criteria |
|--------|--------|----------|
| Activity Recency | 25 | <7d = 25, <14d = 15, <30d = 5 |
| Stage Progression | 25 | On pace = 25, 1 behind = 15 |
| Stakeholder Access | 25 | Econ buyer = 25, champion only = 15 |
| Competitive Position | 25 | Single vendor = 25, preferred = 15 |

### Revenue Moves (Priority Types)
1. `close_now` - Deals at negotiation, close this period
2. `accelerate` - High-value deals to pull forward
3. `rescue` - Stalled deals worth saving
4. `expand` - Existing customers with expansion potential
5. `prospect` - New pipeline for future periods

## Edge Functions

| Function | Purpose |
|----------|---------|
| `cro-kernel` | Central router for CRO operations |
| `cro-pipeline-intake` | Process pipeline setup |
| `cro-forecast-planner` | Generate forecasts |
| `cro-deal-review` | Analyze individual deals |
| `cro-revenue-moves` | Generate revenue recommendations |

## UI Screens

| Route | Component | Purpose |
|-------|-----------|---------|
| `/cro` | CRODashboard | Revenue snapshot, pipeline, top recommendations |
| `/cro/forecast` | CROForecast | Targets vs forecasts with charts |
| `/cro/pipeline` | CROPipeline | Deal list by stage with risk flags |
| `/cro/deals/:id` | CRODealDetail | Deal review + AI next steps |
| `/cro/recommendations` | CRORecommendations | Action queue with status workflow |

## Workflow Sequence

```
1. Setup (Pipeline Intake)
   └─> Pipeline config: stages, products, territories, baselines

2. Forecast (Planning)
   └─> Commit/Base/Stretch forecasts + targets

3. Deal Review (Analysis)
   └─> Health scores + risks + next steps per deal

4. Optimization (Revenue Moves)
   └─> Prioritized actions to close gap
```

## Key Metrics

- **Pipeline Coverage**: Open Pipeline / Target (healthy: 3-5x)
- **Weighted Pipeline**: Σ(deal_value × probability)
- **Win Rate**: Closed Won / Total Closed
- **Cycle Time**: Average days from creation to close
- **Deal Health Score**: 0-100 based on rubric

## Tenant Isolation

All tables enforce RLS with `tenant_isolation` policy:
```sql
(tenant_id = auth.uid() OR tenant_id IN (
  SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()
))
```

## Integration Points

- **CRM**: Direct access to `deals`, `leads`, `lead_activities`
- **CMO**: Campaign attribution to pipeline
- **CFO**: Revenue forecasts feed financial planning
