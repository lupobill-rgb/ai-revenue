-- Function to create default tenant and workspace for new users
CREATE OR REPLACE FUNCTION public.create_default_tenant_and_workspace()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_tenant_id uuid;
  new_workspace_id uuid;
  tenant_slug text;
  workspace_slug text;
BEGIN
  -- Generate slugs from business name
  tenant_slug := lower(regexp_replace(NEW.business_name, '[^a-zA-Z0-9]', '-', 'g'));
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
  VALUES (NEW.business_name, tenant_slug, 'active')
  RETURNING id INTO new_tenant_id;

  -- Create workspace
  INSERT INTO workspaces (name, slug, owner_id)
  VALUES (NEW.business_name, workspace_slug, NEW.user_id)
  RETURNING id INTO new_workspace_id;

  -- Link user to tenant
  INSERT INTO user_tenants (user_id, tenant_id, role)
  VALUES (NEW.user_id, new_tenant_id, 'owner')
  ON CONFLICT (user_id, tenant_id) DO NOTHING;

  RETURN NEW;
END;
$$;
-- Create trigger on business_profiles
DROP TRIGGER IF EXISTS create_tenant_workspace_on_profile ON business_profiles;
CREATE TRIGGER create_tenant_workspace_on_profile
  AFTER INSERT ON business_profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_default_tenant_and_workspace();
