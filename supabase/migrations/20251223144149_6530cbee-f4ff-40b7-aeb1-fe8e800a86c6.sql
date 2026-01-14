-- Create internal secret in vault for cron job authentication
SELECT vault.create_secret(
  'ubigrowth-internal-2024-secure-key',
  'INTERNAL_FUNCTION_SECRET',
  'Internal secret for authenticating cron job calls to edge functions'
);
