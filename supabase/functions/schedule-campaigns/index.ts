import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-secret',
};

// Internal secret for cron/orchestration calls
const INTERNAL_SECRET = Deno.env.get('INTERNAL_FUNCTION_SECRET') || 'ubigrowth-internal-2024';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify internal secret header - blocks direct frontend calls
    const internalSecret = req.headers.get('x-internal-secret');
    if (internalSecret !== INTERNAL_SECRET) {
      console.error('[schedule-campaigns] Invalid or missing x-internal-secret header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Internal functions require secret header' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { workspaceId, internal } = await req.json();

    // Double-check this is an internal call
    if (!internal) {
      return new Response(
        JSON.stringify({ error: 'This function is for internal use only' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Require workspaceId for tenant isolation
    if (!workspaceId) {
      return new Response(
        JSON.stringify({ error: 'workspaceId is required for tenant isolation' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`[schedule-campaigns] Running deployment check for workspace ${workspaceId}...`);

    // Fetch approved assets that haven't been deployed yet - SCOPED BY WORKSPACE
    const { data: approvedAssets, error: assetsError } = await supabase
      .from('assets')
      .select('*, asset_approvals!inner(*)')
      .eq('workspace_id', workspaceId)
      .eq('status', 'approved')
      .is('external_id', null);

    if (assetsError) {
      console.error('Error fetching approved assets:', assetsError);
      throw assetsError;
    }

    console.log(`Found ${approvedAssets?.length || 0} approved assets ready for deployment`);

    const deploymentResults = [];

    for (const asset of approvedAssets || []) {
      // Determine optimal posting time based on asset type and current time
      const now = new Date();
      const currentHour = now.getHours();
      const currentDay = now.getDay(); // 0 = Sunday, 6 = Saturday

      // Skip weekends for business-focused content
      if (currentDay === 0 || currentDay === 6) {
        console.log(`Skipping asset ${asset.id} - weekend`);
        continue;
      }

      // Platform-specific optimal posting windows
      const optimalWindows: Record<string, { start: number; end: number }> = {
        'instagram': { start: 11, end: 13 }, // 11 AM - 1 PM
        'linkedin': { start: 8, end: 10 },   // 8 AM - 10 AM
        'facebook': { start: 13, end: 15 },  // 1 PM - 3 PM
        'tiktok': { start: 18, end: 20 },    // 6 PM - 8 PM
      };

      // Check if we're in an optimal posting window for any platform
      let shouldDeploy = false;
      const targetPlatforms: string[] = [];

      for (const [platform, window] of Object.entries(optimalWindows)) {
        if (currentHour >= window.start && currentHour < window.end) {
          shouldDeploy = true;
          targetPlatforms.push(platform);
        }
      }

      if (!shouldDeploy) {
        console.log(`Skipping asset ${asset.id} - not in optimal posting window`);
        continue;
      }

      console.log(`Deploying asset ${asset.id} to platforms: ${targetPlatforms.join(', ')}`);

      // Get user's social integrations for the asset creator
      const { data: integrations, error: integrationsError } = await supabase
        .from('social_integrations')
        .select('*')
        .eq('user_id', asset.created_by)
        .eq('is_active', true)
        .in('platform', targetPlatforms);

      if (integrationsError || !integrations || integrations.length === 0) {
        console.log(`No active integrations found for user ${asset.created_by}`);
        continue;
      }

      // Deploy to each connected platform
      for (const integration of integrations) {
        try {
          let deployResult;

          if (integration.platform === 'instagram' && asset.type === 'video') {
            deployResult = await deployToInstagram(asset, integration.access_token);
          } else if (integration.platform === 'linkedin') {
            deployResult = await deployToLinkedIn(asset, integration.access_token);
          } else if (integration.platform === 'facebook') {
            deployResult = await deployToFacebook(asset, integration.access_token);
          } else {
            console.log(`Skipping ${integration.platform} - not compatible with asset type ${asset.type}`);
            continue;
          }

          if (deployResult.success) {
            // Create campaign record - INCLUDING workspace_id
            const { data: campaign, error: campaignError } = await supabase
              .from('campaigns')
              .insert({
                asset_id: asset.id,
                workspace_id: workspaceId, // CRITICAL: Include workspace_id
                channel: integration.platform,
                status: 'active',
                deployed_at: new Date().toISOString(),
                external_campaign_id: deployResult.postId,
              })
              .select()
              .single();

            if (!campaignError && campaign) {
              // Initialize campaign metrics - INCLUDING workspace_id
              await supabase.from('campaign_metrics').insert({
                campaign_id: campaign.id,
                workspace_id: workspaceId, // CRITICAL: Include workspace_id
              });

              deploymentResults.push({
                assetId: asset.id,
                platform: integration.platform,
                success: true,
                postId: deployResult.postId,
              });
            }
          }
        } catch (error) {
          console.error(`Error deploying to ${integration.platform}:`, error);
          deploymentResults.push({
            assetId: asset.id,
            platform: integration.platform,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      // Update asset status to live if at least one deployment succeeded
      const successfulDeploys = deploymentResults.filter(r => r.assetId === asset.id && r.success);
      if (successfulDeploys.length > 0) {
        await supabase
          .from('assets')
          .update({ status: 'live' })
          .eq('id', asset.id)
          .eq('workspace_id', workspaceId); // Extra safety
      }
    }

    console.log(`[schedule-campaigns] Workspace ${workspaceId}: ${deploymentResults.length} deployments processed`);

    return new Response(
      JSON.stringify({
        success: true,
        workspaceId,
        deploymentsProcessed: deploymentResults.length,
        results: deploymentResults,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in schedule-campaigns:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function deployToInstagram(asset: any, accessToken: string) {
  const content = asset.content || {};
  const caption = content.caption || asset.description || '';
  const videoUrl = asset.preview_url;

  if (!videoUrl) {
    throw new Error('No video URL available for Instagram');
  }

  // Create media container
  const containerResponse = await fetch(
    `https://graph.facebook.com/v18.0/me/media?media_type=REELS&video_url=${encodeURIComponent(videoUrl)}&caption=${encodeURIComponent(caption)}&access_token=${accessToken}`,
    { method: 'POST' }
  );

  const containerData = await containerResponse.json();
  
  if (!containerResponse.ok) {
    throw new Error(`Instagram API error: ${JSON.stringify(containerData)}`);
  }

  // Publish the container
  const publishResponse = await fetch(
    `https://graph.facebook.com/v18.0/me/media_publish?creation_id=${containerData.id}&access_token=${accessToken}`,
    { method: 'POST' }
  );

  const publishData = await publishResponse.json();

  if (!publishResponse.ok) {
    throw new Error(`Instagram publish error: ${JSON.stringify(publishData)}`);
  }

  return {
    success: true,
    postId: publishData.id,
    postUrl: `https://www.instagram.com/p/${publishData.id}`,
  };
}

async function deployToLinkedIn(asset: any, accessToken: string) {
  const content = asset.content || {};
  const text = content.body || content.email_body || asset.description || '';

  // Get user profile to get URN
  const profileResponse = await fetch('https://api.linkedin.com/v2/me', {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });

  const profileData = await profileResponse.json();
  const authorUrn = `urn:li:person:${profileData.id}`;

  // Create UGC post
  const postResponse = await fetch('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify({
      author: authorUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text },
          shareMediaCategory: 'NONE',
        },
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
      },
    }),
  });

  const postData = await postResponse.json();

  if (!postResponse.ok) {
    throw new Error(`LinkedIn API error: ${JSON.stringify(postData)}`);
  }

  return {
    success: true,
    postId: postData.id,
    postUrl: `https://www.linkedin.com/feed/update/${postData.id}`,
  };
}

async function deployToFacebook(asset: any, accessToken: string) {
  const content = asset.content || {};
  const message = content.body || content.email_body || asset.description || '';

  const response = await fetch(
    `https://graph.facebook.com/v18.0/me/feed?message=${encodeURIComponent(message)}&access_token=${accessToken}`,
    { method: 'POST' }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Facebook API error: ${JSON.stringify(data)}`);
  }

  return {
    success: true,
    postId: data.id,
    postUrl: `https://www.facebook.com/${data.id}`,
  };
}
