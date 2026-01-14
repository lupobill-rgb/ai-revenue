import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
};

function requireAuthorized(req: Request) {
  const internalSecret = req.headers.get("x-internal-secret");
  const expected = Deno.env.get("INTERNAL_FUNCTION_SECRET") || Deno.env.get("INTERNAL_FUNCTION_SECRET_VAULT") || "";
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

  const hasValidInternalSecret = !!internalSecret && internalSecret === expected;
  const hasValidServiceRole = !!authHeader && authHeader.startsWith("Bearer ") && authHeader.slice(7) === serviceRoleKey;
  if (!hasValidInternalSecret && !hasValidServiceRole) throw new Error("Unauthorized");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    requireAuthorized(req);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Stub: just query counts so operators can wire scheduling safely.
    const { count: failuresCount, error: failuresErr } = await supabase
      .from("action_events")
      .select("id", { count: "exact", head: true })
      .in("event_type", ["execution_failed", "verification_failed"]);
    if (failuresErr) throw new Error(failuresErr.message);

    const { count: weeklyCount, error: weeklyErr } = await supabase
      .from("weekly_summaries")
      .select("id", { count: "exact", head: true });
    if (weeklyErr) throw new Error(weeklyErr.message);

    return new Response(JSON.stringify({ ok: true, failuresCount: failuresCount || 0, weeklySummariesCount: weeklyCount || 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    const msg = e?.message ? String(e.message) : "Unknown error";
    const status = msg === "Unauthorized" ? 401 : 500;
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

