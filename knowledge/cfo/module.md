# AI CFO Module

> Chief Financial Officer - AI-powered budgeting, forecasting, and financial reporting.

## Purpose

The CFO module provides AI-assisted financial operations for marketing and revenue teams. It tracks budgets, generates forecasts, and produces executive-ready financial reports—without requiring a finance background.

## Core Modes

| Mode | Agent | Function | Description |
|------|-------|----------|-------------|
| `setup` | Finance Architect | `cfo-setup` | Configure accounts, cost centers, fiscal periods |
| `budgeting` | Budget Planner | `cfo-budget-planner` | Create and manage budgets by department/project |
| `forecasting` | Financial Forecaster | `cfo-forecaster` | Project revenue, costs, and cash flow |
| `reporting` | Financial Reporter | `cfo-reporter` | Generate P&L, variance, and executive reports |

## Database Tables (Planned)

### Core Entities
- `cfo_accounts` - Chart of accounts (revenue, expense, asset categories)
- `cfo_cost_centers` - Departments, projects, campaigns
- `cfo_fiscal_periods` - Months, quarters, years

### Budgeting
- `cfo_budgets` - Budget allocations by period and cost center
- `cfo_budget_items` - Line-item details
- `cfo_actuals` - Actual spend tracking

### Forecasting
- `cfo_forecasts` - Revenue/expense projections
- `cfo_scenarios` - Best/base/worst case models
- `cfo_assumptions` - Forecast drivers and assumptions

### Reporting
- `cfo_reports` - Generated financial reports
- `cfo_metrics` - KPIs (burn rate, runway, ROI)
- `cfo_recommendations` - AI financial insights

## Agent Prompts (Planned)

```
agents/cfo/
├── orchestrator.system.prompt.txt    # Central routing
├── setup/
│   └── financeIntake.prompt.txt      # Account setup
├── budgeting/
│   └── budgetPlanner.prompt.txt      # Budget creation
├── forecasting/
│   └── forecaster.prompt.txt         # Financial projections
└── reporting/
    └── reporter.prompt.txt           # Report generation
```

## Key Capabilities

### Budget Management
- Department/campaign budget allocation
- Real-time spend tracking vs budget
- Variance alerts and recommendations
- Budget reallocation suggestions

### Financial Forecasting
- Revenue projections from CRO data
- Cost forecasting from CMO spend
- Cash flow modeling
- Scenario planning (optimistic/pessimistic)

### Executive Reporting
- Automated P&L statements
- Budget vs actual variance reports
- Marketing ROI analysis
- Runway and burn rate tracking

## UI Screens (Planned)

| Route | Component | Purpose |
|-------|-----------|---------|
| `/cfo` | CFODashboard | Financial health overview |
| `/cfo/budgets` | CFOBudgets | Budget management |
| `/cfo/forecasts` | CFOForecasts | Financial projections |
| `/cfo/reports` | CFOReports | Generated reports |

## Integration Points

- **CMO**: Marketing spend actuals, campaign ROI
- **CRO**: Revenue forecasts and actuals
- **OS**: Workspace-level financial aggregation

## Status

**Module Status**: Planned (manifest registered, schema pending)

Next steps:
1. Create database schema migration
2. Implement agent prompts
3. Build edge functions
4. Create UI screens
