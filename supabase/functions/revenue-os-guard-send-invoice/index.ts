import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { runKernelGuard } from "../_shared/revenue_os_kernel/guard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type InvoiceGuardRequest = {
  tenant_id: string;
  invoice_id: string;
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
    const supabase = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: InvoiceGuardRequest = await req.json();
    if (!body.tenant_id || !body.invoice_id) {
      return new Response(JSON.stringify({ error: "tenant_id and invoice_id are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const correlation_id = crypto.randomUUID();
    const res = await runKernelGuard(supabase, {
      tenant_id: body.tenant_id,
      type: "invoice_send_attempted",
      source: "billing",
      entity_type: "invoice",
      entity_id: body.invoice_id,
      correlation_id,
      payload: {
        invoice_id: body.invoice_id,
        actor_user_id: user.id,
        override_ack: !!body.override_ack,
      },
    });

    // SHADOW ONLY: never block. Log decisions for auditability.
    // This environment does not implement invoice delivery.
    return new Response(JSON.stringify({ allowed: true, guard: res.guard, executed: false, shadow_only: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[revenue-os-guard-send-invoice] Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});


