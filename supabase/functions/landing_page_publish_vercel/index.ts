import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { verifyAuth, unauthorizedResponse, createServiceClient } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-workspace-id",
};

type LandingPagePublishVercelInput = {
  tenant_id: string;
  campaign_id: string;
  approval_id: string;
  slug: string;
};

type LandingPagePublishVercelOutput = {
  published: true;
  url: string;
  deployment_id: string;
};

function mustString(v: unknown, name: string): string {
  if (typeof v !== "string" || !v.trim()) throw new Error(`${name} is required`);
  return v.trim();
}

function normalizeSlug(slug: string): string {
  // Fastest viable slug normalization.
  return slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function publicBaseUrl(): string {
  // Prefer explicit env (works in Vercel + custom domains).
  const env = Deno.env.get("PUBLIC_APP_URL") || Deno.env.get("VERCEL_URL") || "";
  if (env) {
    return env.startsWith("http") ? env : `https://${env}`;
  }
  // Fallback assumption: Vercel hosts the app.
  return "https://ai-revenue.vercel.app";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = await verifyAuth(req);
    if (auth.error || !auth.user || !auth.supabaseClient) {
      return unauthorizedResponse(corsHeaders, auth.error || "Unauthorized");
    }

    const body = (await req.json().catch(() => ({}))) as Partial<LandingPagePublishVercelInput>;
    const tenant_id = mustString(body.tenant_id, "tenant_id");
    const campaign_id = mustString(body.campaign_id, "campaign_id");
    const approval_id = mustString(body.approval_id, "approval_id");
    const slug = normalizeSlug(mustString(body.slug, "slug"));
    if (!slug) throw new Error("slug is invalid");

    const headerWorkspaceId = req.headers.get("x-workspace-id");
    if (headerWorkspaceId && headerWorkspaceId.trim() && headerWorkspaceId.trim() !== tenant_id) {
      return new Response(JSON.stringify({ error: "tenant_id must match x-workspace-id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createServiceClient();

    // Require approval
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
    if (approval.channel !== "landing_page") throw new Error("Approval channel mismatch");
    if (approval.status !== "approved") {
      return new Response(JSON.stringify({ error: "not_approved" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch landing page content from campaign_assets
    const { data: asset, error: assetErr } = await supabaseAdmin
      .from("campaign_assets")
      .select("id, content")
      .eq("id", approval.asset_id)
      .eq("tenant_id", tenant_id)
      .eq("workspace_id", tenant_id)
      .eq("campaign_id", campaign_id)
      .maybeSingle();

    if (assetErr) throw new Error(assetErr.message);
    const page = (asset as any)?.content?.page;
    if (!page) throw new Error("Missing landing page content");

    // OPTION A (preferred): "Publish" means create/activate a landing_pages row rendered by slug.
    // Assumption: The frontend (Vercel) already serves a route for this slug in the existing landing pages system.
    const url = `${publicBaseUrl().replace(/\/+$/, "")}/lp/${slug}`;

    const { error: upsertErr } = await supabaseAdmin.from("landing_pages").upsert(
      {
        tenant_id,
        campaign_id,
        template_type: "generated",
        internal_name: String(page.title || "Landing Page"),
        url_slug: slug,
        hero_headline: String(page.hero_headline || ""),
        hero_subheadline: String(page.hero_subheadline || ""),
        hero_supporting_points: Array.isArray(page.benefits) ? page.benefits.slice(0, 3) : [],
        sections: [
          { type: "benefits", items: Array.isArray(page.benefits) ? page.benefits.slice(0, 3) : [] },
          { type: "lead_capture_form", fields: ["name", "email", "phone_optional"] },
          { type: "calendar_embed_placeholder", placeholder: true },
          { type: "cta", text: String(page.cta_text || "") },
        ],
        primary_cta_label: String(page.cta_text || "Get started"),
        primary_cta_type: "form",
        form_fields: [
          { name: "name", required: true },
          { name: "email", required: true },
          { name: "phone", required: false },
        ],
        published: true,
        url,
      } as never,
      { onConflict: "tenant_id,url_slug" }
    );

    if (upsertErr) throw new Error(upsertErr.message);

    // Usage event (billable)
    await supabaseAdmin.from("usage_events").insert({
      tenant_id,
      workspace_id: tenant_id,
      channel: "landing_page",
      units: 1,
      billable: true,
      campaign_id,
      metadata: { slug, url },
    } as never);

    const out: LandingPagePublishVercelOutput = {
      published: true,
      url,
      deployment_id: `activated:${slug}`,
    };
    return new Response(JSON.stringify(out), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("[landing_page_publish_vercel] Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

