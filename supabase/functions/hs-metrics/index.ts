import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Restrict CORS to allowed origins
const ALLOWED_ORIGINS = [
  "https://cmo.ubigrowth.ai",
  "https://ubigrowth.ai",
  "https://www.ubigrowth.ai",
  "http://localhost:5173",
  "http://localhost:3000",
];

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // 1. Check Authorization header
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    console.warn("hs-metrics: Missing authorization header");
    return new Response(
      JSON.stringify({ error: "Missing authorization header" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // 2. Create user client to verify auth and check platform admin
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // 3. Check if user is platform admin
    const { data: isAdmin, error: adminError } = await userClient.rpc("is_platform_admin");
    
    if (adminError) {
      console.error("hs-metrics: Admin check error:", adminError.message);
      return new Response(
        JSON.stringify({ error: "Failed to verify admin status" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!isAdmin) {
      console.warn("hs-metrics: Access denied - not platform admin");
      return new Response(
        JSON.stringify({ error: "Access denied - platform admin required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Parse window_minutes from request body
    let windowMinutes = 5;
    try {
      const body = await req.json();
      if (body.window_minutes && typeof body.window_minutes === "number") {
        windowMinutes = Math.min(Math.max(body.window_minutes, 1), 60); // Clamp 1-60
      }
    } catch {
      // No body or invalid JSON, use default
    }

    // 5. Create service_role client to call the RPC
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error } = await serviceClient.rpc("get_horizontal_scaling_metrics", {
      p_window_minutes: windowMinutes,
    });

    if (error) {
      console.error("hs-metrics: RPC error:", error.message);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("hs-metrics: Fetched successfully", {
      workers_count: data?.workers?.length ?? 0,
      queue_stats: data?.queue_stats,
      oldest_age: data?.oldest_queued_age_seconds,
      duplicate_groups: data?.duplicate_groups_last_hour,
    });

    return new Response(
      JSON.stringify({ success: true, data }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("hs-metrics: Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
