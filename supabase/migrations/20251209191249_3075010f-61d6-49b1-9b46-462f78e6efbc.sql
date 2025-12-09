-- Create customer integration settings table
CREATE TABLE public.customer_integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  
  -- Email settings
  email_from_address TEXT,
  email_from_name TEXT,
  email_reply_to TEXT,
  email_domain_verified BOOLEAN DEFAULT false,
  
  -- LinkedIn settings
  linkedin_profile_url TEXT,
  linkedin_daily_connect_limit INTEGER DEFAULT 20,
  linkedin_daily_message_limit INTEGER DEFAULT 50,
  
  -- Calendar settings
  calendar_booking_url TEXT,
  calendar_provider TEXT, -- 'calendly', 'hubspot', 'cal.com', 'custom'
  
  -- CRM webhooks
  crm_inbound_webhook_url TEXT,
  crm_outbound_webhook_url TEXT,
  crm_webhook_secret TEXT,
  
  -- Custom domain
  custom_domain TEXT,
  custom_domain_verified BOOLEAN DEFAULT false,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  UNIQUE(workspace_id)
);

-- Enable RLS
ALTER TABLE public.customer_integrations ENABLE ROW LEVEL SECURITY;

-- RLS policy for tenant isolation
CREATE POLICY "tenant_isolation" ON public.customer_integrations
  FOR ALL
  USING (
    tenant_id = auth.uid() OR 
    tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid())
  );

-- Create updated_at trigger
CREATE TRIGGER update_customer_integrations_updated_at
  BEFORE UPDATE ON public.customer_integrations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();