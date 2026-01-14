-- Add optimization tracking fields to cmo_campaigns
ALTER TABLE public.cmo_campaigns 
ADD COLUMN IF NOT EXISTS last_optimization_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS last_optimization_note text;
-- Create campaign_optimizations table for detailed optimization history
CREATE TABLE IF NOT EXISTS public.campaign_optimizations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  campaign_id uuid NOT NULL REFERENCES public.cmo_campaigns(id) ON DELETE CASCADE,
  optimization_type text NOT NULL,
  changes jsonb NOT NULL DEFAULT '[]'::jsonb,
  summary text,
  metrics_snapshot jsonb DEFAULT '{}'::jsonb,
  applied_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
-- Enable RLS
ALTER TABLE public.campaign_optimizations ENABLE ROW LEVEL SECURITY;
-- Create tenant isolation policy
CREATE POLICY "tenant_isolation" ON public.campaign_optimizations
FOR ALL USING (
  (tenant_id = auth.uid()) OR 
  (tenant_id IN (SELECT user_tenants.tenant_id FROM user_tenants WHERE user_tenants.user_id = auth.uid()))
);
-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_campaign_optimizations_campaign_id ON public.campaign_optimizations(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_optimizations_tenant_id ON public.campaign_optimizations(tenant_id);
