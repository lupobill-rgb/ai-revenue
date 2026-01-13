import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { verifyAuth, unauthorizedResponse, createServiceClient } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-workspace-id",
};

type SocialPublishLinkedInManualInput = {
  tenant_id: string;
  campaign_id: string;
  approval_id: string;
};

type SocialPublishLinkedInManualOutput = { published: false; reason: "not_configured" };

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

    const body = (await req.json().catch(() => ({}))) as Partial<SocialPublishLinkedInManualInput>;
    const tenant_id = mustString(body.tenant_id, "tenant_id");
    const campaign_id = mustString(body.campaign_id, "campaign_id");
    const approval_id = mustString(body.approval_id, "approval_id");

    const headerWorkspaceId = req.headers.get("x-workspace-id");
    if (headerWorkspaceId && headerWorkspaceId.trim() && headerWorkspaceId.trim() !== tenant_id) {
      return new Response(JSON.stringify({ error: "tenant_id must match x-workspace-id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createServiceClient();

    // Approval must be approved (manual gate).
    const { data: approval, error: approvalErr } = await supabaseAdmin
      .from("approvals")
      .select("id, status, asset_id, channel")
      .eq("id", approval_id)
      .eq("tenant_id", tenant_id)
      .eq("workspace_id", tenant_id)
      .eq("campaign_id", campaign_id)
      .maybeSingle();

    if (approvalErr) throw new Error(approvalErr.message);
    if (!approval) throw new Error("Approval not found");
    if (approval.channel !== "social_linkedin") throw new Error("Approval channel mismatch");
    if (approval.status !== "approved") {
      return new Response(JSON.stringify({ error: "not_approved" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check integration (workspace-scoped)
    const { data: liIntegration } = await supabaseAdmin
      .from("social_integrations")
      .select("access_token, platform, is_active")
      .eq("workspace_id", tenant_id)
      .eq("platform", "linkedin")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    const accessToken = (liIntegration as any)?.access_token || "";
    if (!accessToken) {
      const out: SocialPublishLinkedInManualOutput = { published: false, reason: "not_configured" };
      return new Response(JSON.stringify(out), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // MVP behavior (Day 2): Even if an integration exists, do not publish automatically by default.
    // Assumption: Real publishing will be enabled in a follow-up once LinkedIn app approval + token lifecycle is finalized.
    // This keeps the endpoint shippable and correctly gated on approval.
    const out: SocialPublishLinkedInManualOutput = { published: false, reason: "not_configured" };
    return new Response(JSON.stringify(out), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("[social_publish_linkedin_manual] Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

