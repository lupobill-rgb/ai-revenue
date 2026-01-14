-- Create table to store user Gmail OAuth tokens
CREATE TABLE public.user_gmail_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);
-- Enable RLS
ALTER TABLE public.user_gmail_tokens ENABLE ROW LEVEL SECURITY;
-- Users can only see their own tokens
CREATE POLICY "Users can view their own gmail tokens"
  ON public.user_gmail_tokens
  FOR SELECT
  USING (auth.uid() = user_id);
-- Users can insert their own tokens
CREATE POLICY "Users can insert their own gmail tokens"
  ON public.user_gmail_tokens
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);
-- Users can update their own tokens
CREATE POLICY "Users can update their own gmail tokens"
  ON public.user_gmail_tokens
  FOR UPDATE
  USING (auth.uid() = user_id);
-- Users can delete their own tokens
CREATE POLICY "Users can delete their own gmail tokens"
  ON public.user_gmail_tokens
  FOR DELETE
  USING (auth.uid() = user_id);
-- Add trigger for updated_at
CREATE TRIGGER update_user_gmail_tokens_updated_at
  BEFORE UPDATE ON public.user_gmail_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
