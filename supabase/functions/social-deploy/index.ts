import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.84.0";
import { checkRateLimit, rateLimitResponse } from "../_shared/rate-limit.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limit config: 10/min, 60/hour, 500/day (social API limits)
const RATE_LIMIT_CONFIG = { perMinute: 10, perHour: 60, perDay: 500 };

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Use anon key + user's JWT for RLS enforcement
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limiting per user
    const rateLimitResult = await checkRateLimit(`social_deploy:${user.id}`, RATE_LIMIT_CONFIG);
    if (!rateLimitResult.allowed) {
      console.warn(`[social-deploy] Rate limit exceeded for user ${user.id}`);
      return rateLimitResponse(rateLimitResult, corsHeaders);
    }

    const { assetId, platforms } = await req.json();

    if (!assetId) {
      throw new Error('Asset ID is required');
    }

    console.log(`[social-deploy] User ${user.id} deploying asset ${assetId} to platforms:`, platforms);

    // Fetch the asset - RLS enforced
    const { data: asset, error: assetError } = await supabase
      .from('assets')
      .select('*')
      .eq('id', assetId)
      .single();

    if (assetError || !asset) {
      console.error('Asset fetch error:', assetError);
      return new Response(
        JSON.stringify({ error: 'Asset not found or access denied' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (asset.status !== 'approved') {
      throw new Error('Only approved assets can be deployed');
    }

    // Get user's social integrations - RLS enforced (user_id = auth.uid())
    const { data: integrations, error: integrationsError } = await supabase
      .from('social_integrations')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true);

    if (integrationsError) {
      throw new Error('Failed to fetch social integrations');
    }

    if (!integrations || integrations.length === 0) {
      throw new Error('No active social media integrations found. Please connect at least one platform in Settings.');
    }

    const results: any[] = [];
    let successCount = 0;
    let failCount = 0;

    // Deploy to each platform
    for (const integration of integrations) {
      if (platforms && Array.isArray(platforms) && !platforms.includes(integration.platform)) {
        continue;
      }

      try {
        let deployResult;
        
        switch (integration.platform) {
          case 'instagram':
            deployResult = await deployToInstagram(asset, integration.access_token);
            break;
          case 'linkedin':
            deployResult = await deployToLinkedIn(asset, integration.access_token);
            break;
          case 'facebook':
            deployResult = await deployToFacebook(asset, integration.access_token);
            break;
          case 'tiktok':
            deployResult = await deployToTikTok(asset, integration.access_token);
            break;
          default:
            continue;
        }

        if (deployResult.success) {
          successCount++;
          
          // Find existing campaign or create new one - RLS enforced
          const { data: existingCampaign } = await supabase
            .from('campaigns')
            .select('*')
            .eq('asset_id', assetId)
            .eq('channel', integration.platform)
            .single();

          let campaign;
          if (existingCampaign) {
            const { data: updatedCampaign } = await supabase
              .from('campaigns')
              .update({
                status: 'active',
                deployed_at: new Date().toISOString(),
                external_campaign_id: (deployResult as any).postId || null,
              })
              .eq('id', existingCampaign.id)
              .select()
              .single();
            campaign = updatedCampaign;
          } else {
            const { data: newCampaign } = await supabase
              .from('campaigns')
              .insert({
                asset_id: assetId,
                channel: integration.platform,
                status: 'active',
                deployed_at: new Date().toISOString(),
                external_campaign_id: (deployResult as any).postId || null,
                workspace_id: asset.workspace_id,
              })
              .select()
              .single();
            campaign = newCampaign;
          }

          // Update or create metrics - RLS enforced
          if (campaign) {
            const { data: existingMetrics } = await supabase
              .from('campaign_metrics')
              .select('*')
              .eq('campaign_id', campaign.id)
              .single();

            if (existingMetrics) {
              await supabase
                .from('campaign_metrics')
                .update({
                  impressions: 0,
                  clicks: 0,
                  engagement_rate: 0,
                  last_synced_at: new Date().toISOString(),
                })
                .eq('campaign_id', campaign.id);
            } else {
              await supabase
                .from('campaign_metrics')
                .insert({
                  campaign_id: campaign.id,
                  workspace_id: asset.workspace_id,
                  impressions: 0,
                  clicks: 0,
                  engagement_rate: 0,
                });
            }
          }

          results.push({
            platform: integration.platform,
            success: true,
            postId: (deployResult as any).postId,
            postUrl: (deployResult as any).postUrl,
          });
        } else {
          failCount++;
          results.push({
            platform: integration.platform,
            success: false,
            error: (deployResult as any).error,
          });
        }
      } catch (error) {
        failCount++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({
          platform: integration.platform,
          success: false,
          error: errorMessage,
        });
        console.error(`Failed to deploy to ${integration.platform}:`, error);
      }
    }

    // Update asset status to live if at least one deployment succeeded - RLS enforced
    if (successCount > 0) {
      await supabase
        .from('assets')
        .update({ status: 'live' })
        .eq('id', assetId);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        successCount,
        failCount,
        results,
        message: `Deployed to ${successCount} platform(s)${failCount > 0 ? `, ${failCount} failed` : ''}`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in social-deploy:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function deployToInstagram(asset: any, accessToken: string) {
  try {
    const content = asset.content || {};
    const caption = content.description || content.body || asset.name;
    
    if (asset.type === 'video' && asset.preview_url) {
      const containerResponse = await fetch(`https://graph.instagram.com/me/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          media_type: 'VIDEO',
          video_url: asset.preview_url,
          caption: caption,
          access_token: accessToken,
        }),
      });

      if (!containerResponse.ok) {
        const error = await containerResponse.json();
        throw new Error(error.error?.message || 'Failed to create Instagram container');
      }

      const containerData = await containerResponse.json();
      const containerId = containerData.id;

      const publishResponse = await fetch(`https://graph.instagram.com/me/media_publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creation_id: containerId,
          access_token: accessToken,
        }),
      });

      if (!publishResponse.ok) {
        const error = await publishResponse.json();
        throw new Error(error.error?.message || 'Failed to publish to Instagram');
      }

      const publishData = await publishResponse.json();
      return {
        success: true,
        postId: publishData.id,
        postUrl: `https://www.instagram.com/p/${publishData.id}/`,
      };
    } else {
      throw new Error('Instagram currently only supports video posts via API');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
}

async function deployToLinkedIn(asset: any, accessToken: string) {
  try {
    const content = asset.content || {};
    const text = content.body || content.description || asset.name;

    const profileResponse = await fetch('https://api.linkedin.com/v2/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0',
      },
    });

    if (!profileResponse.ok) {
      throw new Error('Failed to get LinkedIn profile');
    }

    const profile = await profileResponse.json();
    const authorUrn = `urn:li:person:${profile.id}`;

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
            shareCommentary: { text: text },
            shareMediaCategory: 'NONE',
          },
        },
        visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
      }),
    });

    if (!postResponse.ok) {
      const error = await postResponse.json();
      throw new Error(error.message || 'Failed to post to LinkedIn');
    }

    const postData = await postResponse.json();
    return {
      success: true,
      postId: postData.id,
      postUrl: `https://www.linkedin.com/feed/update/${postData.id}/`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
}

async function deployToFacebook(asset: any, accessToken: string) {
  try {
    const content = asset.content || {};
    const message = content.body || content.description || asset.name;

    const response = await fetch(`https://graph.facebook.com/me/feed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: message,
        access_token: accessToken,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to post to Facebook');
    }

    const data = await response.json();
    return {
      success: true,
      postId: data.id,
      postUrl: `https://www.facebook.com/${data.id}`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
}

async function deployToTikTok(asset: any, accessToken: string) {
  try {
    if (asset.type !== 'video' || !asset.preview_url) {
      throw new Error('TikTok requires video content with a URL');
    }
    throw new Error('TikTok video upload requires additional implementation');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
}
