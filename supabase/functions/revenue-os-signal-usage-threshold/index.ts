import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ingestKernelEvent } from "../_shared/revenue_os_kernel/runtime.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type UsageThresholdRequest = {
  tenant_id: string;
  account_id: string;
  metric: string;
  threshold: number;
  value: number;
  occurred_at?: string;
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
    const supabase = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: UsageThresholdRequest = await req.json();
    if (!body.tenant_id || !body.account_id || !body.metric) {
      return new Response(JSON.stringify({ error: "tenant_id, account_id, metric required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const correlation_id = crypto.randomUUID();

    const res = await ingestKernelEvent(
      supabase,
      {
        tenant_id: body.tenant_id,
        type: "usage_threshold_crossed",
        source: "product_usage",
        entity_type: "account",
        entity_id: body.account_id,
        correlation_id,
        occurred_at: body.occurred_at,
        payload: {
          account_id: body.account_id,
          metric: body.metric,
          threshold: body.threshold,
          value: body.value,
          actor_user_id: user.id,
        },
      },
      { mode: "shadow" }
    );

    return new Response(JSON.stringify({ success: true, kernel: res }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[revenue-os-signal-usage-threshold] Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});


