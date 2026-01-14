-- Email settings table
CREATE TABLE IF NOT EXISTS public.ai_settings_email (
  tenant_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_name text NOT NULL DEFAULT '',
  from_address text NOT NULL DEFAULT '',
  reply_to_address text NOT NULL DEFAULT '',
  smtp_host text,
  smtp_port integer,
  smtp_username text,
  smtp_password text,
  updated_at timestamptz DEFAULT now()
);
-- LinkedIn settings table
CREATE TABLE IF NOT EXISTS public.ai_settings_linkedin (
  tenant_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  linkedin_profile_url text NOT NULL DEFAULT '',
  daily_connection_limit integer NOT NULL DEFAULT 20,
  daily_message_limit integer NOT NULL DEFAULT 50,
  updated_at timestamptz DEFAULT now()
);
-- Calendar settings table
CREATE TABLE IF NOT EXISTS public.ai_settings_calendar (
  tenant_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  calendar_provider text NOT NULL DEFAULT 'google',
  booking_url text NOT NULL DEFAULT '',
  updated_at timestamptz DEFAULT now()
);
-- CRM Webhooks settings table
CREATE TABLE IF NOT EXISTS public.ai_settings_crm_webhooks (
  tenant_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  inbound_webhook_url text,
  outbound_webhook_url text,
  updated_at timestamptz DEFAULT now()
);
-- Custom Domain settings table
CREATE TABLE IF NOT EXISTS public.ai_settings_domain (
  tenant_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  domain text NOT NULL DEFAULT '',
  cname_verified boolean DEFAULT false,
  updated_at timestamptz DEFAULT now()
);
-- Enable RLS on all tables
ALTER TABLE public.ai_settings_email ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_settings_linkedin ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_settings_calendar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_settings_crm_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_settings_domain ENABLE ROW LEVEL SECURITY;
-- RLS policies for ai_settings_email
CREATE POLICY "Users can view their own email settings"
  ON public.ai_settings_email FOR SELECT
  USING (tenant_id = auth.uid());
CREATE POLICY "Users can insert their own email settings"
  ON public.ai_settings_email FOR INSERT
  WITH CHECK (tenant_id = auth.uid());
CREATE POLICY "Users can update their own email settings"
  ON public.ai_settings_email FOR UPDATE
  USING (tenant_id = auth.uid());
-- RLS policies for ai_settings_linkedin
CREATE POLICY "Users can view their own linkedin settings"
  ON public.ai_settings_linkedin FOR SELECT
  USING (tenant_id = auth.uid());
CREATE POLICY "Users can insert their own linkedin settings"
  ON public.ai_settings_linkedin FOR INSERT
  WITH CHECK (tenant_id = auth.uid());
CREATE POLICY "Users can update their own linkedin settings"
  ON public.ai_settings_linkedin FOR UPDATE
  USING (tenant_id = auth.uid());
-- RLS policies for ai_settings_calendar
CREATE POLICY "Users can view their own calendar settings"
  ON public.ai_settings_calendar FOR SELECT
  USING (tenant_id = auth.uid());
CREATE POLICY "Users can insert their own calendar settings"
  ON public.ai_settings_calendar FOR INSERT
  WITH CHECK (tenant_id = auth.uid());
CREATE POLICY "Users can update their own calendar settings"
  ON public.ai_settings_calendar FOR UPDATE
  USING (tenant_id = auth.uid());
-- RLS policies for ai_settings_crm_webhooks
CREATE POLICY "Users can view their own crm webhook settings"
  ON public.ai_settings_crm_webhooks FOR SELECT
  USING (tenant_id = auth.uid());
CREATE POLICY "Users can insert their own crm webhook settings"
  ON public.ai_settings_crm_webhooks FOR INSERT
  WITH CHECK (tenant_id = auth.uid());
CREATE POLICY "Users can update their own crm webhook settings"
  ON public.ai_settings_crm_webhooks FOR UPDATE
  USING (tenant_id = auth.uid());
-- RLS policies for ai_settings_domain
CREATE POLICY "Users can view their own domain settings"
  ON public.ai_settings_domain FOR SELECT
  USING (tenant_id = auth.uid());
CREATE POLICY "Users can insert their own domain settings"
  ON public.ai_settings_domain FOR INSERT
  WITH CHECK (tenant_id = auth.uid());
CREATE POLICY "Users can update their own domain settings"
  ON public.ai_settings_domain FOR UPDATE
  USING (tenant_id = auth.uid());
