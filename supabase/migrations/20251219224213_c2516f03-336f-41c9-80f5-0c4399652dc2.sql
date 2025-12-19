-- Fix remaining tables with old broken policies

-- crm_activities - drop remaining old policies
DROP POLICY IF EXISTS "tenant_isolation_crm_activities" ON public.crm_activities;

-- crm_contacts - drop old policies  
DROP POLICY IF EXISTS "tenant_isolation_crm_contacts" ON public.crm_contacts;

-- crm_leads - drop old policies
DROP POLICY IF EXISTS "tenant_isolation_crm_leads" ON public.crm_leads;

-- integration_audit_log - drop old policies
DROP POLICY IF EXISTS "tenant_isolation_integration_audit_log" ON public.integration_audit_log;

-- landing_pages - drop ALL old policies and recreate
DROP POLICY IF EXISTS "tenant_isolation_landing_pages_delete" ON public.landing_pages;
DROP POLICY IF EXISTS "tenant_isolation_landing_pages_insert" ON public.landing_pages;
DROP POLICY IF EXISTS "tenant_isolation_landing_pages_select" ON public.landing_pages;
DROP POLICY IF EXISTS "tenant_isolation_landing_pages_update" ON public.landing_pages;
DROP POLICY IF EXISTS "landing_pages_tenant_isolation" ON public.landing_pages;
DROP POLICY IF EXISTS "tenant_delete" ON public.landing_pages;
DROP POLICY IF EXISTS "tenant_insert" ON public.landing_pages;
DROP POLICY IF EXISTS "tenant_select" ON public.landing_pages;
DROP POLICY IF EXISTS "tenant_update" ON public.landing_pages;
-- Ensure clean policies exist
DROP POLICY IF EXISTS "tenant_isolation_select" ON public.landing_pages;
DROP POLICY IF EXISTS "tenant_isolation_insert" ON public.landing_pages;
DROP POLICY IF EXISTS "tenant_isolation_update" ON public.landing_pages;
DROP POLICY IF EXISTS "tenant_isolation_delete" ON public.landing_pages;
CREATE POLICY "tenant_isolation_select" ON public.landing_pages FOR SELECT USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_insert" ON public.landing_pages FOR INSERT WITH CHECK (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_update" ON public.landing_pages FOR UPDATE USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "tenant_isolation_delete" ON public.landing_pages FOR DELETE USING (user_belongs_to_tenant(tenant_id));

-- linkedin_tasks - drop old policies
DROP POLICY IF EXISTS "tenant_isolation_linkedin_tasks" ON public.linkedin_tasks;

-- team_invitations - drop ALL old policies
DROP POLICY IF EXISTS "team_invitations_tenant_insert" ON public.team_invitations;
DROP POLICY IF EXISTS "team_invitations_tenant_select" ON public.team_invitations;
DROP POLICY IF EXISTS "team_invitations_tenant_update" ON public.team_invitations;
DROP POLICY IF EXISTS "team_invitations_tenant_delete" ON public.team_invitations;
DROP POLICY IF EXISTS "tenant_insert" ON public.team_invitations;
DROP POLICY IF EXISTS "tenant_select" ON public.team_invitations;
DROP POLICY IF EXISTS "tenant_update" ON public.team_invitations;
DROP POLICY IF EXISTS "tenant_delete" ON public.team_invitations;

-- tenant_segments - drop ALL old policies
DROP POLICY IF EXISTS "tenant_segments_tenant_insert" ON public.tenant_segments;
DROP POLICY IF EXISTS "tenant_segments_tenant_select" ON public.tenant_segments;
DROP POLICY IF EXISTS "tenant_segments_tenant_update" ON public.tenant_segments;
DROP POLICY IF EXISTS "tenant_segments_tenant_delete" ON public.tenant_segments;
DROP POLICY IF EXISTS "tenant_insert" ON public.tenant_segments;
DROP POLICY IF EXISTS "tenant_select" ON public.tenant_segments;
DROP POLICY IF EXISTS "tenant_update" ON public.tenant_segments;
DROP POLICY IF EXISTS "tenant_delete" ON public.tenant_segments;