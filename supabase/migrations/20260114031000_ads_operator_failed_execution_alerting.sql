-- ============================================================================
-- Ads Operator: alerting for failed executions
-- - Poll via pg_cron every 5 minutes
-- - Send one notification per failure event (no retries, no suppression of distinct events)
-- ============================================================================

-- Track which action_events have already triggered an alert
CREATE TABLE IF NOT EXISTS public.ads_operator_alerts_sent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_event_id uuid NOT NULL REFERENCES public.action_events(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  ad_account_id uuid NOT NULL REFERENCES public.ad_accounts(id) ON DELETE CASCADE,
  notified_at timestamptz NOT NULL DEFAULT now(),
  channels jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (action_event_id)
);

ALTER TABLE public.ads_operator_alerts_sent ENABLE ROW LEVEL SECURITY;
-- No RLS policies: service role only.

CREATE INDEX IF NOT EXISTS idx_ads_operator_alerts_sent_notified_at
  ON public.ads_operator_alerts_sent (notified_at DESC);

-- Cron shim to invoke the Edge Function
CREATE OR REPLACE FUNCTION public.ads_operator_alerts_cron()
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
  -- Internal secret from vault - REQUIRED
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
    url := _supabase_url || '/functions/v1/ads-operator-alerts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', _internal_secret
    ),
    body := jsonb_build_object('source', 'pg_cron')
  ) INTO _result;

  RAISE LOG 'ads_operator_alerts_cron invoked';
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.ads_operator_alerts_cron() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ads_operator_alerts_cron() FROM anon;
REVOKE EXECUTE ON FUNCTION public.ads_operator_alerts_cron() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.ads_operator_alerts_cron() TO postgres;

-- Schedule every 5 minutes
SELECT cron.schedule(
  'ads-operator-alerts-every-5-min',
  '*/5 * * * *',
  $$ SELECT public.ads_operator_alerts_cron(); $$
);

