import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveTenantContext } from "../_shared/tenant-context.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-workspace-id",
};

const VALID_CHANNELS = ["email", "sms", "linkedin", "voice", "landing_page"];
const VALID_GOALS = ["leads", "meetings", "revenue", "engagement"];

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
    const body = await req.json().catch(() => ({}));
    const { icp, offer, channels, desiredResult, target_tags, target_segments } = body as any;
    
    // Validate inputs
    if (!icp || typeof icp !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing or invalid icp" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!offer || typeof offer !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing or invalid offer" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!Array.isArray(channels) || channels.length === 0) {
      return new Response(
        JSON.stringify({ error: "channels must be a non-empty array" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const invalidChannels = channels.filter(c => !VALID_CHANNELS.includes(c));
    if (invalidChannels.length > 0) {
      return new Response(
        JSON.stringify({ error: `Invalid channels: ${invalidChannels.join(", ")}. Valid: ${VALID_CHANNELS.join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!desiredResult || !VALID_GOALS.includes(desiredResult)) {
      return new Response(
        JSON.stringify({ error: `Invalid desiredResult. Must be one of: ${VALID_GOALS.join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Resolve tenant context (workspace -> tenant, no JWT tenant claim assumptions).
    let ctx: { tenantId: string; workspaceId: string; userId: string };
    try {
      ctx = await resolveTenantContext(req, supabase, { body, userId: user.id });
      if (!ctx.tenantId) throw new Error("Missing tenant_id");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unable to resolve tenant context";
      return new Response(JSON.stringify({ error: msg }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 1: Create campaign row first (status draft, autopilot_enabled = true, goal set)
    const campaignData: Record<string, unknown> = {
      tenant_id: ctx.tenantId,
      workspace_id: ctx.workspaceId,
      campaign_name: `Autopilot Campaign - ${desiredResult}`,
      campaign_type: "autopilot",
      description: `AI-generated campaign targeting ${desiredResult}`,
      target_icp: icp,
      target_offer: offer,
      goal: desiredResult,
      autopilot_enabled: true,
      status: "draft",
    };

    // Add target_tags if provided
    if (Array.isArray(target_tags) && target_tags.length > 0) {
      campaignData.target_tags = target_tags;
      console.log(`Campaign will target leads with tags: ${target_tags.join(", ")}`);
    }

    // Add target_segment_codes if provided
    if (Array.isArray(target_segments) && target_segments.length > 0) {
      campaignData.target_segment_codes = target_segments;
      console.log(`Campaign will target leads in segments: ${target_segments.join(", ")}`);
    }

    const { data: campaign, error: campaignError } = await supabase
      .from("cmo_campaigns")
      .insert(campaignData)
      .select()
      .single();

    if (campaignError) {
      console.error("Error creating campaign:", campaignError);
      return new Response(
        JSON.stringify({ error: "Failed to create campaign" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Created draft campaign ${campaign.id} for tenant ${ctx.tenantId}`);

    // Step 2: Call kernel with campaign_id and payload
    const kernelPayload = {
      mode: "campaign-builder",
      tenant_id: ctx.tenantId,
      payload: {
        campaign_id: campaign.id,
        icp,
        offer,
        channels,
        desired_result: desiredResult,
      },
    };

    console.log(`Calling cmo-kernel with mode campaign-builder for campaign ${campaign.id}`);

    const kernelResponse = await fetch(`${supabaseUrl}/functions/v1/cmo-kernel`, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(kernelPayload),
    });

    if (!kernelResponse.ok) {
      const status = kernelResponse.status;
      if (status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add funds." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await kernelResponse.text();
      console.error("Kernel error:", status, errorText);
      return new Response(
        JSON.stringify({ error: "Campaign builder agent failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 3: Process kernel response (assets + automations)
    const kernelResult = await kernelResponse.json();
    const result = kernelResult.result || kernelResult;

    // Update campaign name if generated
    if (result.campaign_name) {
      await supabase
        .from("cmo_campaigns")
        .update({ 
          campaign_name: result.campaign_name,
          description: result.campaign_description || campaign.description,
        })
        .eq("id", campaign.id);
    }

    // Create campaign channels
    const channelInserts = channels.map((channel: string) => ({
      campaign_id: campaign.id,
      channel_name: channel,
      channel_type: channel,
    }));

    await supabase.from("cmo_campaign_channels").insert(channelInserts);

    // Store content assets from kernel response
    const assets = result.assets || {};
    const assetInserts = [];

    // Emails
    if (assets.emails) {
      for (const email of assets.emails) {
        assetInserts.push({
          tenant_id: ctx.tenantId,
          workspace_id: ctx.workspaceId,
          campaign_id: campaign.id,
          title: email.subject,
          content_type: "email",
          channel: "email",
          key_message: email.body,
          status: "draft",
        });
      }
    }

    // SMS
    if (assets.sms) {
      for (const sms of assets.sms) {
        assetInserts.push({
          tenant_id: ctx.tenantId,
          workspace_id: ctx.workspaceId,
          campaign_id: campaign.id,
          title: `SMS Step ${sms.step}`,
          content_type: "sms",
          channel: "sms",
          key_message: sms.message,
          status: "draft",
        });
      }
    }

    // Voice scripts
    if (assets.voice_scripts) {
      for (const script of assets.voice_scripts) {
        assetInserts.push({
          tenant_id: ctx.tenantId,
          workspace_id: ctx.workspaceId,
          campaign_id: campaign.id,
          title: `Voice Script - ${script.scenario}`,
          content_type: "voice_script",
          channel: "voice",
          key_message: script.pitch,
          supporting_points: [script.opening, script.objection_handling, script.close],
          status: "draft",
        });
      }
    }

    // Social posts
    if (assets.posts) {
      for (const post of assets.posts) {
        assetInserts.push({
          tenant_id: ctx.tenantId,
          workspace_id: ctx.workspaceId,
          campaign_id: campaign.id,
          title: post.hook || `${post.channel} Post`,
          content_type: "social_post",
          channel: post.channel,
          key_message: post.content,
          cta: post.cta,
          status: "draft",
        });
      }
    }

    // Landing pages
    if (assets.landing_pages) {
      for (const page of assets.landing_pages) {
        assetInserts.push({
          tenant_id: ctx.tenantId,
          workspace_id: ctx.workspaceId,
          campaign_id: campaign.id,
          title: page.title || page.headline,
          content_type: "landing_page",
          channel: "landing_page",
          key_message: page.subheadline,
          supporting_points: page.sections || [],
          status: "draft",
        });
      }
    }

    if (assetInserts.length > 0) {
      await supabase.from("cmo_content_assets").insert(assetInserts);
    }

    // Create automation definition with steps (including voice)
    const automations = result.automations || {};
    const automationSteps = automations.steps || [];
    
    if (automationSteps.length > 0) {
      const stepInserts = automationSteps.map((step: any, index: number) => ({
        tenant_id: ctx.tenantId,
        workspace_id: ctx.workspaceId,
        automation_id: campaign.id, // Link to campaign as automation container
        step_order: step.step || index + 1,
        step_type: step.type, // email, sms, wait, voice, condition
        config: {
          delay_days: step.delay_days || 0,
          ...step.config,
          // Voice-specific config
          ...(step.type === "voice" && {
            agent_id: step.config?.agent_id,
            script_template: step.config?.script_template,
            retry_on_no_answer: step.config?.retry_on_no_answer || false,
            max_retries: step.config?.max_retries || 2,
            max_duration: step.config?.max_duration || 300,
          }),
        },
      }));

      await supabase.from("automation_steps").insert(stepInserts);
      console.log(`Created ${stepInserts.length} automation steps for campaign ${campaign.id}`);
    }

    console.log(`Autopilot campaign ${campaign.id} built with ${assetInserts.length} assets`);

    return new Response(
      JSON.stringify({
        campaignId: campaign.id,
        status: "created",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("ai-cmo-autopilot-build error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
