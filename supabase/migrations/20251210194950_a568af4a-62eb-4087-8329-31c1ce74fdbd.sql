-- Centralized RPC for logging activities and updating lead status
-- This is the single source of truth for all CRM updates
CREATE OR REPLACE FUNCTION crm_log_activity(
  in_tenant_id uuid,
  in_contact_id uuid,
  in_lead_id uuid,
  in_activity_type text,
  in_meta jsonb,
  in_new_status text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  activity_id uuid;
  old_status text;
BEGIN
  -- 1) If new status provided, update lead and log status change
  IF in_lead_id IS NOT NULL AND in_new_status IS NOT NULL THEN
    -- Get old status for comparison
    SELECT status INTO old_status
    FROM crm_leads
    WHERE id = in_lead_id AND tenant_id = in_tenant_id;

    -- Only update if status actually changed
    IF old_status IS DISTINCT FROM in_new_status THEN
      UPDATE crm_leads
      SET 
        status = in_new_status,
        updated_at = now()
      WHERE id = in_lead_id AND tenant_id = in_tenant_id;

      -- Log status change activity
      INSERT INTO crm_activities (
        tenant_id, contact_id, lead_id, activity_type, meta
      ) VALUES (
        in_tenant_id, 
        in_contact_id, 
        in_lead_id, 
        'status_change',
        jsonb_build_object(
          'old_status', old_status,
          'new_status', in_new_status,
          'triggered_by', in_activity_type
        )
      );
    END IF;
  END IF;

  -- 2) Log the main activity
  INSERT INTO crm_activities (
    tenant_id, contact_id, lead_id, activity_type, meta
  ) VALUES (
    in_tenant_id, in_contact_id, in_lead_id, in_activity_type, in_meta
  )
  RETURNING id INTO activity_id;

  -- 3) Update contact's updated_at timestamp
  IF in_contact_id IS NOT NULL THEN
    UPDATE crm_contacts
    SET updated_at = now()
    WHERE id = in_contact_id AND tenant_id = in_tenant_id;
  END IF;

  RETURN activity_id;
END;
$$;
-- Helper function for lead status updates with outcome mapping
CREATE OR REPLACE FUNCTION crm_map_outcome_to_status(
  in_outcome text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE in_outcome
    WHEN 'booked' THEN 'qualified'
    WHEN 'interested' THEN 'working'
    WHEN 'meeting_scheduled' THEN 'qualified'
    WHEN 'converted' THEN 'converted'
    WHEN 'not_interested' THEN 'unqualified'
    WHEN 'unsubscribed' THEN 'unqualified'
    ELSE 'working'  -- default for ongoing engagement
  END;
$$;
