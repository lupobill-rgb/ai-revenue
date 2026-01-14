-- Add lifecycle_stage to crm_contacts for tracking customer journey
ALTER TABLE crm_contacts 
ADD COLUMN IF NOT EXISTS lifecycle_stage text 
CHECK (lifecycle_stage IN ('subscriber', 'lead', 'mql', 'sql', 'opportunity', 'customer', 'evangelist'))
DEFAULT 'lead';
-- RPC for promoting contact to customer status (deal close / conversion)
CREATE OR REPLACE FUNCTION crm_promote_to_customer(
  in_tenant_id uuid,
  in_contact_id uuid,
  in_lead_id uuid DEFAULT NULL,
  in_meta jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_status text;
  old_lifecycle text;
BEGIN
  -- Get current values for audit
  SELECT status, lifecycle_stage 
  INTO old_status, old_lifecycle
  FROM crm_contacts
  WHERE id = in_contact_id AND tenant_id = in_tenant_id;

  -- Update contact to customer
  UPDATE crm_contacts
  SET 
    status = 'customer',
    lifecycle_stage = 'customer',
    updated_at = now()
  WHERE id = in_contact_id AND tenant_id = in_tenant_id;

  -- If lead provided, mark as converted
  IF in_lead_id IS NOT NULL THEN
    UPDATE crm_leads
    SET 
      status = 'converted',
      updated_at = now()
    WHERE id = in_lead_id AND tenant_id = in_tenant_id;
  END IF;

  -- Log the status change activity
  INSERT INTO crm_activities (
    tenant_id, contact_id, lead_id, activity_type, meta
  ) VALUES (
    in_tenant_id,
    in_contact_id,
    in_lead_id,
    'status_change',
    jsonb_build_object(
      'old_status', old_status,
      'new_status', 'customer',
      'old_lifecycle', old_lifecycle,
      'new_lifecycle', 'customer',
      'conversion_type', 'customer_promotion'
    ) || in_meta
  );
END;
$$;
-- Index for lifecycle_stage queries
CREATE INDEX IF NOT EXISTS idx_crm_contacts_lifecycle 
ON crm_contacts(tenant_id, lifecycle_stage);
