-- Create channel preferences table for users to enable/disable marketing channels
CREATE TABLE public.channel_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  email_enabled BOOLEAN NOT NULL DEFAULT true,
  social_enabled BOOLEAN NOT NULL DEFAULT true,
  voice_enabled BOOLEAN NOT NULL DEFAULT true,
  video_enabled BOOLEAN NOT NULL DEFAULT true,
  landing_pages_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.channel_preferences ENABLE ROW LEVEL SECURITY;

-- Users can view their own channel preferences
CREATE POLICY "Users can view their own channel preferences"
ON public.channel_preferences
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own channel preferences
CREATE POLICY "Users can insert their own channel preferences"
ON public.channel_preferences
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own channel preferences
CREATE POLICY "Users can update their own channel preferences"
ON public.channel_preferences
FOR UPDATE
USING (auth.uid() = user_id);

-- Add updated_at trigger
CREATE TRIGGER update_channel_preferences_updated_at
BEFORE UPDATE ON public.channel_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();