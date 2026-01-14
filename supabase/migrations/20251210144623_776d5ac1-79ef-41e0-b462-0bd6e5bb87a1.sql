-- Add tenant_id column to team_invitations
ALTER TABLE public.team_invitations 
ADD COLUMN IF NOT EXISTS tenant_id UUID;
-- Create function to process invitation acceptance
CREATE OR REPLACE FUNCTION public.accept_team_invitation(_user_id UUID, _email TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_invitation RECORD;
  v_result JSONB;
BEGIN
  -- Find pending invitation for this email
  SELECT * INTO v_invitation
  FROM team_invitations
  WHERE LOWER(email) = LOWER(_email)
    AND status = 'pending'
  ORDER BY invited_at DESC
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'No pending invitation found');
  END IF;
  
  -- Update invitation status
  UPDATE team_invitations
  SET status = 'accepted',
      accepted_at = now(),
      updated_at = now()
  WHERE id = v_invitation.id;
  
  -- Add user to user_tenants (use tenant_id if available, otherwise use invited_by as tenant)
  INSERT INTO user_tenants (user_id, tenant_id, role)
  VALUES (
    _user_id, 
    COALESCE(v_invitation.tenant_id, v_invitation.invited_by),
    v_invitation.role
  )
  ON CONFLICT (user_id, tenant_id) DO UPDATE
  SET role = EXCLUDED.role;
  
  RETURN jsonb_build_object(
    'accepted', true, 
    'tenant_id', COALESCE(v_invitation.tenant_id, v_invitation.invited_by),
    'role', v_invitation.role
  );
END;
$$;
-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.accept_team_invitation(UUID, TEXT) TO authenticated;
-- Update RLS policy for team_invitations to allow tenant-based access
DROP POLICY IF EXISTS "Users can view their tenant invitations" ON public.team_invitations;
DROP POLICY IF EXISTS "Users can create tenant invitations" ON public.team_invitations;
DROP POLICY IF EXISTS "Users can update tenant invitations" ON public.team_invitations;
DROP POLICY IF EXISTS "Users can delete tenant invitations" ON public.team_invitations;
CREATE POLICY "Users can view their tenant invitations" 
ON public.team_invitations 
FOR SELECT 
USING (
  invited_by = auth.uid() 
  OR tenant_id = auth.uid()
  OR tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid())
);
CREATE POLICY "Users can create tenant invitations" 
ON public.team_invitations 
FOR INSERT 
WITH CHECK (invited_by = auth.uid());
CREATE POLICY "Users can update tenant invitations" 
ON public.team_invitations 
FOR UPDATE 
USING (
  invited_by = auth.uid() 
  OR tenant_id = auth.uid()
  OR tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid())
);
CREATE POLICY "Users can delete tenant invitations" 
ON public.team_invitations 
FOR DELETE 
USING (
  invited_by = auth.uid() 
  OR tenant_id = auth.uid()
  OR tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid())
);
