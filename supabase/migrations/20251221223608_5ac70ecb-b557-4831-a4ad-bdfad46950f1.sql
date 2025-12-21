-- Address database linter warnings: set immutable search_path on public functions

ALTER FUNCTION public.crm_map_outcome_to_status(in_outcome text)
SET search_path = public;

ALTER FUNCTION public.update_outbound_sequence_runs_updated_at()
SET search_path = public;
