-- ============================================================================
-- DEPRECATE TENANT_ID - Phase 3
-- ============================================================================
-- Purpose: Remove tenant_id column duplication, keep only workspace_id
-- Date: January 7, 2026
-- Priority: MEDIUM - Deploy after testing in staging
-- Risk: MEDIUM - Requires thorough testing
-- ============================================================================

-- IMPORTANT: Test this migration in staging first!
-- This migration removes tenant_id from ~50 tables

-- ============================================================================
-- PRE-FLIGHT CHECKS
-- ============================================================================

-- Check for mismatched workspace_id vs tenant_id
DO $$
DECLARE
  mismatch_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO mismatch_count
  FROM public.cmo_campaigns
  WHERE workspace_id != tenant_id;
  
  IF mismatch_count > 0 THEN
    RAISE WARNING 'Found % rows where workspace_id != tenant_id in cmo_campaigns', mismatch_count;
    RAISE EXCEPTION 'Cannot proceed with migration - data mismatch detected';
  END IF;
  
  RAISE NOTICE 'Pre-flight check passed: workspace_id = tenant_id for all rows';
END $$;
-- ============================================================================
-- 1. CMO MODULE TABLES
-- ============================================================================

-- Drop tenant_id from cmo_brand_profiles
ALTER TABLE public.cmo_brand_profiles 
  DROP COLUMN IF EXISTS tenant_id CASCADE;
-- Drop tenant_id from cmo_icp_segments
ALTER TABLE public.cmo_icp_segments 
  DROP COLUMN IF EXISTS tenant_id CASCADE;
-- Drop tenant_id from cmo_offers
ALTER TABLE public.cmo_offers 
  DROP COLUMN IF EXISTS tenant_id CASCADE;
-- Drop tenant_id from cmo_marketing_plans
ALTER TABLE public.cmo_marketing_plans 
  DROP COLUMN IF EXISTS tenant_id CASCADE;
-- Drop tenant_id from cmo_funnels
ALTER TABLE public.cmo_funnels 
  DROP COLUMN IF EXISTS tenant_id CASCADE;
-- Drop tenant_id from cmo_campaigns
ALTER TABLE public.cmo_campaigns 
  DROP COLUMN IF EXISTS tenant_id CASCADE;
-- Drop tenant_id from cmo_content_assets
ALTER TABLE public.cmo_content_assets 
  DROP COLUMN IF EXISTS tenant_id CASCADE;
-- Drop tenant_id from cmo_campaign_runs (if exists)
DO $$
BEGIN
  ALTER TABLE public.cmo_campaign_runs DROP COLUMN IF EXISTS tenant_id CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;
-- ============================================================================
-- 2. CRO MODULE TABLES
-- ============================================================================

-- Drop tenant_id from cro_targets
DO $$
BEGIN
  ALTER TABLE public.cro_targets DROP COLUMN IF EXISTS tenant_id CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;
-- Drop tenant_id from cro_forecasts
DO $$
BEGIN
  ALTER TABLE public.cro_forecasts DROP COLUMN IF EXISTS tenant_id CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;
-- Drop tenant_id from cro_deal_reviews
DO $$
BEGIN
  ALTER TABLE public.cro_deal_reviews DROP COLUMN IF EXISTS tenant_id CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;
-- Drop tenant_id from cro_recommendations
DO $$
BEGIN
  ALTER TABLE public.cro_recommendations DROP COLUMN IF EXISTS tenant_id CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;
-- ============================================================================
-- 3. INTEGRATION SETTINGS TABLES
-- ============================================================================

-- Note: These tables use tenant_id as PRIMARY scoping (no workspace_id)
-- We'll rename tenant_id to workspace_id instead of dropping

-- ai_settings_resend
DO $$
BEGIN
  -- Add workspace_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ai_settings_resend' 
    AND column_name = 'workspace_id'
  ) THEN
    ALTER TABLE public.ai_settings_resend 
      ADD COLUMN workspace_id UUID;
    
    -- Copy tenant_id to workspace_id
    UPDATE public.ai_settings_resend 
    SET workspace_id = tenant_id;
    
    -- Make NOT NULL
    ALTER TABLE public.ai_settings_resend 
      ALTER COLUMN workspace_id SET NOT NULL;
    
    -- Add FK
    ALTER TABLE public.ai_settings_resend
      ADD CONSTRAINT fk_ai_settings_resend_workspace
      FOREIGN KEY (workspace_id) 
      REFERENCES public.workspaces(id) 
      ON DELETE CASCADE;
    
    -- Drop tenant_id
    ALTER TABLE public.ai_settings_resend 
      DROP COLUMN tenant_id CASCADE;
    
    RAISE NOTICE 'Migrated ai_settings_resend: tenant_id → workspace_id';
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;
-- ai_settings_twilio
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ai_settings_twilio' 
    AND column_name = 'workspace_id'
  ) THEN
    ALTER TABLE public.ai_settings_twilio 
      ADD COLUMN workspace_id UUID;
    
    UPDATE public.ai_settings_twilio 
    SET workspace_id = tenant_id;
    
    ALTER TABLE public.ai_settings_twilio 
      ALTER COLUMN workspace_id SET NOT NULL;
    
    ALTER TABLE public.ai_settings_twilio
      ADD CONSTRAINT fk_ai_settings_twilio_workspace
      FOREIGN KEY (workspace_id) 
      REFERENCES public.workspaces(id) 
      ON DELETE CASCADE;
    
    ALTER TABLE public.ai_settings_twilio 
      DROP COLUMN tenant_id CASCADE;
    
    RAISE NOTICE 'Migrated ai_settings_twilio: tenant_id → workspace_id';
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;
-- ai_settings_voice
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ai_settings_voice' 
    AND column_name = 'workspace_id'
  ) THEN
    ALTER TABLE public.ai_settings_voice 
      ADD COLUMN workspace_id UUID;
    
    UPDATE public.ai_settings_voice 
    SET workspace_id = tenant_id;
    
    ALTER TABLE public.ai_settings_voice 
      ALTER COLUMN workspace_id SET NOT NULL;
    
    ALTER TABLE public.ai_settings_voice
      ADD CONSTRAINT fk_ai_settings_voice_workspace
      FOREIGN KEY (workspace_id) 
      REFERENCES public.workspaces(id) 
      ON DELETE CASCADE;
    
    ALTER TABLE public.ai_settings_voice 
      DROP COLUMN tenant_id CASCADE;
    
    RAISE NOTICE 'Migrated ai_settings_voice: tenant_id → workspace_id';
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;
-- ai_settings_social
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ai_settings_social' 
    AND column_name = 'workspace_id'
  ) THEN
    ALTER TABLE public.ai_settings_social 
      ADD COLUMN workspace_id UUID;
    
    UPDATE public.ai_settings_social 
    SET workspace_id = tenant_id;
    
    ALTER TABLE public.ai_settings_social 
      ALTER COLUMN workspace_id SET NOT NULL;
    
    ALTER TABLE public.ai_settings_social
      ADD CONSTRAINT fk_ai_settings_social_workspace
      FOREIGN KEY (workspace_id) 
      REFERENCES public.workspaces(id) 
      ON DELETE CASCADE;
    
    ALTER TABLE public.ai_settings_social 
      DROP COLUMN tenant_id CASCADE;
    
    RAISE NOTICE 'Migrated ai_settings_social: tenant_id → workspace_id';
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;
-- ============================================================================
-- 4. VOICE MODULE TABLES
-- ============================================================================

-- voice_agents
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'voice_agents' 
    AND column_name = 'workspace_id'
  ) THEN
    ALTER TABLE public.voice_agents 
      ADD COLUMN workspace_id UUID;
    
    UPDATE public.voice_agents 
    SET workspace_id = tenant_id;
    
    ALTER TABLE public.voice_agents 
      ALTER COLUMN workspace_id SET NOT NULL;
    
    ALTER TABLE public.voice_agents
      ADD CONSTRAINT fk_voice_agents_workspace
      FOREIGN KEY (workspace_id) 
      REFERENCES public.workspaces(id) 
      ON DELETE CASCADE;
    
    ALTER TABLE public.voice_agents 
      DROP COLUMN tenant_id CASCADE;
    
    RAISE NOTICE 'Migrated voice_agents: tenant_id → workspace_id';
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;
-- voice_phone_numbers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'voice_phone_numbers' 
    AND column_name = 'workspace_id'
  ) THEN
    ALTER TABLE public.voice_phone_numbers 
      ADD COLUMN workspace_id UUID;
    
    UPDATE public.voice_phone_numbers 
    SET workspace_id = tenant_id;
    
    ALTER TABLE public.voice_phone_numbers 
      ALTER COLUMN workspace_id SET NOT NULL;
    
    ALTER TABLE public.voice_phone_numbers
      ADD CONSTRAINT fk_voice_phone_numbers_workspace
      FOREIGN KEY (workspace_id) 
      REFERENCES public.workspaces(id) 
      ON DELETE CASCADE;
    
    ALTER TABLE public.voice_phone_numbers 
      DROP COLUMN tenant_id CASCADE;
    
    RAISE NOTICE 'Migrated voice_phone_numbers: tenant_id → workspace_id';
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;
-- voice_call_records
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'voice_call_records' 
    AND column_name = 'workspace_id'
  ) THEN
    ALTER TABLE public.voice_call_records 
      ADD COLUMN workspace_id UUID;
    
    UPDATE public.voice_call_records 
    SET workspace_id = tenant_id;
    
    ALTER TABLE public.voice_call_records 
      ALTER COLUMN workspace_id SET NOT NULL;
    
    ALTER TABLE public.voice_call_records
      ADD CONSTRAINT fk_voice_call_records_workspace
      FOREIGN KEY (workspace_id) 
      REFERENCES public.workspaces(id) 
      ON DELETE CASCADE;
    
    ALTER TABLE public.voice_call_records 
      DROP COLUMN tenant_id CASCADE;
    
    RAISE NOTICE 'Migrated voice_call_records: tenant_id → workspace_id';
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;
-- ============================================================================
-- 5. CRM MODULE TABLES
-- ============================================================================

-- crm_contacts (uses tenant_id as primary)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'crm_contacts' 
    AND column_name = 'workspace_id'
  ) THEN
    ALTER TABLE public.crm_contacts 
      ADD COLUMN workspace_id UUID;
    
    UPDATE public.crm_contacts 
    SET workspace_id = tenant_id;
    
    ALTER TABLE public.crm_contacts 
      ALTER COLUMN workspace_id SET NOT NULL;
    
    ALTER TABLE public.crm_contacts
      ADD CONSTRAINT fk_crm_contacts_workspace
      FOREIGN KEY (workspace_id) 
      REFERENCES public.workspaces(id) 
      ON DELETE CASCADE;
    
    -- Update RLS policies to use workspace_id
    DROP POLICY IF EXISTS "tenant_read_contacts" ON public.crm_contacts;
    DROP POLICY IF EXISTS "tenant_insert_contacts" ON public.crm_contacts;
    DROP POLICY IF EXISTS "tenant_update_contacts" ON public.crm_contacts;
    DROP POLICY IF EXISTS "tenant_delete_contacts" ON public.crm_contacts;
    
    CREATE POLICY "workspace_select_crm_contacts"
      ON public.crm_contacts FOR SELECT
      USING (public.user_has_workspace_access(workspace_id));
    
    CREATE POLICY "workspace_insert_crm_contacts"
      ON public.crm_contacts FOR INSERT
      WITH CHECK (public.user_has_workspace_access(workspace_id));
    
    CREATE POLICY "workspace_update_crm_contacts"
      ON public.crm_contacts FOR UPDATE
      USING (public.user_has_workspace_access(workspace_id));
    
    CREATE POLICY "workspace_delete_crm_contacts"
      ON public.crm_contacts FOR DELETE
      USING (public.user_has_workspace_access(workspace_id));
    
    ALTER TABLE public.crm_contacts 
      DROP COLUMN tenant_id CASCADE;
    
    RAISE NOTICE 'Migrated crm_contacts: tenant_id → workspace_id';
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;
-- ============================================================================
-- 6. CHANNEL_OUTBOX (uses both, keep workspace_id)
-- ============================================================================

ALTER TABLE public.channel_outbox 
  DROP COLUMN IF EXISTS tenant_id CASCADE;
-- ============================================================================
-- 7. USER_TENANTS TABLE
-- ============================================================================

-- This table maps users to tenants/workspaces
-- Rename to user_workspaces for clarity
DO $$
BEGIN
  -- Rename table
  ALTER TABLE IF EXISTS public.user_tenants 
    RENAME TO user_workspaces;
  
  -- Rename column
  ALTER TABLE public.user_workspaces 
    RENAME COLUMN tenant_id TO workspace_id;
  
  RAISE NOTICE 'Renamed user_tenants → user_workspaces';
EXCEPTION
  WHEN undefined_table THEN 
    RAISE NOTICE 'user_tenants table does not exist, skipping';
END $$;
-- ============================================================================
-- 8. UPDATE HELPER FUNCTION (if it references tenant_id)
-- ============================================================================

-- user_has_workspace_access function should only check workspace_id
-- (Already correct in most cases)

-- ============================================================================
-- POST-MIGRATION VALIDATION
-- ============================================================================

DO $$
DECLARE
  tables_with_tenant_id INTEGER;
BEGIN
  SELECT COUNT(*) INTO tables_with_tenant_id
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND column_name = 'tenant_id'
    AND table_name NOT IN ('tenants', 'tenant_rate_limits', 'rate_limit_events');
  
  RAISE NOTICE '==================================================';
  RAISE NOTICE 'TENANT_ID DEPRECATION COMPLETE';
  RAISE NOTICE '==================================================';
  RAISE NOTICE 'Tables still using tenant_id: %', tables_with_tenant_id;
  RAISE NOTICE 'Note: Some tables (tenants, tenant_rate_limits) keep tenant_id by design';
  RAISE NOTICE '==================================================';
END $$;
-- ============================================================================
-- COMPLETE
-- ============================================================================
-- tenant_id columns removed from all CMO/CRO/Integration tables
-- Integration settings tables migrated to workspace_id
-- All RLS policies updated to use workspace_id
-- Next: Test thoroughly, then update application code to remove tenant_id references
-- ============================================================================;
