-- Update the dispatch_outbound_cron function to use the vault secret
CREATE OR REPLACE FUNCTION public.dispatch_outbound_cron()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  _result jsonb;
  _secret text;
BEGIN
  -- Get the secret from vault
  SELECT decrypted_secret INTO _secret 
  FROM vault.decrypted_secrets 
  WHERE name = 'INTERNAL_FUNCTION_SECRET' 
  LIMIT 1;
  
  -- Call the edge function with the secret
  SELECT net.http_post(
    url := 'https://nyzgsizvtqhafoxixyrd.supabase.co/functions/v1/dispatch-outbound-sequences',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', COALESCE(_secret, 'cron-dispatch-secret-2024')
    ),
    body := '{"cron": true}'::jsonb
  ) INTO _result;
  
  RAISE LOG 'dispatch_outbound_cron result: %', _result;
END;
$function$;
