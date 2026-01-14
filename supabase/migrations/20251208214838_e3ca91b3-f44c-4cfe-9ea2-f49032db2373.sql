-- Create notifications table for real-time notifications
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'new_lead', 'approval_needed', 'campaign_completed', 'email_opened', etc.
  title TEXT NOT NULL,
  message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
-- RLS policies
CREATE POLICY "Users can view their workspace notifications"
ON public.notifications FOR SELECT
USING (user_has_workspace_access(workspace_id));
CREATE POLICY "Users can update their workspace notifications"
ON public.notifications FOR UPDATE
USING (user_has_workspace_access(workspace_id));
CREATE POLICY "Users can delete their workspace notifications"
ON public.notifications FOR DELETE
USING (user_has_workspace_access(workspace_id));
CREATE POLICY "System can insert notifications"
ON public.notifications FOR INSERT
WITH CHECK (user_has_workspace_access(workspace_id));
-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
-- Create index for faster queries
CREATE INDEX idx_notifications_workspace_unread ON public.notifications(workspace_id, read_at) WHERE read_at IS NULL;
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);
