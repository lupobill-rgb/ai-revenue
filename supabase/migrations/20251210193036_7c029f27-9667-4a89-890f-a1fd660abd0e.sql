-- CRM Activities: Timeline of all interactions
CREATE TABLE crm_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  contact_id uuid NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
  lead_id uuid NULL REFERENCES crm_leads(id) ON DELETE SET NULL,
  activity_type text CHECK (
    activity_type IN (
      'landing_form_submit',
      'email_sent',
      'email_open',
      'email_reply',
      'sms_sent',
      'sms_reply',
      'voice_call',
      'meeting_booked',
      'status_change',
      'note'
    )
  ) NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE crm_activities ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tenant isolation
CREATE POLICY "tenant_read_activities"
  ON crm_activities FOR SELECT
  USING (tenant_id = auth.uid() OR tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()));

CREATE POLICY "tenant_insert_activities"
  ON crm_activities FOR INSERT
  WITH CHECK (tenant_id = auth.uid() OR tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()));

CREATE POLICY "tenant_update_activities"
  ON crm_activities FOR UPDATE
  USING (tenant_id = auth.uid() OR tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()));

CREATE POLICY "tenant_delete_activities"
  ON crm_activities FOR DELETE
  USING (tenant_id = auth.uid() OR tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()));

-- Indexes for common lookups
CREATE INDEX idx_crm_activities_tenant ON crm_activities(tenant_id);
CREATE INDEX idx_crm_activities_contact ON crm_activities(contact_id);
CREATE INDEX idx_crm_activities_lead ON crm_activities(lead_id);
CREATE INDEX idx_crm_activities_type ON crm_activities(activity_type);
CREATE INDEX idx_crm_activities_created ON crm_activities(created_at DESC);