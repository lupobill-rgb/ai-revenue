-- Fix the create_default_tenant_and_workspace function to use correct column name
CREATE OR REPLACE FUNCTION public.create_default_tenant_and_workspace()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  new_tenant_id uuid;
  new_workspace_id uuid;
  tenant_slug text;
  workspace_slug text;
BEGIN
  -- Generate slugs from business name
  tenant_slug := lower(regexp_replace(COALESCE(NEW.business_name, 'workspace'), '[^a-zA-Z0-9]', '-', 'g'));
  workspace_slug := tenant_slug;
  
  -- Ensure slug uniqueness by appending random suffix if needed
  IF EXISTS (SELECT 1 FROM tenants WHERE slug = tenant_slug) THEN
    tenant_slug := tenant_slug || '-' || substr(gen_random_uuid()::text, 1, 8);
  END IF;
  
  IF EXISTS (SELECT 1 FROM workspaces WHERE slug = workspace_slug) THEN
    workspace_slug := workspace_slug || '-' || substr(gen_random_uuid()::text, 1, 8);
  END IF;

  -- Create tenant
  INSERT INTO tenants (name, slug, status)
  VALUES (COALESCE(NEW.business_name, 'My Business'), tenant_slug, 'active')
  RETURNING id INTO new_tenant_id;

  -- Create workspace
  INSERT INTO workspaces (name, slug, owner_id)
  VALUES (COALESCE(NEW.business_name, 'My Workspace'), workspace_slug, NEW.user_id)
  RETURNING id INTO new_workspace_id;

  -- Link user to tenant as owner
  INSERT INTO user_tenants (user_id, tenant_id, role)
  VALUES (NEW.user_id, new_tenant_id, 'owner')
  ON CONFLICT (user_id, tenant_id) DO NOTHING;

  -- Link user to workspace as owner in workspace_members
  INSERT INTO workspace_members (workspace_id, user_id, role)
  VALUES (new_workspace_id, NEW.user_id, 'owner')
  ON CONFLICT DO NOTHING;

  -- Add user as admin in user_roles (first user of tenant is admin)
  INSERT INTO user_roles (user_id, role)
  VALUES (NEW.user_id, 'admin')
  ON CONFLICT DO NOTHING;

  -- Create default segments for the tenant (using is_global instead of is_default)
  INSERT INTO tenant_segments (tenant_id, name, code, description, is_global)
  VALUES 
    (new_tenant_id, 'All Contacts', 'all', 'All contacts in your database', true),
    (new_tenant_id, 'New Leads', 'new_leads', 'Recently added leads', false),
    (new_tenant_id, 'Engaged', 'engaged', 'Contacts who have engaged with your content', false)
  ON CONFLICT DO NOTHING;

  -- Update business profile with the workspace_id
  UPDATE business_profiles 
  SET workspace_id = new_workspace_id
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;
