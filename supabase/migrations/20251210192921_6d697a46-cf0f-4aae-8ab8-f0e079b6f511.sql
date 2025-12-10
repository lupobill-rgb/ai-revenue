-- CRM Leads: Pipeline entries tied to contacts and campaigns
CREATE TABLE crm_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  contact_id uuid NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
  campaign_id uuid NULL REFERENCES campaigns(id) ON DELETE SET NULL,
  source text, -- e.g. 'landing_page:saas-ai-cmo', 'voice:outbound', 'manual'
  status text CHECK (status IN ('new','working','qualified','unqualified','converted')) DEFAULT 'new',
  score integer DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE crm_leads ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tenant isolation
CREATE POLICY "tenant_read_leads"
  ON crm_leads FOR SELECT
  USING (tenant_id = auth.uid() OR tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()));

CREATE POLICY "tenant_insert_leads"
  ON crm_leads FOR INSERT
  WITH CHECK (tenant_id = auth.uid() OR tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()));

CREATE POLICY "tenant_update_leads"
  ON crm_leads FOR UPDATE
  USING (tenant_id = auth.uid() OR tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()));

CREATE POLICY "tenant_delete_leads"
  ON crm_leads FOR DELETE
  USING (tenant_id = auth.uid() OR tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()));

-- Updated_at trigger
CREATE TRIGGER set_crm_leads_updated_at
BEFORE UPDATE ON crm_leads
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- Indexes for common lookups
CREATE INDEX idx_crm_leads_tenant ON crm_leads(tenant_id);
CREATE INDEX idx_crm_leads_contact ON crm_leads(contact_id);
CREATE INDEX idx_crm_leads_campaign ON crm_leads(campaign_id);
CREATE INDEX idx_crm_leads_status ON crm_leads(status);
CREATE INDEX idx_crm_leads_source ON crm_leads(source);