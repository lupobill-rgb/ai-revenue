# UbiGrowth Database Schema

## Overview
The UbiGrowth platform uses a multi-tenant architecture built on Supabase (PostgreSQL) with Row Level Security (RLS) for data isolation.

---

## Core Architecture

### **Multi-Tenancy Model**
The platform uses a dual-scoping system:
- **`workspace_id`**: User-facing workspace isolation (recommended for new features)
- **`tenant_id`**: Legacy/internal tenant tracking
- Most tables include both for backward compatibility

---

## Main Table Groups

## 1. **Identity & Access Management**

### `workspaces`
Primary organizational unit for multi-tenancy.
```sql
- id (UUID, PK)
- name (TEXT)
- slug (TEXT, unique)
- owner_id (UUID, references auth.users)
- settings (JSONB)
- created_at, updated_at (TIMESTAMPTZ)
```

### `workspace_members`
Collaboration and team management.
```sql
- id (UUID, PK)
- workspace_id (UUID, FK → workspaces)
- user_id (UUID)
- role (TEXT: 'owner', 'member', etc.)
- created_at (TIMESTAMPTZ)
```

### `user_tenants`
Maps users to tenants for legacy compatibility.
```sql
- id (UUID, PK)
- user_id (UUID)
- tenant_id (UUID)
- role (TEXT)
- created_at (TIMESTAMPTZ)
```

### `user_roles`
Application-level role assignments.
```sql
- id (UUID, PK)
- user_id (UUID)
- role (ENUM: 'admin', 'sales', 'manager')
- created_at (TIMESTAMPTZ)
```

### `business_profiles`
Business configuration and branding per workspace.
```sql
- id (UUID, PK)
- user_id (UUID)
- workspace_id (UUID, FK)
- business_name, business_description (TEXT)
- industry (TEXT)
- brand_colors, brand_fonts (JSONB)
- logo_url (TEXT)
- target_audiences (JSONB)
- created_at, updated_at (TIMESTAMPTZ)
```

---

## 2. **CRM & Sales**

### `leads`
Core lead/prospect management.
```sql
- id (UUID, PK)
- workspace_id (UUID, FK)
- email, phone (TEXT)
- first_name, last_name (TEXT)
- company (TEXT)
- status (TEXT: 'new', 'contacted', 'qualified', 'nurturing', 'closed_won', 'closed_lost')
- score (INTEGER)
- source (TEXT)
- tags (TEXT[])
- segment_code (TEXT)
- custom_fields (JSONB)
- created_at, updated_at (TIMESTAMPTZ)
```
**Key Indexes:**
- `idx_leads_workspace_id`, `idx_leads_status`, `idx_leads_score`
- `idx_leads_created_at`, `idx_leads_name`, `idx_leads_company`

### `crm_contacts`
Unified contact management (prospects + customers).
```sql
- id (UUID, PK)
- tenant_id (UUID)
- email, phone (TEXT)
- first_name, last_name (TEXT)
- company_name, role_title (TEXT)
- status (TEXT: 'prospect', 'customer', 'inactive')
- lifecycle_stage (TEXT)
- created_at, updated_at (TIMESTAMPTZ)
```

### `deals`
Opportunity tracking.
```sql
- id (UUID, PK)
- lead_id (UUID, FK → leads)
- name (TEXT)
- value (NUMERIC)
- stage (TEXT: 'prospecting', 'qualification', etc.)
- probability (INTEGER)
- expected_close_date, actual_close_date (DATE)
- owner_id, created_by (UUID)
- notes (TEXT)
- created_at, updated_at (TIMESTAMPTZ)
```

### `tasks`
Activity and follow-up management.
```sql
- id (UUID, PK)
- lead_id (UUID, FK → leads)
- deal_id (UUID, FK → deals)
- title, description (TEXT)
- due_date (TIMESTAMPTZ)
- priority (TEXT: 'low', 'medium', 'high')
- status (TEXT: 'pending', 'completed')
- assigned_to, created_by (UUID)
- completed_at (TIMESTAMPTZ)
- created_at, updated_at (TIMESTAMPTZ)
```

### `email_sequences`
Automated email campaign management.
```sql
- id (UUID, PK)
- name, description (TEXT)
- status (TEXT: 'draft', 'active', 'paused')
- trigger_type (TEXT: 'manual', 'auto')
- total_steps, enrolled_count, completed_count (INTEGER)
- created_by (UUID)
- created_at, updated_at (TIMESTAMPTZ)
```

---

## 3. **AI CMO Module**

### `cmo_brand_profiles`
Brand strategy and positioning.
```sql
- id (UUID, PK)
- workspace_id, tenant_id (UUID)
- business_name, industry (TEXT)
- icp_description, value_proposition (TEXT)
- brand_voice, brand_personality (TEXT)
- competitors (TEXT[])
- differentiators (TEXT[])
- created_at, updated_at (TIMESTAMPTZ)
```

### `cmo_icp_segments`
Ideal Customer Profile definitions.
```sql
- id (UUID, PK)
- workspace_id, tenant_id (UUID)
- name, segment_code (TEXT)
- description (TEXT)
- firmographics (JSONB)
- psychographics (JSONB)
- pain_points (TEXT[])
- priority_score (INTEGER)
- is_active (BOOLEAN)
- created_at, updated_at (TIMESTAMPTZ)
```

### `cmo_offers`
Product/service offerings.
```sql
- id (UUID, PK)
- workspace_id, tenant_id (UUID)
- name, description (TEXT)
- value_proposition (TEXT)
- pricing_model (TEXT)
- target_segment_codes (TEXT[])
- created_at, updated_at (TIMESTAMPTZ)
```

### `cmo_marketing_plans`
90-day marketing strategies.
```sql
- id (UUID, PK)
- workspace_id, tenant_id (UUID)
- plan_name (TEXT)
- plan_summary (TEXT)
- goals (JSONB)
- kpis (JSONB)
- budget_allocated (NUMERIC)
- status (TEXT: 'draft', 'active', 'completed')
- created_at, updated_at (TIMESTAMPTZ)
```

### `cmo_campaigns`
Marketing campaign execution.
```sql
- id (UUID, PK)
- workspace_id, tenant_id (UUID)
- campaign_name (TEXT)
- channels (TEXT[])
- target_tags (TEXT[])  ← Master Prompt v3
- target_segment_codes (TEXT[])  ← Master Prompt v3
- icp, offer, desired_result (TEXT)
- status (TEXT: 'draft', 'in_progress', 'active', 'completed')
- budget_allocated (NUMERIC)
- created_at, updated_at (TIMESTAMPTZ)
```

### `cmo_content_assets`
Generated marketing content.
```sql
- id (UUID, PK)
- workspace_id, tenant_id (UUID)
- campaign_id (UUID, FK)
- channel (TEXT: 'email', 'social', 'voice', 'landing_page')
- content_type (TEXT: 'email_copy', 'social_post', 'video_script', 'voicemail_drop')
- key_message (TEXT)
- asset_url (TEXT)
- status (TEXT: 'draft', 'scheduled', 'deployed')
- created_at, updated_at (TIMESTAMPTZ)
```

### `cmo_funnels`
Marketing funnel definitions.
```sql
- id (UUID, PK)
- workspace_id, tenant_id (UUID)
- funnel_name (TEXT)
- stages (JSONB)
- conversion_targets (JSONB)
- created_at, updated_at (TIMESTAMPTZ)
```

---

## 4. **Assets & Content**

### `assets`
Multi-channel asset management (videos, emails, landing pages).
```sql
- id (UUID, PK)
- type (ENUM: 'video', 'email', 'voice', 'landing_page', 'website')
- status (ENUM: 'draft', 'review', 'approved', 'live')
- name, description (TEXT)
- fal_id, vapi_id, external_id (TEXT)
- preview_url (TEXT)
- segment_id (UUID)
- channel, goal (TEXT)
- content (JSONB)
- external_project_url, custom_domain (TEXT)
- deployment_status (TEXT: 'staging', 'live')
- views (INTEGER)
- created_by (UUID)
- created_at, updated_at (TIMESTAMPTZ)
```

### `asset_approvals`
Approval workflow tracking.
```sql
- id (UUID, PK)
- asset_id (UUID, FK → assets)
- status (ENUM: 'draft', 'review', 'approved', 'live')
- comments (TEXT)
- approved_by (UUID)
- created_at (TIMESTAMPTZ)
```

### `content_calendar`
Content scheduling.
```sql
- id (UUID, PK)
- workspace_id (UUID, FK)
- title, description (TEXT)
- content_type (TEXT)
- scheduled_date (TIMESTAMPTZ)
- status (TEXT: 'scheduled', 'published', 'cancelled')
- asset_id (UUID, FK → assets)
- created_by (UUID)
- created_at, updated_at (TIMESTAMPTZ)
```

---

## 5. **Campaigns & Distribution**

### `campaigns`
Legacy campaign tracking.
```sql
- id (UUID, PK)
- workspace_id (UUID, FK)
- name, description (TEXT)
- channel (TEXT: 'email', 'social', 'video', 'voice')
- status (TEXT: 'draft', 'active', 'completed')
- budget_allocated (NUMERIC)
- deployed_at (TIMESTAMPTZ)
- created_by (UUID)
- created_at, updated_at (TIMESTAMPTZ)
```

### `campaign_metrics`
Campaign performance data.
```sql
- id (UUID, PK)
- campaign_id (UUID, FK → campaigns)
- impressions, clicks, conversions (INTEGER)
- revenue, cost (NUMERIC)
- engagement_rate (NUMERIC)
- sent_count, delivered_count, open_count (INTEGER)
- bounce_count, unsubscribe_count (INTEGER)
- shares, comments, likes (INTEGER)
- video_views (INTEGER)
- data_mode (TEXT: 'real', 'demo')  ← Analytics gating
- last_synced_at (TIMESTAMPTZ)
- created_at, updated_at (TIMESTAMPTZ)
```

### `channel_outbox`
Multi-channel message queue.
```sql
- id (UUID, PK)
- workspace_id, tenant_id (UUID)
- channel (TEXT: 'email', 'sms', 'voice', 'voice_vm', 'linkedin', 'landing_page')
- provider (TEXT: 'resend', 'twilio', 'vapi', etc.)
- recipient_id (UUID)
- recipient_email, recipient_phone (TEXT)
- payload (JSONB)
- status (TEXT: 'scheduled', 'sent', 'delivered', 'failed')
- scheduled_at, sent_at (TIMESTAMPTZ)
- provider_response (JSONB)
- idempotency_key (TEXT, unique)
- created_at (TIMESTAMPTZ)
```
**Key Features:**
- Unified outbox for all channels
- Idempotency for preventing duplicates
- Provider response tracking

---

## 6. **Voice AI**

### `voice_agents`
AI voice assistant configurations.
```sql
- id (UUID, PK)
- workspace_id, tenant_id (UUID)
- name, description (TEXT)
- vapi_assistant_id (TEXT)
- system_prompt (TEXT)
- voice_provider, voice_id (TEXT)
- status (TEXT: 'draft', 'active', 'archived')
- created_by (UUID)
- created_at, updated_at (TIMESTAMPTZ)
```

### `voice_phone_numbers`
Phone number inventory.
```sql
- id (UUID, PK)
- tenant_id (UUID)
- phone_number (TEXT, unique)
- provider (TEXT: 'vapi', 'twilio')
- provider_id (TEXT)
- assigned_to (TEXT)
- is_active (BOOLEAN)
- created_at, updated_at (TIMESTAMPTZ)
```

### `voice_call_records`
Call history and transcripts.
```sql
- id (UUID, PK)
- tenant_id (UUID)
- phone_number_id (UUID, FK)
- vapi_call_id (TEXT)
- lead_id (UUID, FK → leads)
- direction (TEXT: 'inbound', 'outbound')
- duration_seconds (INTEGER)
- transcript (TEXT)
- summary (TEXT)
- sentiment (TEXT)
- status (TEXT: 'completed', 'failed', 'no_answer')
- created_at (TIMESTAMPTZ)
```

---

## 7. **Integrations & Settings**

### `ai_settings_resend`
Email provider configuration.
```sql
- id (UUID, PK)
- tenant_id (UUID)
- api_key_encrypted (TEXT)
- from_email, from_name (TEXT)
- is_connected (BOOLEAN)
- created_at, updated_at (TIMESTAMPTZ)
```

### `ai_settings_twilio`
SMS provider configuration.
```sql
- id (UUID, PK)
- tenant_id (UUID)
- twilio_account_sid, twilio_auth_token (TEXT)
- twilio_phone_number (TEXT)
- is_connected (BOOLEAN)
- created_at, updated_at (TIMESTAMPTZ)
```

### `ai_settings_voice`
Voice AI provider configuration (VAPI).
```sql
- id (UUID, PK)
- tenant_id (UUID)
- vapi_private_key, vapi_public_key (TEXT)
- default_vapi_assistant_id (TEXT)
- is_connected (BOOLEAN)
- created_at, updated_at (TIMESTAMPTZ)
```

### `ai_settings_social`
Social media integrations.
```sql
- id (UUID, PK)
- tenant_id (UUID)
- platform (TEXT: 'linkedin', 'facebook', 'twitter')
- access_token_encrypted (TEXT)
- refresh_token_encrypted (TEXT)
- is_connected (BOOLEAN)
- created_at, updated_at (TIMESTAMPTZ)
```

---

## 8. **CRO (Chief Revenue Officer) Module**

### `cro_targets`
Revenue targets and quotas.
```sql
- id (UUID, PK)
- tenant_id, workspace_id (UUID)
- period (TEXT: '2026-Q1', '2025-12')
- owner_type (TEXT: 'rep', 'team', 'global')
- owner_id (TEXT)
- target_new_arr, target_pipeline (NUMERIC)
- created_at, updated_at (TIMESTAMPTZ)
```

### `cro_forecasts`
Revenue forecasts by scenario.
```sql
- id (UUID, PK)
- tenant_id, workspace_id (UUID)
- period, scenario (TEXT)  -- 'base', 'stretch', 'commit'
- forecast_new_arr (NUMERIC)
- confidence (NUMERIC 0-1)
- notes (TEXT)
- created_at, updated_at (TIMESTAMPTZ)
```

### `cro_deal_reviews`
AI-generated deal analysis.
```sql
- id (UUID, PK)
- tenant_id, workspace_id (UUID)
- deal_id (UUID, FK → deals)
- summary_md, risks, next_steps (TEXT)
- score (NUMERIC 0-100)
- created_at, updated_at (TIMESTAMPTZ)
```

### `cro_recommendations`
AI-driven revenue insights.
```sql
- id (UUID, PK)
- tenant_id, workspace_id (UUID)
- rec_type (TEXT: 'close_deal', 'expand', 'at_risk')
- priority (TEXT: 'high', 'medium', 'low')
- title, description (TEXT)
- deal_id, lead_id (UUID)
- status (TEXT: 'open', 'in_progress', 'done')
- created_at, updated_at (TIMESTAMPTZ)
```

---

## 9. **Revenue OS Kernel (Event-Driven Architecture)**

### `kernel_events`
Event log for the Revenue OS.
```sql
- id (BIGSERIAL, PK)
- event_type (TEXT: 'deal.updated', 'lead.created', etc.)
- tenant_id, workspace_id (UUID)
- entity_type, entity_id (TEXT)
- payload (JSONB)
- metadata (JSONB)
- created_at (TIMESTAMPTZ)
```
**Key Feature:** Immutable event log for audit trail

### `kernel_decisions`
Automated business rule decisions.
```sql
- id (BIGSERIAL, PK)
- event_id (BIGINT, FK → kernel_events)
- rule_name (TEXT)
- decision_outcome (TEXT)
- reason (TEXT)
- metadata (JSONB)
- created_at (TIMESTAMPTZ)
```

### `kernel_actions`
Actions triggered by decisions.
```sql
- id (BIGSERIAL, PK)
- decision_id (BIGINT, FK → kernel_decisions)
- action_type (TEXT: 'send_email', 'create_task', etc.)
- status (TEXT: 'pending', 'completed', 'failed')
- result (JSONB)
- created_at, completed_at (TIMESTAMPTZ)
```

---

## 10. **Analytics & Reporting**

### Analytics Views (SQL Views for dashboards)
```sql
-- cmo_performance_snapshot: Campaign metrics aggregation
-- cro_pipeline_view: Sales pipeline aggregation
-- lead_funnel_analysis: Conversion funnel metrics
-- revenue_forecast_view: Revenue projections
```

**Critical Note:** Analytics views MUST NOT be queried from transactional components (enforced by `analytics-surface-lint.yml`)

---

## 11. **Job Queue & Automation**

### `job_queue`
Background job management.
```sql
- id (UUID, PK)
- job_type (TEXT)
- payload (JSONB)
- status (TEXT: 'pending', 'running', 'completed', 'failed')
- priority (INTEGER)
- scheduled_at, started_at, completed_at (TIMESTAMPTZ)
- retry_count (INTEGER)
- error_message (TEXT)
- created_at (TIMESTAMPTZ)
```

### `campaign_audit_log`
Change tracking for campaigns.
```sql
- id (UUID, PK)
- campaign_id (UUID)
- action (TEXT: 'created', 'updated', 'launched')
- changed_by (UUID)
- changes (JSONB)
- created_at (TIMESTAMPTZ)
```

---

## 12. **Industry & Vertical Data**

### `industry_verticals`
Pre-defined industry templates.
```sql
- id (UUID, PK)
- name, slug (TEXT)
- description (TEXT)
- typical_icp (JSONB)
- common_pain_points (TEXT[])
- sample_offers (JSONB)
- created_at (TIMESTAMPTZ)
```

---

## Key Design Patterns

### **1. Tenant Isolation**
- All tables include `workspace_id` (user-facing) and/or `tenant_id` (internal)
- RLS policies enforce data isolation: `user_has_workspace_access(workspace_id)`
- Helper function: `user_has_workspace_access(workspace_id UUID) RETURNS BOOLEAN`

### **2. Soft Deletes**
- Most tables use status fields instead of hard deletes
- Example: `status = 'archived'` instead of `DELETE`

### **3. JSONB for Flexibility**
- Settings, metadata, custom fields stored as JSONB
- Allows schema evolution without migrations

### **4. Audit Trail**
- All tables have `created_at`, `updated_at`
- Many have `created_by`, `updated_by`
- Kernel events table provides immutable log

### **5. Idempotency**
- `channel_outbox` uses `idempotency_key` to prevent duplicate messages
- Format: `{campaign_id}_{asset_id}_{lead_id}_{channel}_{date}`

---

## Row Level Security (RLS) Policies

### **Standard Policy Pattern:**
```sql
-- Read access
CREATE POLICY "workspace_read"
  ON table_name FOR SELECT
  USING (user_has_workspace_access(workspace_id));

-- Write access
CREATE POLICY "workspace_write"
  ON table_name FOR INSERT
  WITH CHECK (user_has_workspace_access(workspace_id));

CREATE POLICY "workspace_update"
  ON table_name FOR UPDATE
  USING (user_has_workspace_access(workspace_id));

CREATE POLICY "workspace_delete"
  ON table_name FOR DELETE
  USING (user_has_workspace_access(workspace_id));
```

---

## Indexes & Performance

### **Critical Indexes:**
```sql
-- Workspace isolation (most queries filter by this)
CREATE INDEX idx_leads_workspace_id ON leads(workspace_id);
CREATE INDEX idx_campaigns_workspace_id ON campaigns(workspace_id);

-- Status filtering (common in UI)
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_campaigns_status ON campaigns(status);

-- Sorting (CRM, reports)
CREATE INDEX idx_leads_created_at ON leads(created_at);
CREATE INDEX idx_leads_score ON leads(score);
CREATE INDEX idx_deals_value ON deals(value);

-- Search (text lookups)
CREATE INDEX idx_leads_email ON leads(email);
CREATE INDEX idx_crm_contacts_email ON crm_contacts(email);

-- Channel outbox (job processing)
CREATE INDEX idx_channel_outbox_status ON channel_outbox(status, scheduled_at);
```

---

## Migration Strategy

### **Current Migration Count:** 200+ incremental migrations
### **Base Schema:** `20251202210353_remix_migration_from_pg_dump.sql`
### **Latest Feature:** Master Prompt v3 (`20260106181831_master_prompt_v3_implementation.sql`)

### **Key Migrations:**
- **Workspaces:** `20251203031242` (multi-tenancy foundation)
- **CMO Module:** `20251204021124` onwards
- **CRO Module:** `20251204032922`
- **Channel Outbox:** `20251220162121`
- **Voice AI:** `20251219231220`
- **Revenue OS Kernel:** `20251229190000`, `20260106010605`

---

## Testing & Verification

### **Workspace Isolation Test:**
Run: `scripts/verify-workspace-isolation.sql`

Verifies:
- ✅ No orphaned records (NULL workspace_id)
- ✅ RLS policies active on all tables
- ✅ Cross-workspace data leakage checks
- ✅ Index coverage

---

## Common Queries

### **Get User's Workspaces:**
```sql
SELECT * FROM workspaces
WHERE owner_id = auth.uid()
OR id IN (
  SELECT workspace_id FROM workspace_members
  WHERE user_id = auth.uid()
);
```

### **Get Leads with Filters:**
```sql
SELECT * FROM leads
WHERE workspace_id = $1
AND status = $2
ORDER BY created_at DESC
LIMIT 100;
```

### **Get Campaign Performance:**
```sql
SELECT c.*, cm.* FROM campaigns c
LEFT JOIN campaign_metrics cm ON cm.campaign_id = c.id
WHERE c.workspace_id = $1
AND c.status = 'active';
```

---

## Database Stats

- **Total Tables:** ~80+
- **Total Migrations:** 200+
- **Primary Keys:** UUID (gen_random_uuid())
- **Timestamps:** TIMESTAMPTZ (UTC)
- **Database:** PostgreSQL 17.6
- **Extensions:** pg_cron, pgcrypto, uuid-ossp, supabase_vault

---

## Next Steps

1. **For New Features:** Always include `workspace_id` for multi-tenancy
2. **For Queries:** Always filter by `workspace_id` first
3. **For RLS:** Use `user_has_workspace_access(workspace_id)`
4. **For Analytics:** Query views, not raw tables
5. **For Jobs:** Use `channel_outbox` with idempotency keys

---

*Last Updated: January 2026*
*Schema Version: Master Prompt v3*

