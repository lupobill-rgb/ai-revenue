-- Create shared industry verticals table for consistency
CREATE TABLE IF NOT EXISTS public.industry_verticals (
  id serial PRIMARY KEY,
  name text NOT NULL UNIQUE,
  aliases text[] DEFAULT '{}'::text[],
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Populate with standard verticals
INSERT INTO public.industry_verticals (name, aliases) VALUES
  ('Accounting & Finance', ARRAY['accounting', 'finance', 'financial']),
  ('Advertising & Marketing', ARRAY['advertising', 'marketing', 'ads', 'media buying']),
  ('Aerospace & Defense', ARRAY['aerospace', 'defense', 'aviation']),
  ('Agriculture & Farming', ARRAY['agriculture', 'farming', 'agri', 'agribusiness']),
  ('Automotive', ARRAY['auto', 'car', 'vehicle', 'cars']),
  ('Banking & Financial Services', ARRAY['banking', 'fintech', 'bank']),
  ('Biotechnology & Pharmaceuticals', ARRAY['biotech', 'pharma', 'pharmaceuticals']),
  ('Construction & Engineering', ARRAY['construction', 'engineering', 'building']),
  ('Consulting & Professional Services', ARRAY['consulting', 'professional services']),
  ('Consumer Goods & Retail', ARRAY['consumer goods', 'retail', 'cpg']),
  ('E-commerce', ARRAY['ecommerce', 'online retail', 'online store']),
  ('Education & Training', ARRAY['education', 'training', 'edtech', 'learning']),
  ('Energy & Utilities', ARRAY['energy', 'utilities', 'power', 'electricity']),
  ('Entertainment & Media', ARRAY['entertainment', 'media', 'content']),
  ('Environmental Services', ARRAY['environmental', 'sustainability', 'green']),
  ('Food & Beverage', ARRAY['food', 'beverage', 'f&b', 'restaurant']),
  ('Government & Public Sector', ARRAY['government', 'public sector', 'gov']),
  ('Healthcare & Medical', ARRAY['healthcare', 'medical', 'health', 'hospital']),
  ('Hospitality & Tourism', ARRAY['hospitality', 'tourism', 'hotel', 'travel']),
  ('Human Resources & Staffing', ARRAY['hr', 'human resources', 'staffing', 'recruiting']),
  ('Information Technology', ARRAY['it', 'tech', 'technology', 'software']),
  ('Insurance', ARRAY['insurance', 'insurtech']),
  ('Legal Services', ARRAY['legal', 'law', 'attorney', 'lawyer']),
  ('Logistics & Transportation', ARRAY['logistics', 'transportation', 'shipping']),
  ('Manufacturing', ARRAY['manufacturing', 'industrial', 'factory']),
  ('Non-Profit & NGO', ARRAY['nonprofit', 'ngo', 'charity']),
  ('Real Estate & Property', ARRAY['real estate', 'property', 'realty']),
  ('Restaurants & Food Service', ARRAY['restaurant', 'food service', 'dining']),
  ('SaaS & Software', ARRAY['saas', 'software', 'app']),
  ('Sports & Recreation', ARRAY['sports', 'recreation', 'fitness']),
  ('Telecommunications', ARRAY['telecom', 'telecommunications', 'telco']),
  ('Travel & Leisure', ARRAY['travel', 'leisure', 'vacation']),
  ('Other', ARRAY[]::text[])
ON CONFLICT (name) DO NOTHING;
-- RLS for industry_verticals (public read)
ALTER TABLE public.industry_verticals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read verticals"
  ON public.industry_verticals
  FOR SELECT
  USING (true);
-- Update create_default_tenant_and_workspace to add admin role and default segments
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

  -- Create default segments for the tenant
  INSERT INTO tenant_segments (tenant_id, name, code, description, is_default)
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
