import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get auth header to verify user is platform admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Create user client to verify auth
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    // Check if user is platform admin
    const { data: isAdmin, error: adminError } = await userClient.rpc("is_platform_admin");
    if (adminError || !isAdmin) {
      console.log("Access denied - not platform admin:", adminError?.message);
      return new Response(
        JSON.stringify({ error: "Access denied - platform admin required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse window_minutes from request body
    let windowMinutes = 5;
    try {
      const body = await req.json();
      if (body.window_minutes && typeof body.window_minutes === "number") {
        windowMinutes = body.window_minutes;
      }
    } catch {
      // No body or invalid JSON, use default
    }

    // Create service_role client to call the RPC
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error } = await serviceClient.rpc("get_horizontal_scaling_metrics", {
      p_window_minutes: windowMinutes,
    });

    if (error) {
      console.error("RPC error:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("HS metrics fetched successfully:", {
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
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
