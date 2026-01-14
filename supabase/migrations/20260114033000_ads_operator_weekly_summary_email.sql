-- ============================================================================
-- Ads Operator: weekly summary email (from weekly_summaries)
-- - Once per week per ad account
-- - No new metric calculations; uses weekly_summaries.summary payload
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ads_operator_weekly_emails_sent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  weekly_summary_id uuid NOT NULL REFERENCES public.weekly_summaries(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  ad_account_id uuid NOT NULL REFERENCES public.ad_accounts(id) ON DELETE CASCADE,
  week_start_date date NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  channels jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (weekly_summary_id)
);

ALTER TABLE public.ads_operator_weekly_emails_sent ENABLE ROW LEVEL SECURITY;
-- No policies: service role only.

CREATE INDEX IF NOT EXISTS idx_ads_operator_weekly_emails_sent_sent_at
  ON public.ads_operator_weekly_emails_sent (sent_at DESC);

CREATE OR REPLACE FUNCTION public.ads_operator_weekly_summary_email_cron()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  _result jsonb;
  _internal_secret text;
  _supabase_url text;
BEGIN
  SELECT decrypted_secret INTO _internal_secret
  FROM vault.decrypted_secrets
  WHERE name = 'INTERNAL_FUNCTION_SECRET'
  LIMIT 1;

  IF _internal_secret IS NULL THEN
    SELECT decrypted_secret INTO _internal_secret
    FROM vault.decrypted_secrets
    WHERE name = 'INTERNAL_FUNCTION_SECRET_VAULT'
    LIMIT 1;
  END IF;

  IF _internal_secret IS NULL THEN
    RAISE EXCEPTION 'INTERNAL_FUNCTION_SECRET not found in vault';
  END IF;

  _supabase_url := current_setting('app.supabase_url', true);
  IF _supabase_url IS NULL OR _supabase_url = '' THEN
    RAISE EXCEPTION 'app.supabase_url not configured';
  END IF;

  SELECT net.http_post(
    url := _supabase_url || '/functions/v1/ads-operator-weekly-summary-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', _internal_secret
    ),
    body := jsonb_build_object('source', 'pg_cron')
  ) INTO _result;

  RAISE LOG 'ads_operator_weekly_summary_email_cron invoked';
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.ads_operator_weekly_summary_email_cron() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ads_operator_weekly_summary_email_cron() FROM anon;
REVOKE EXECUTE ON FUNCTION public.ads_operator_weekly_summary_email_cron() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.ads_operator_weekly_summary_email_cron() TO postgres;

-- Schedule weekly (Mondays at 9:00 AM UTC)
SELECT cron.schedule(
  'ads-operator-weekly-summary-email',
  '0 9 * * 1',
  $$ SELECT public.ads_operator_weekly_summary_email_cron(); $$
);

