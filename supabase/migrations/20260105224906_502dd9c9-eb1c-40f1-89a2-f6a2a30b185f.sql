-- Create function to automatically create a default workspace for new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_workspace_id UUID;
  user_email TEXT;
  workspace_name TEXT;
  workspace_slug TEXT;
BEGIN
  -- Get user email from raw_user_meta_data or email field
  user_email := COALESCE(
    NEW.raw_user_meta_data->>'email',
    NEW.email
  );
  
  -- Generate workspace name and slug from email or fallback
  workspace_name := COALESCE(
    split_part(user_email, '@', 1),
    'My Workspace'
  );
  workspace_slug := LOWER(REGEXP_REPLACE(workspace_name, '[^a-z0-9]+', '-', 'g'));
  
  -- Ensure slug uniqueness by appending random suffix
  workspace_slug := workspace_slug || '-' || SUBSTRING(gen_random_uuid()::text, 1, 8);
  
  -- Create the default workspace
  INSERT INTO public.workspaces (name, slug, owner_id, is_default, demo_mode)
  VALUES (workspace_name || '''s Workspace', workspace_slug, NEW.id, true, true)
  RETURNING id INTO new_workspace_id;
  
  -- Add user as owner in workspace_members
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (new_workspace_id, NEW.id, 'owner');
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail user creation
    RAISE WARNING 'Failed to create default workspace for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;
-- Create trigger on auth.users to call this function after insert
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role;
