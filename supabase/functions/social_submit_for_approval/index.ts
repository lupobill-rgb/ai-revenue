import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { verifyAuth, unauthorizedResponse, createServiceClient } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-workspace-id",
};

type SocialSubmitForApprovalInput = {
  tenant_id: string;
  campaign_id: string;
  asset_id: string;
  channel: "social_linkedin";
};

type SocialSubmitForApprovalOutput = {
  approval_id: string;
  status: "pending";
};

function mustString(v: unknown, name: string): string {
  if (typeof v !== "string" || !v.trim()) throw new Error(`${name} is required`);
  return v.trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = await verifyAuth(req);
    if (auth.error || !auth.user || !auth.supabaseClient) {
      return unauthorizedResponse(corsHeaders, auth.error || "Unauthorized");
    }

    const body = (await req.json().catch(() => ({}))) as Partial<SocialSubmitForApprovalInput>;
    const tenant_id = mustString(body.tenant_id, "tenant_id");
    const campaign_id = mustString(body.campaign_id, "campaign_id");
    const asset_id = mustString(body.asset_id, "asset_id");
    const channel = mustString(body.channel, "channel");
    if (channel !== "social_linkedin") throw new Error("channel must be social_linkedin");

    const headerWorkspaceId = req.headers.get("x-workspace-id");
    if (headerWorkspaceId && headerWorkspaceId.trim() && headerWorkspaceId.trim() !== tenant_id) {
      return new Response(JSON.stringify({ error: "tenant_id must match x-workspace-id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createServiceClient();
    const { data: approval, error: insErr } = await supabaseAdmin
      .from("approvals")
      .insert({
        tenant_id,
        workspace_id: tenant_id,
        campaign_id,
        asset_id,
        channel,
        status: "pending",
      } as never)
      .select("id, status")
      .single();

    if (insErr || !approval?.id) {
      throw new Error(insErr?.message || "Failed to create approval");
    }

    const out: SocialSubmitForApprovalOutput = { approval_id: approval.id, status: "pending" };
    return new Response(JSON.stringify(out), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("[social_submit_for_approval] Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

