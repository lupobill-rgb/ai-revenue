import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { runKernelGuard } from "../_shared/revenue_os_kernel/guard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type DealUpdateRequest = {
  tenant_id: string; // workspace/tenant id
  deal_id: string;
  updates: Record<string, any>;
  override_ack?: boolean;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: DealUpdateRequest = await req.json();
    const { tenant_id, deal_id, updates, override_ack } = body;

    if (!tenant_id || !deal_id || !updates) {
      return new Response(JSON.stringify({ error: "tenant_id, deal_id, and updates are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load current deal state (tenant-safe: must match workspace_id)
    const { data: deal, error: dealError } = await supabase
      .from("deals")
      .select("id, workspace_id, value, stage")
      .eq("id", deal_id)
      .single();

    if (dealError || !deal) {
      return new Response(JSON.stringify({ error: "Deal not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (deal.workspace_id !== tenant_id) {
      return new Response(JSON.stringify({ error: "Deal does not belong to this tenant" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Guard checks:
    // - Discount guard: ENFORCED (blocks/override)
    // - Deal close guard: SHADOW (log-only; never blocks here)
    let discountGuard: any | null = null;
    let closeGuardShadow: any | null = null;

    // Discount attempt: value decrease
    if (typeof updates.value === "number" && typeof deal.value === "number" && updates.value < deal.value) {
      const correlation_id = crypto.randomUUID();
      const res = await runKernelGuard(supabase, {
        tenant_id,
        type: "discount_attempted",
        source: "crm",
        entity_type: "deal",
        entity_id: deal_id,
        correlation_id,
        payload: {
          deal_id,
          old_value: deal.value,
          new_value: updates.value,
          actor_user_id: user.id,
          override_ack: !!override_ack,
        },
      });
      discountGuard = res.guard;
    }

    // Close deal attempt: stage -> closed_won/closed_lost
    if (typeof updates.stage === "string" && ["closed_won", "closed_lost"].includes(updates.stage)) {
      const correlation_id = crypto.randomUUID();
      const res = await runKernelGuard(supabase, {
        tenant_id,
        type: "deal_close_attempted",
        source: "crm",
        entity_type: "deal",
        entity_id: deal_id,
        correlation_id,
        payload: {
          deal_id,
          old_stage: deal.stage,
          new_stage: updates.stage,
          deal_value: updates.value ?? deal.value ?? 0,
          actor_user_id: user.id,
          override_ack: !!override_ack,
        },
      });
      closeGuardShadow = res.guard;
    }

    // ENFORCEMENT: discount only
    if (discountGuard?.result === "BLOCK") {
      return new Response(JSON.stringify({ allowed: false, guard: discountGuard }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (discountGuard?.result === "ALLOW_WITH_OVERRIDE" && !override_ack) {
      return new Response(JSON.stringify({ allowed: false, guard: discountGuard }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Allowed (or override acknowledged) -> perform update
    const { error: updateError } = await supabase.from("deals").update(updates).eq("id", deal_id);
    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({
        success: true,
        allowed: true,
        guard: discountGuard || null,
        shadow_guards: {
          deal_close_attempted: closeGuardShadow,
        },
      }),
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    );
  } catch (error) {
    console.error("[revenue-os-guard-deal-update] Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});


