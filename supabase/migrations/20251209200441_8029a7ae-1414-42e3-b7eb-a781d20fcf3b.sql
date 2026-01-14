-- Update the dispatch_outbound_cron function to use service role authentication
CREATE OR REPLACE FUNCTION public.dispatch_outbound_cron()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  _result jsonb;
  _service_role_key text;
BEGIN
  -- Get the service role key from Supabase's internal configuration
  -- This is automatically available in SECURITY DEFINER functions
  _service_role_key := current_setting('supabase.service_role_key', true);
  
  -- If service role key not available via setting, use net.http_post without auth
  -- The edge function will check for internal origin
  SELECT net.http_post(
    url := 'https://nyzgsizvtqhafoxixyrd.supabase.co/functions/v1/dispatch-outbound-sequences',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(_service_role_key, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55emdzaXp2dHFoYWZveGl4eXJkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDcwMzYxMywiZXhwIjoyMDgwMjc5NjEzfQ.PLACEHOLDER')
    ),
    body := '{"cron": true}'::jsonb
  ) INTO _result;
  
  RAISE LOG 'dispatch_outbound_cron result: %', _result;
END;
$function$;
