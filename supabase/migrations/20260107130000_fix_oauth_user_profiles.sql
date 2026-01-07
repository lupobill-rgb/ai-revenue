-- ============================================================================
-- FIX GOOGLE OAUTH LOGIN - Create Profiles for OAuth Users
-- ============================================================================
-- Purpose: Fix OAuth login by creating profiles automatically
-- Date: January 7, 2026
-- Priority: URGENT - Users can't login with Google
-- ============================================================================

-- Update handle_new_user function to also create a profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_workspace_id UUID;
  user_email TEXT;
  user_name TEXT;
  workspace_name TEXT;
  workspace_slug TEXT;
BEGIN
  -- Get user email and name from metadata or email field
  user_email := COALESCE(
    NEW.raw_user_meta_data->>'email',
    NEW.email
  );
  
  user_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(user_email, '@', 1)
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
  
  -- Create profile in profiles table (if it exists)
  INSERT INTO public.profiles (id, name, email, created_at, updated_at)
  VALUES (NEW.id, user_name, user_email, NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;
  
  -- Create business profile for the workspace
  INSERT INTO public.business_profiles (user_id, workspace_id, business_name, created_at, updated_at)
  VALUES (
    NEW.id,
    new_workspace_id,
    workspace_name || '''s Business',
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id, workspace_id) DO NOTHING;
  
  -- Add user as admin in user_roles
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'admin')
  ON CONFLICT (user_id) DO NOTHING;
  
  RAISE NOTICE 'Created workspace (%), profile, and business profile for user %', new_workspace_id, NEW.id;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail user creation
    RAISE WARNING 'Failed to create default workspace/profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Recreate the trigger to ensure it's using the updated function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- Fix existing OAuth users who don't have profiles
-- ============================================================================

-- Create profiles for users who don't have one
INSERT INTO public.profiles (id, name, email, created_at, updated_at)
SELECT 
  u.id,
  COALESCE(
    u.raw_user_meta_data->>'full_name',
    u.raw_user_meta_data->>'name',
    split_part(u.email, '@', 1),
    'User'
  ) as name,
  u.email,
  u.created_at,
  NOW()
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = u.id
)
ON CONFLICT (id) DO NOTHING;

-- Create business profiles for users who have workspaces but no business profile
INSERT INTO public.business_profiles (user_id, workspace_id, business_name, created_at, updated_at)
SELECT 
  w.owner_id as user_id,
  w.id as workspace_id,
  w.name as business_name,
  NOW() as created_at,
  NOW() as updated_at
FROM public.workspaces w
WHERE w.is_default = true
  AND NOT EXISTS (
    SELECT 1 FROM public.business_profiles bp 
    WHERE bp.user_id = w.owner_id AND bp.workspace_id = w.id
  )
ON CONFLICT (user_id, workspace_id) DO NOTHING;

-- ============================================================================
-- Ensure RLS allows profile creation
-- ============================================================================

-- Ensure profiles table has proper RLS (should already exist from previous migration)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_insert_own_profile" ON public.profiles;
CREATE POLICY "users_insert_own_profile"
  ON public.profiles FOR INSERT
  WITH CHECK (id = auth.uid());

-- Ensure business_profiles has proper RLS
ALTER TABLE public.business_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_insert_own_business_profile" ON public.business_profiles;
CREATE POLICY "users_insert_own_business_profile"
  ON public.business_profiles FOR INSERT
  WITH CHECK (user_id = auth.uid() OR public.user_has_workspace_access(workspace_id));

-- ============================================================================
-- Diagnostic output
-- ============================================================================

DO $$
DECLARE
  users_without_profiles integer;
  users_without_business_profiles integer;
  total_users integer;
BEGIN
  SELECT COUNT(*) INTO total_users FROM auth.users;
  
  SELECT COUNT(*) INTO users_without_profiles
  FROM auth.users u
  WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id);
  
  SELECT COUNT(*) INTO users_without_business_profiles
  FROM public.workspaces w
  WHERE w.is_default = true
    AND NOT EXISTS (
      SELECT 1 FROM public.business_profiles bp 
      WHERE bp.user_id = w.owner_id AND bp.workspace_id = w.id
    );
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'OAUTH USER PROFILE FIX COMPLETE';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total users: %', total_users;
  RAISE NOTICE 'Users without profiles: %', users_without_profiles;
  RAISE NOTICE 'Users without business profiles: %', users_without_business_profiles;
  RAISE NOTICE '========================================';
  
  IF users_without_profiles > 0 OR users_without_business_profiles > 0 THEN
    RAISE WARNING 'Some users still missing profiles - check RLS policies or run backfill again';
  ELSE
    RAISE NOTICE '✓ All users have complete profiles';
  END IF;
END $$;

