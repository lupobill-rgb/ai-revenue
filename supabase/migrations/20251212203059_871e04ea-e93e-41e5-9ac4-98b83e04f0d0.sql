-- Create RPC to resume sequence for a lead
CREATE OR REPLACE FUNCTION resume_sequence_for_lead(
  _lead_id uuid,
  _user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update outbound_sequence_runs for this lead's prospect
  UPDATE outbound_sequence_runs osr
  SET status = 'active',
      updated_at = now()
  FROM prospects p
  WHERE osr.prospect_id = p.id
    AND p.lead_id = _lead_id
    AND osr.status = 'paused';

  -- Log activity in lead_activities (used by EnhancedTimeline)
  INSERT INTO lead_activities(lead_id, activity_type, description, created_by, workspace_id)
  SELECT _lead_id, 'sequence_resumed', 'Outbound sequence resumed manually', _user_id, l.workspace_id
  FROM leads l WHERE l.id = _lead_id;
END;
$$;