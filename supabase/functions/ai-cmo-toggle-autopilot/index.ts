import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveTenantContext } from "../_shared/tenant-context.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-workspace-id",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const campaignId = (body as any)?.campaignId;

    if (!campaignId) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing campaignId" }),
        { status: 400, headers: { ...corsHeaders, "content-type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request
    const enabled = (body as any)?.enabled;

    if (typeof enabled !== "boolean") {
      return new Response(
        JSON.stringify({ error: "enabled must be a boolean" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get tenant context (workspace -> tenant, no JWT tenant claim assumptions).
    let ctx: { tenantId: string; workspaceId: string; userId: string };
    try {
      ctx = await resolveTenantContext(req, supabase, { body, userId: user.id });
      if (!ctx.tenantId) throw new Error("Missing tenant_id");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unable to resolve tenant context";
      return new Response(JSON.stringify({ ok: false, error: msg, campaignId }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update campaign autopilot status (RLS enforces tenant access)
    const { data: campaign, error: updateError } = await supabase
      .from("cmo_campaigns")
      .update({ autopilot_enabled: enabled })
      .eq("id", campaignId)
      .eq("tenant_id", ctx.tenantId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating autopilot:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update autopilot status" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!campaign) {
      return new Response(
        JSON.stringify({ error: "Campaign not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Autopilot ${enabled ? "enabled" : "disabled"} for campaign ${campaignId}`);

    return new Response(
      JSON.stringify({ 
        ok: true,
        success: true, 
        campaignId,
        autopilotEnabled: enabled 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("ai-cmo-toggle-autopilot error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
