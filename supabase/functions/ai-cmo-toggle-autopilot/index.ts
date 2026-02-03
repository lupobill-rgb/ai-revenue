import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
    const { campaignId: requestedCampaignId, campaign_id, enabled } = await req.json();
    const campaignId = requestedCampaignId ?? campaign_id;

    if (!campaignId) {
      return new Response(
        JSON.stringify({ error: "Missing campaignId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (typeof enabled !== "boolean") {
      return new Response(
        JSON.stringify({ error: "enabled must be a boolean" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get tenant context
    const { data: userTenant } = await supabase
      .from("user_tenants")
      .select("tenant_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const tenantId = userTenant?.tenant_id || user.id;

    // Update campaign autopilot status (RLS enforces tenant access)
    const { data: campaign, error: updateError } = await supabase
      .from("cmo_campaigns")
      .update({ autopilot_enabled: enabled })
      .eq("id", campaignId)
      .eq("tenant_id", tenantId)
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

    const upstream = campaign;
    const normalizedCampaignId =
      upstream?.campaignId ??
      upstream?.campaign_id ??
      upstream?.data?.campaignId ??
      upstream?.data?.campaign_id ??
      upstream?.id ??
      upstream?.data?.id;

    if (!normalizedCampaignId || typeof normalizedCampaignId !== "string") {
      throw new Error(
        `missing campaignId from autopilot response; keys=${Object.keys(upstream || {}).join(",")}`
      );
    }

    console.log(`Autopilot ${enabled ? "enabled" : "disabled"} for campaign ${normalizedCampaignId}`);

    return new Response(JSON.stringify({ campaignId: normalizedCampaignId }), {
      status: 200,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });

  } catch (error) {
    console.error("ai-cmo-toggle-autopilot error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
