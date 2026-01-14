-- Function to initialize default email settings for new workspaces
-- This ensures every tenant has safe defaults so customer replies don't cross over

CREATE OR REPLACE FUNCTION public.create_default_email_settings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create default email settings for the new workspace
  -- The from_address and reply_to_address are left empty to force explicit configuration
  -- But we set reasonable defaults for other fields
  INSERT INTO ai_settings_email (
    tenant_id,
    sender_name,
    from_address,
    reply_to_address,
    email_provider,
    is_connected,
    updated_at
  )
  VALUES (
    NEW.id,
    '', -- Empty to prompt user to fill in
    '', -- Empty to ensure no accidental crossover
    '', -- Empty to ensure no accidental crossover  
    'resend', -- Default provider
    false, -- Not connected until configured
    now()
  )
  ON CONFLICT (tenant_id) DO NOTHING;

  RETURN NEW;
END;
$$;
-- Create trigger to auto-provision email settings when workspace is created
DROP TRIGGER IF EXISTS create_email_settings_on_workspace ON workspaces;
CREATE TRIGGER create_email_settings_on_workspace
  AFTER INSERT ON workspaces
  FOR EACH ROW
  EXECUTE FUNCTION create_default_email_settings();
