-- Drop all remaining old policies with broken tenant_id = auth.uid() pattern

-- crm_activities
DROP POLICY IF EXISTS "tenant_read_activities" ON public.crm_activities;
DROP POLICY IF EXISTS "tenant_write_activities" ON public.crm_activities;
DROP POLICY IF EXISTS "tenant_create_activities" ON public.crm_activities;

-- crm_contacts
DROP POLICY IF EXISTS "tenant_read_contacts" ON public.crm_contacts;
DROP POLICY IF EXISTS "tenant_write_contacts" ON public.crm_contacts;
DROP POLICY IF EXISTS "tenant_create_contacts" ON public.crm_contacts;

-- crm_leads
DROP POLICY IF EXISTS "tenant_read_leads" ON public.crm_leads;
DROP POLICY IF EXISTS "tenant_write_leads" ON public.crm_leads;
DROP POLICY IF EXISTS "tenant_create_leads" ON public.crm_leads;

-- integration_audit_log
DROP POLICY IF EXISTS "Users can view their own audit logs" ON public.integration_audit_log;

-- landing_pages
DROP POLICY IF EXISTS "tenant_read_landing_pages" ON public.landing_pages;
DROP POLICY IF EXISTS "tenant_update_landing_pages" ON public.landing_pages;
DROP POLICY IF EXISTS "tenant_delete_landing_pages" ON public.landing_pages;
DROP POLICY IF EXISTS "tenant_create_landing_pages" ON public.landing_pages;
DROP POLICY IF EXISTS "tenant_insert_landing_pages" ON public.landing_pages;

-- linkedin_tasks
DROP POLICY IF EXISTS "tenant access linkedin_tasks" ON public.linkedin_tasks;

-- team_invitations
DROP POLICY IF EXISTS "Users can delete tenant invitations" ON public.team_invitations;
DROP POLICY IF EXISTS "Users can update tenant invitations" ON public.team_invitations;
DROP POLICY IF EXISTS "Users can view their tenant invitations" ON public.team_invitations;
DROP POLICY IF EXISTS "Users can create tenant invitations" ON public.team_invitations;
DROP POLICY IF EXISTS "Users can insert tenant invitations" ON public.team_invitations;

-- tenant_segments
DROP POLICY IF EXISTS "Users can update tenant segments" ON public.tenant_segments;
DROP POLICY IF EXISTS "Users can delete tenant segments" ON public.tenant_segments;
DROP POLICY IF EXISTS "Users can view segments" ON public.tenant_segments;
DROP POLICY IF EXISTS "Users can create tenant segments" ON public.tenant_segments;
DROP POLICY IF EXISTS "Users can insert tenant segments" ON public.tenant_segments;

-- Now add RLS policy for rate_limit_counters (should be service role only, but add platform admin)
ALTER TABLE public.rate_limit_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "platform_admin_only" ON public.rate_limit_counters 
  FOR ALL USING (public.is_platform_admin(auth.uid()));