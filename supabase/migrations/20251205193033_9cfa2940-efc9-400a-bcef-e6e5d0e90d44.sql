-- Create table to track users requiring password change
CREATE TABLE public.user_password_resets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  force_change BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_password_resets ENABLE ROW LEVEL SECURITY;

-- Users can only read/update their own record
CREATE POLICY "Users can view their own password reset status"
ON public.user_password_resets
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can update their own password reset status"
ON public.user_password_resets
FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

-- Trigger for updated_at
CREATE TRIGGER update_user_password_resets_updated_at
BEFORE UPDATE ON public.user_password_resets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to check if user must change password (SECURITY DEFINER to bypass RLS)
CREATE OR REPLACE FUNCTION public.must_change_password(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT COALESCE(
    (SELECT force_change FROM public.user_password_resets WHERE user_id = _user_id),
    false
  )
$$;