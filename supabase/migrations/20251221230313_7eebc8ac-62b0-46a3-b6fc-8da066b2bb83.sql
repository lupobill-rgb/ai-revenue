-- Grant execute permission to authenticated role for the HS metrics RPC
GRANT EXECUTE ON FUNCTION public.get_horizontal_scaling_metrics(integer) TO authenticated;