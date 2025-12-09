
-- Add updated_at column to outbound_sequence_runs for tracking last modification
ALTER TABLE public.outbound_sequence_runs
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Create trigger to auto-update timestamp
CREATE OR REPLACE FUNCTION public.update_outbound_sequence_runs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_outbound_sequence_runs_updated_at ON public.outbound_sequence_runs;
CREATE TRIGGER update_outbound_sequence_runs_updated_at
  BEFORE UPDATE ON public.outbound_sequence_runs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_outbound_sequence_runs_updated_at();
