import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const responseHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...corsHeaders,
  };

  // 1. Check Authorization header - must return 401 if missing
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    console.warn("hs-metrics: Missing authorization header");
    return new Response(
      JSON.stringify({ error: "Missing authorization header" }),
      { status: 401, headers: responseHeaders }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Use service client to verify user token and check platform admin
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Extract token and verify user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await serviceClient.auth.getUser(token);

    if (authError || !user) {
      console.error("hs-metrics: Auth error:", authError?.message || "No user");
      return new Response(
        JSON.stringify({ error: "Access denied - authentication failed" }),
        { status: 403, headers: responseHeaders }
      );
    }

    // Check if user is platform admin by querying the table directly
    const { data: adminData } = await serviceClient
      .from("platform_admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!adminData) {
      console.warn("hs-metrics: Access denied - not platform admin:", user.id);
      return new Response(
        JSON.stringify({ error: "Access denied - platform admin required" }),
        { status: 403, headers: responseHeaders }
      );
    }

    console.log("hs-metrics: User authenticated as platform admin:", user.id);

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

    // 5. Call the RPC with service client
    const { data, error } = await serviceClient.rpc("get_horizontal_scaling_metrics", {
      p_window_minutes: windowMinutes,
    });

    if (error) {
      console.error("hs-metrics: RPC error:", error.message);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: responseHeaders }
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
      { status: 200, headers: responseHeaders }
    );
  } catch (err) {
    console.error("hs-metrics: Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: responseHeaders }
    );
  }
});
