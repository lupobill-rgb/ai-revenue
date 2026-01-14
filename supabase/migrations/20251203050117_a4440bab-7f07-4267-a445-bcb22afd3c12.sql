-- Add workspace-level password hash for public forms (per-tenant gating)
ALTER TABLE public.workspaces
ADD COLUMN IF NOT EXISTS public_form_password_hash text;
