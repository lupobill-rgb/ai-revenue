-- Centralized RPC for contact/lead upsert across all channels
CREATE OR REPLACE FUNCTION crm_upsert_contact_and_lead(
  in_tenant_id uuid,
  in_email text,
  in_phone text,
  in_first_name text,
  in_last_name text,
  in_company text,
  in_job_title text,
  in_campaign_id uuid,
  in_source text
)
RETURNS TABLE(contact_id uuid, lead_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_id uuid;
  l_id uuid;
BEGIN
  -- 1) Find or create contact by tenant + email
  SELECT id INTO c_id
  FROM crm_contacts
  WHERE tenant_id = in_tenant_id
    AND email = in_email
    AND in_email IS NOT NULL
  LIMIT 1;

  IF c_id IS NULL THEN
    -- Create new contact
    INSERT INTO crm_contacts (
      tenant_id, email, phone, first_name, last_name, company, job_title
    ) VALUES (
      in_tenant_id, in_email, in_phone, in_first_name, in_last_name, in_company, in_job_title
    )
    RETURNING id INTO c_id;
  ELSE
    -- Update existing contact with non-null values
    UPDATE crm_contacts
    SET
      phone = COALESCE(in_phone, phone),
      first_name = COALESCE(in_first_name, first_name),
      last_name = COALESCE(in_last_name, last_name),
      company = COALESCE(in_company, company),
      job_title = COALESCE(in_job_title, job_title),
      updated_at = now()
    WHERE id = c_id;
  END IF;

  -- 2) Create a new lead (allows multiple leads per contact from different sources)
  INSERT INTO crm_leads (
    tenant_id, contact_id, campaign_id, source, status
  ) VALUES (
    in_tenant_id, c_id, in_campaign_id, in_source, 'new'
  )
  RETURNING id INTO l_id;

  RETURN QUERY SELECT c_id, l_id;
END;
$$;