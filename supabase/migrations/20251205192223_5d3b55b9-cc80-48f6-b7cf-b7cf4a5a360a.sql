-- Create team_invitations table for managing workspace team members
CREATE TABLE public.team_invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'editor',
  status TEXT NOT NULL DEFAULT 'pending',
  invited_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  invited_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(email, workspace_id)
);
-- Enable RLS
ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;
-- RLS policies - users can manage invitations they created or belong to their workspace
CREATE POLICY "Users can view invitations they created"
ON public.team_invitations
FOR SELECT
USING (invited_by = auth.uid());
CREATE POLICY "Users can create invitations"
ON public.team_invitations
FOR INSERT
WITH CHECK (invited_by = auth.uid());
CREATE POLICY "Users can update their invitations"
ON public.team_invitations
FOR UPDATE
USING (invited_by = auth.uid());
CREATE POLICY "Users can delete their invitations"
ON public.team_invitations
FOR DELETE
USING (invited_by = auth.uid());
-- Create trigger for updated_at
CREATE TRIGGER update_team_invitations_updated_at
BEFORE UPDATE ON public.team_invitations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
