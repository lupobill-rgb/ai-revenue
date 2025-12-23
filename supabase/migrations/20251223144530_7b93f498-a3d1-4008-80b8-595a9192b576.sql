-- Delete old vault secret and recreate with matching value
-- First delete existing
DELETE FROM vault.secrets WHERE name = 'INTERNAL_FUNCTION_SECRET';

-- User will need to ensure Cloud secret INTERNAL_FUNCTION_SECRET matches this value
SELECT vault.create_secret(
  'ubigrowth-internal-2024-secure-key',
  'INTERNAL_FUNCTION_SECRET',
  'Internal secret for authenticating cron job calls to edge functions'
);