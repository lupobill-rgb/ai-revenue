-- Allow authenticated users (JWT-present) to execute HS metrics RPC
GRANT EXECUTE ON FUNCTION public.get_horizontal_scaling_metrics(integer) TO authenticated;

-- Optional: if you want platform admins to call from client contexts that map to anon (rare), also grant to anon
-- GRANT EXECUTE ON FUNCTION public.get_horizontal_scaling_metrics(integer) TO anon;