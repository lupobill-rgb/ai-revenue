# UbiGrowth AI - Product Documentation

## Overview

UbiGrowth AI is an enterprise-grade, AI-powered marketing automation platform that transforms how businesses execute marketing campaigns. The platform combines autonomous AI agents with multi-channel orchestration to deliver fully automated campaign management at scale.

---

## Table of Contents

1. [Platform Architecture](#platform-architecture)
2. [Core Modules](#core-modules)
3. [AI CMO Module](#ai-cmo-module)
4. [Outbound OS](#outbound-os)
5. [CRM System](#crm-system)
6. [Voice Agent System](#voice-agent-system)
7. [Landing Pages](#landing-pages)
8. [Settings & Integrations](#settings--integrations)
9. [Multi-Tenant Architecture](#multi-tenant-architecture)
10. [Security](#security)

---

## Platform Architecture

### Technology Stack
- **Frontend**: React, TypeScript, Tailwind CSS, Vite
- **Backend**: Supabase (PostgreSQL, Edge Functions, Auth, Storage)
- **AI Engine**: Lovable AI (Google Gemini, OpenAI GPT models)
- **Voice**: VAPI, ElevenLabs integration
- **Email**: Resend API

### Kernel System
The platform uses a centralized kernel architecture for AI agent orchestration:

```
kernel/
├── agents/           # AI agent configurations
├── core/            # Core kernel functions
├── health/          # Module health monitoring
├── launch/          # Module toggle system
├── modules/         # Module definitions
└── types.ts         # Type definitions
```

All AI operations route through `runKernel()` which:
- Validates tenant isolation
- Logs all agent executions to `agent_runs` table
- Enforces security guardrails
- Returns structured JSON responses

---

## Core Modules

### Module Registry
Each module is registered via manifest files in `/registry/modules/`:

| Module | ID | Description |
|--------|-----|-------------|
| AI CMO | `ai_cmo` | Marketing automation & campaign management |
| AI CRO | `ai_cro` | Revenue operations & forecasting |
| AI CFO | `ai_cfo` | Financial operations (planned) |
| AI COO | `ai_coo` | Operations management (planned) |

### Module Feature Toggles
Modules can be enabled/disabled per tenant via `tenant_module_access` table.

---

## AI CMO Module

The AI CMO is the flagship module providing end-to-end marketing automation.

### Six Sequential Capabilities

#### 1. Brand & ICP Intake (`cmo-brand-intake`)
- Captures brand profiles through conversational AI interview
- Defines Ideal Customer Profile (ICP) segments
- Stores offers and value propositions

**Database Tables:**
- `cmo_brand_profiles` - Brand identity, voice, positioning
- `cmo_icp_segments` - Target customer profiles
- `cmo_offers` - Products/services definitions

#### 2. 90-Day Marketing Plan (`cmo-plan-90day`)
- Generates structured quarterly marketing plans
- Defines milestones and KPIs
- Creates month-by-month action items

**Database Table:** `cmo_marketing_plans`

#### 3. Funnel Architect (`cmo-funnel-architect`)
- Designs funnel stages (Awareness → Consideration → Conversion)
- Aligns funnels with business goals
- Defines stage-specific KPIs

**Database Tables:**
- `cmo_funnels` - Funnel definitions
- `cmo_funnel_stages` - Individual stage configurations

#### 4. Campaign Designer (`cmo-campaign-designer`)
- Transforms funnels into multi-channel campaigns
- Allocates budgets across channels
- Sets success criteria and metrics

**Database Tables:**
- `cmo_campaigns` - Campaign configurations
- `cmo_campaign_channels` - Channel-specific settings

#### 5. Content Engine (`cmo-content-engine`)
- Generates brand-consistent content assets
- Creates A/B test variants
- Supports all channels (email, social, ads, landing pages)

**Database Tables:**
- `cmo_content_assets` - Content pieces
- `cmo_content_variants` - A/B test versions

#### 6. Optimization Analyst (`cmo-optimization-analyst`)
- Analyzes campaign performance
- Identifies underperforming areas
- Generates actionable recommendations

**Database Tables:**
- `cmo_recommendations` - AI-generated suggestions
- `cmo_metrics_snapshots` - Performance data
- `campaign_optimizations` - Applied optimizations

### Autopilot Mode
Campaigns can run in autopilot mode where the AI:
- Continuously monitors performance
- Automatically applies optimizations
- Adjusts budgets and targeting
- Updates content based on results

Enable via campaign card toggle: `autopilot_enabled = true`

### Core Kernel Agents

| Agent | Purpose |
|-------|---------|
| `cmo_campaign_builder` | Generates complete multi-channel campaigns |
| `cmo_voice_agent_builder` | Creates voice agent configurations |
| `cmo_optimizer` | Analyzes and optimizes campaigns |

---

## Outbound OS

Multi-channel B2B outbound automation system.

### Components

#### 1. Prospect Intelligence Agent
- Analyzes prospects for buying intent (0-100 score)
- Identifies intent bands: cold/warm/hot
- Extracts pain points and messaging angles

**Edge Function:** `outbound-prospect-intel`

#### 2. Message Generation Agent
- Creates personalized, step-specific messages
- Supports multiple channels (LinkedIn, Email)
- Uses prospect insights and brand voice

**Edge Function:** `outbound-message-gen`

#### 3. Cadence/Timing Agent
- Calculates optimal send times
- Respects business hours and daily limits
- Applies jitter to avoid pattern detection

**Edge Function:** `outbound-cadence-timing`

### Database Schema

```sql
-- Core tables
prospects              -- Prospect profiles
prospect_signals       -- Behavioral signals
prospect_scores        -- Intent scoring
outbound_campaigns     -- Campaign definitions
outbound_sequences     -- Message sequences
outbound_sequence_steps -- Individual steps
outbound_sequence_runs -- Execution tracking
outbound_message_events -- Send/reply events
linkedin_tasks         -- Human-in-the-loop queue
```

### Channel Dispatch

| Channel | Behavior |
|---------|----------|
| Email | Auto-sent via Resend API |
| LinkedIn | Queued for human-in-the-loop (TOS compliance) |

### LinkedIn Queue
LinkedIn messages are NOT auto-sent (TOS violation). Instead:
1. Messages queue to `linkedin_tasks` table
2. SDRs access LinkedIn Queue UI
3. Copy personalized message to clipboard
4. Open prospect profile in LinkedIn
5. Mark as sent after manual posting

### Orchestration Rules
Stored in `outbound_campaigns.config`:
- `max_daily_sends_email` - Email daily cap
- `max_daily_sends_linkedin` - LinkedIn daily cap
- `business_hours_only` - Restrict to 8am-6pm
- `timezone` - Tenant timezone
- `linkedin_delivery_mode` - Queue vs auto

---

## CRM System

Unified customer relationship management.

### CRM Spine (Single Source of Truth)

```sql
crm_contacts  -- Contact records (deduplicated by email)
crm_leads     -- Lead records tied to campaigns
crm_activities -- Immutable activity timeline
```

### Centralized Contact/Lead Creation
All channels use single RPC function:
```sql
crm_upsert_contact_and_lead(
  tenant_id, email, phone, first_name, last_name,
  company_name, role_title, campaign_id, source
)
```

This ensures:
- Unified deduplication
- Consistent normalization
- No scattered create/update logic

### Activity Types

| Type | Description |
|------|-------------|
| `landing_form_submit` | Form submission |
| `email_sent` | Outbound email |
| `email_open` | Email opened |
| `email_reply` | Email replied |
| `sms_sent` | SMS sent |
| `sms_reply` | SMS reply received |
| `voice_call` | Voice call made |
| `meeting_booked` | Calendar booking |
| `status_change` | Lead status update |

### Lead Scoring
AI-powered lead scoring via `auto-score-lead` edge function:
- Profile completeness criteria
- Engagement signals (opens, clicks, calls)
- Recency of activity
- Returns score 0-100 with grade (A-F)

### Lead Nurturing
AI-powered nurturing sequences via `ai-lead-nurturing`:
- Analyzes engagement patterns
- Generates personalized email sequences
- Executes automated follow-ups

---

## Voice Agent System

AI-powered voice calling capabilities.

### Integration Stack
- **VAPI**: Voice agent orchestration
- **ElevenLabs**: Text-to-speech voices

### Voice Agent Builder Agent
Generates complete voice agent configurations:
- System prompts
- Voice profiles
- Tools and integrations
- Objection handlers
- Qualification questions
- Compliance disclosures

### Voice Campaign Execution
1. Campaign triggers voice step in automation
2. System calls VAPI with agent configuration
3. VAPI places outbound call
4. Conversation logged to `crm_activities`
5. Call outcome updates lead status

### Voice Settings
Configured in Settings → Integrations → Voice:
- VAPI public/private keys
- ElevenLabs API key
- Default assistant selection
- Default voice ID and model

---

## Landing Pages

Agent-built, customer-owned landing pages.

### Template Types

| Type | Use Case |
|------|----------|
| `saas` | Software product positioning |
| `lead_magnet` | Content upgrade capture |
| `webinar` | Event registration |
| `services` | Professional services |
| `booking` | Calendar integration CTA |
| `long_form` | Educational content |

### Agent-First Paradigm
- Campaign Builder always generates landing pages
- Users edit only key text (headline, CTA)
- Users cannot change structure/wiring
- "Rebuild with AI" for regeneration
- Form wiring to CRM is automatic

### Form Submission Flow
```
POST landing-form-submit
  → Validate tenant/landing page
  → crm_upsert_contact_and_lead()
  → Log crm_activities entry
  → Trigger automation via kernel
```

---

## Settings & Integrations

### Integration Settings Tables

| Table | Purpose |
|-------|---------|
| `ai_settings_email` | Email sender configuration |
| `ai_settings_linkedin` | LinkedIn limits and profile |
| `ai_settings_calendar` | Calendar/booking setup |
| `ai_settings_crm_webhooks` | CRM webhook URLs |
| `ai_settings_domain` | Custom domain configuration |
| `ai_settings_voice` | VAPI/ElevenLabs credentials |

### Settings UI Tabs
Access via Settings → Integrations:

1. **Email** - Sender name, from/reply-to addresses, SMTP config
2. **LinkedIn** - Profile URL, daily connection/message limits
3. **Calendar** - Provider selection, booking URL
4. **CRM Webhooks** - Inbound/outbound webhook URLs
5. **Custom Domain** - Domain and CNAME verification
6. **Voice** - VAPI/ElevenLabs API keys and defaults

### Audit Trail
All integration changes logged to `integration_audit_log`:
- User attribution
- Field-level diffs
- Timestamps
- Change history visible in UI

---

## Multi-Tenant Architecture

### Strict Tenant Isolation
- Every row includes `tenant_id` column
- RLS policies enforce `tenant_id` matching
- `user_tenants` table maps users to tenants
- Cross-tenant data access is impossible

### Workspace Management
- Workspaces contain multiple users
- Users can belong to multiple workspaces
- Roles: Owner, Admin, Member, Viewer

### Team Management
- Invite team members via Settings → Team
- Role-based permissions
- Password change enforcement on first login
- Invitation tracking via `team_invitations`

---

## Security

### Authentication
- Supabase Auth with email/password
- Auto-confirm email signups enabled
- Force password change for new team members
- Session-based authentication

### Row Level Security (RLS)
All tenant-scoped tables enforce RLS:
```sql
CREATE POLICY "tenant_isolation" ON table_name
FOR ALL USING (
  tenant_id = auth.uid() OR
  tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid())
);
```

### Webhook Security
- **Custom webhooks**: HMAC-SHA256 with `x-ubigrowth-signature`
- **Resend webhooks**: Svix verification with `svix-signature`
- Timestamp tolerance: 5 minutes
- Fail-closed on verification failure

### Rate Limiting
PostgreSQL-based windowed counters:
- Per-endpoint limits
- Per-tenant/user scoping
- Three tiers: per-minute, per-hour, per-day

### Internal Function Protection
- `x-internal-secret` header for cron/internal functions
- Service role key reserved for internal use only
- Basic Auth for admin endpoints

### Secrets Management
Environment variables for sensitive data:
- `RESEND_API_KEY`
- `RESEND_WEBHOOK_SECRET`
- `VAPI_PRIVATE_KEY`
- `INTERNAL_FUNCTION_SECRET`

---

## API Reference

### Edge Functions

| Function | Purpose |
|----------|---------|
| `cmo-kernel` | Central CMO orchestration router |
| `cmo-brand-intake` | Brand profile setup |
| `cmo-plan-90day` | Marketing plan generation |
| `cmo-funnel-architect` | Funnel design |
| `cmo-campaign-designer` | Campaign creation |
| `cmo-content-engine` | Content generation |
| `cmo-optimization-analyst` | Performance analysis |
| `cmo-optimizer` | Campaign optimization |
| `outbound-prospect-intel` | Prospect intelligence |
| `outbound-message-gen` | Message generation |
| `outbound-cadence-timing` | Send timing calculation |
| `dispatch-outbound-sequences` | Sequence dispatcher |
| `landing-form-submit` | Form submission handler |
| `lead-capture` | Lead capture endpoint |
| `execute-voice-campaign` | Voice call execution |
| `auto-score-lead` | Lead scoring |
| `ai-lead-nurturing` | Nurturing sequences |

### Kernel Invocation
```typescript
import { runKernel } from '@/kernel';

const result = await runKernel({
  module: 'ai_cmo',
  mode: 'campaigns',
  tenant_id: 'uuid',
  workspace_id: 'uuid',
  input: { /* mode-specific params */ }
});
```

---

## UI Navigation

### Main Navigation
- **Dashboard** - Overview metrics and quick actions
- **CRM** - Lead management and pipeline
- **Outbound** - Multi-channel outbound campaigns
- **Reports** - Analytics and performance
- **Settings** - Configuration and integrations

### CRM Tabs
- Leads Pipeline
- Deals
- Tasks
- Email Sequences
- Automations
- Reports

### Settings Tabs
- Profile
- Business Profile
- Team
- Integrations
- Modules

---

## Getting Started

### For New Tenants
1. Complete Brand & ICP Intake
2. Generate 90-Day Marketing Plan
3. Design Marketing Funnels
4. Create Campaigns (manual or autopilot)
5. Configure integrations (email, voice, etc.)
6. Launch campaigns

### For Team Members
1. Accept invitation email
2. Change password on first login
3. Access workspace based on assigned role
4. Start using platform features

---

## Support

For technical issues or questions:
- Review this documentation
- Check the Security Architecture doc: `/docs/SECURITY_ARCHITECTURE.md`
- Contact platform administrators

---

*Last Updated: December 2024*
