-- CRM Contacts: Single source of truth for all contacts (prospects + customers)
CREATE TABLE IF NOT EXISTS crm_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  email text,
  phone text,
  first_name text,
  last_name text,
  company_name text,
  role_title text,
  status text CHECK (status IN ('prospect','customer','inactive')) DEFAULT 'prospect',
  lifecycle_stage text, -- lead, MQL, SQL, Opp, Customer, etc.
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE crm_contacts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tenant isolation
CREATE POLICY "tenant_read_contacts"
  ON crm_contacts FOR SELECT
  USING (tenant_id = auth.uid() OR tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()));

CREATE POLICY "tenant_insert_contacts"
  ON crm_contacts FOR INSERT
  WITH CHECK (tenant_id = auth.uid() OR tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()));

CREATE POLICY "tenant_update_contacts"
  ON crm_contacts FOR UPDATE
  USING (tenant_id = auth.uid() OR tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()));

CREATE POLICY "tenant_delete_contacts"
  ON crm_contacts FOR DELETE
  USING (tenant_id = auth.uid() OR tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()));

-- Updated_at trigger (reuse existing function or create if needed)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_crm_contacts_updated_at
BEFORE UPDATE ON crm_contacts
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- Index for common lookups
CREATE INDEX idx_crm_contacts_tenant ON crm_contacts(tenant_id);
CREATE INDEX idx_crm_contacts_email ON crm_contacts(email);
CREATE INDEX idx_crm_contacts_status ON crm_contacts(status);