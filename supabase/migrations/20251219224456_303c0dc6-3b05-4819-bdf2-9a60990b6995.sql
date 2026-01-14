-- Fix the create_default_tenant_and_workspace function to also add user to workspace_members
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

  -- Link user to tenant
  INSERT INTO user_tenants (user_id, tenant_id, role)
  VALUES (NEW.user_id, new_tenant_id, 'owner')
  ON CONFLICT (user_id, tenant_id) DO NOTHING;

  -- Link user to workspace as owner in workspace_members
  INSERT INTO workspace_members (workspace_id, user_id, role)
  VALUES (new_workspace_id, NEW.user_id, 'owner')
  ON CONFLICT DO NOTHING;

  -- Update business profile with the workspace_id
  UPDATE business_profiles 
  SET workspace_id = new_workspace_id
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;
-- Add is_default column to workspaces if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'workspaces' 
    AND column_name = 'is_default'
  ) THEN
    ALTER TABLE public.workspaces ADD COLUMN is_default boolean DEFAULT false;
  END IF;
END $$;
-- Add last_used_workspace_id to user profile tracking (using existing user_tenants table)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'user_tenants' 
    AND column_name = 'last_used_workspace_id'
  ) THEN
    ALTER TABLE public.user_tenants ADD COLUMN last_used_workspace_id uuid REFERENCES workspaces(id);
  END IF;
END $$;
-- Create function to get user's default or last used workspace
CREATE OR REPLACE FUNCTION public.get_user_workspace(p_user_id uuid)
RETURNS TABLE(workspace_id uuid, workspace_name text, is_owner boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  last_used uuid;
BEGIN
  -- First try last used workspace
  SELECT ut.last_used_workspace_id INTO last_used
  FROM user_tenants ut
  WHERE ut.user_id = p_user_id
  AND ut.last_used_workspace_id IS NOT NULL
  LIMIT 1;
  
  IF last_used IS NOT NULL THEN
    RETURN QUERY
    SELECT w.id, w.name, (w.owner_id = p_user_id) as is_owner
    FROM workspaces w
    WHERE w.id = last_used
    AND (w.owner_id = p_user_id OR EXISTS (
      SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = w.id AND wm.user_id = p_user_id
    ));
    
    IF FOUND THEN RETURN; END IF;
  END IF;
  
  -- Fall back to default workspace
  RETURN QUERY
  SELECT w.id, w.name, (w.owner_id = p_user_id) as is_owner
  FROM workspaces w
  WHERE w.owner_id = p_user_id
  OR EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = w.id AND wm.user_id = p_user_id)
  ORDER BY w.is_default DESC NULLS LAST, w.created_at ASC
  LIMIT 1;
END;
$$;
-- Create function to update last used workspace
CREATE OR REPLACE FUNCTION public.set_last_used_workspace(p_user_id uuid, p_workspace_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE user_tenants
  SET last_used_workspace_id = p_workspace_id
  WHERE user_id = p_user_id;
END;
$$;
-- Backfill: Add missing workspace_members entries for workspace owners
INSERT INTO workspace_members (workspace_id, user_id, role)
SELECT w.id, w.owner_id, 'owner'
FROM workspaces w
WHERE NOT EXISTS (
  SELECT 1 FROM workspace_members wm 
  WHERE wm.workspace_id = w.id AND wm.user_id = w.owner_id
)
ON CONFLICT DO NOTHING;
