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
    const { campaignName, vertical, goal, location, businessType, budget, draftedEmail } = await req.json();

    const authHeader = req.headers.get("Authorization");
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader! } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    console.log("Starting campaign orchestration:", { campaignName, vertical, goal });

    // Get user's workspace - try to find an existing workspace first
    let workspaceId: string | null = null;

    // First check if user owns a workspace
    const { data: ownedWorkspace, error: ownedError } = await supabaseClient
      .from("workspaces")
      .select("id")
      .eq("owner_id", user.id)
      .limit(1)
      .maybeSingle();
    
    if (ownedError) {
      console.error("Error fetching owned workspace:", ownedError);
    }
    
    workspaceId = ownedWorkspace?.id || null;

    // If no owned workspace, check for any workspace the user has access to
    if (!workspaceId) {
      const { data: anyWorkspace, error: anyError } = await supabaseClient
        .from("workspaces")
        .select("id")
        .limit(1)
        .maybeSingle();
      
      if (anyError) {
        console.error("Error fetching any workspace:", anyError);
      }
      
      workspaceId = anyWorkspace?.id || null;
    }

    // Create a default workspace if none exists
    if (!workspaceId) {
      console.log("No workspace found, creating default workspace...");
      const { data: newWorkspace, error: wsError } = await supabaseClient
        .from("workspaces")
        .insert({
          name: "Default Workspace",
          owner_id: user.id,
        })
        .select()
        .single();
      
      if (wsError) {
        console.error("Error creating workspace:", wsError);
        throw new Error(`Failed to create workspace: ${wsError.message}`);
      }
      workspaceId = newWorkspace.id;
      console.log("Created new workspace:", workspaceId);
    }

    console.log("Using workspace:", workspaceId);

    // Fetch business profile for context
    const { data: businessProfile } = await supabaseClient
      .from("business_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    console.log("Business profile loaded:", businessProfile ? "Yes" : "No");

    // Fetch previous campaign performance data for optimization
    let campaignInsights: any = null;
    try {
      const { data: previousCampaigns } = await supabaseClient
        .from("campaigns")
        .select(`
          id,
          channel,
          status,
          campaign_metrics (
            impressions,
            clicks,
            conversions,
            open_count,
            engagement_rate,
            revenue
          )
        `)
        .eq("workspace_id", workspaceId)
        .in("status", ["active", "completed"])
        .order("created_at", { ascending: false })
        .limit(20);

      if (previousCampaigns && previousCampaigns.length > 0) {
        // Calculate insights from previous campaigns
        const metrics = previousCampaigns
          .filter(c => c.campaign_metrics && c.campaign_metrics.length > 0)
          .flatMap(c => c.campaign_metrics);
        
        if (metrics.length > 0) {
          const avgEngagement = metrics.reduce((sum, m) => sum + (m.engagement_rate || 0), 0) / metrics.length;
          const totalConversions = metrics.reduce((sum, m) => sum + (m.conversions || 0), 0);
          
          campaignInsights = {
            total_previous_campaigns: previousCampaigns.length,
            avg_engagement_rate: avgEngagement.toFixed(2),
            total_conversions: totalConversions,
            performance_note: avgEngagement > 5 ? "High engagement - maintain current approach" : "Focus on improving engagement"
          };
          console.log("Campaign insights loaded:", campaignInsights);
        }
      }
    } catch (error) {
      console.error("Error fetching campaign insights:", error);
    }

    // Merge campaign insights into business profile for content generation
    const enrichedProfile = businessProfile ? {
      ...businessProfile,
      campaign_insights: campaignInsights
    } : campaignInsights ? { campaign_insights: campaignInsights } : null;

    let leadsScraped = 0;
    let leadIds: string[] = [];

    // Step 1: Scrape leads if location and businessType provided
    if (location && businessType) {
      try {
        const { data: scrapedData } = await supabaseClient.functions.invoke("scrape-google-maps", {
          body: { location, businessType, radius: 50000, maxResults: 50 },
        });
        leadsScraped = scrapedData?.imported || 0;
        console.log(`Scraped ${leadsScraped} leads`);
      } catch (error) {
        console.error("Lead scraping failed:", error);
      }
    }

    // Fetch leads with phone numbers for voice campaigns and emails for email campaigns
    const { data: crmLeads } = await supabaseClient
      .from("leads")
      .select("id, first_name, last_name, email, phone, company, status")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (crmLeads) {
      leadIds = crmLeads.map(l => l.id);
      console.log(`Found ${leadIds.length} CRM leads to link to campaign`);
    }

    // Separate leads by channel capability
    const leadsWithPhone = crmLeads?.filter(l => l.phone) || [];
    const leadsWithEmail = crmLeads?.filter(l => l.email) || [];

    const assetsCreated: string[] = [];
    const campaignIds: string[] = [];
    
    // Calculate budget per channel (split evenly across 4 channels)
    const budgetPerChannel = budget ? Math.floor(budget / 4) : 1000;

    // Step 2: Generate email campaign - linked to CRM leads with emails
    try {
      console.log("Generating email content...");
      
      let emailSubject: string;
      let emailBody: string;
      let emailImageUrl: string | undefined;

      // Use customer's drafted email if provided, otherwise generate with AI
      if (draftedEmail && draftedEmail.content) {
        console.log("Using customer-provided drafted email content");
        emailSubject = draftedEmail.subject || campaignName;
        emailBody = draftedEmail.content;
        
        // Still generate a hero image for the drafted email
        const { data: emailImage, error: emailImageError } = await supabaseClient.functions.invoke("generate-hero-image", {
          body: { vertical, contentType: "email", goal },
        });
        if (emailImageError) {
          console.error("Email image generation error:", emailImageError);
        }
        emailImageUrl = emailImage?.imageUrl;
      } else {
        // Generate email content with AI
        const { data: emailContent, error: emailContentError } = await supabaseClient.functions.invoke("content-generate", {
          body: { vertical, contentType: "email", assetGoal: goal, businessProfile: enrichedProfile },
        });

        if (emailContentError) {
          console.error("Email content generation error:", emailContentError);
        }

        const { data: emailImage, error: emailImageError } = await supabaseClient.functions.invoke("generate-hero-image", {
          body: { vertical, contentType: "email", goal },
        });

        if (emailImageError) {
          console.error("Email image generation error:", emailImageError);
        }

        emailSubject = emailContent?.subject || campaignName;
        emailBody = emailContent?.content || "";
        emailImageUrl = emailImage?.imageUrl;
      }

      console.log("Inserting email asset...");
      const { data: emailAsset, error: emailAssetError } = await supabaseClient.from("assets").insert({
        name: `${campaignName} - Email Campaign`,
        type: "email",
        status: "review",
        channel: "email",
        goal: goal,
        created_by: user.id,
        workspace_id: workspaceId,
        content: {
          subject: emailSubject,
          body: emailBody,
          vertical,
          hero_image_url: emailImageUrl,
          preview_url: emailImageUrl,
          is_customer_drafted: !!(draftedEmail && draftedEmail.content),
          // Link to CRM leads with emails
          target_leads: leadsWithEmail.map(l => ({ 
            id: l.id, 
            email: l.email, 
            name: `${l.first_name} ${l.last_name}`,
            company: l.company
          })),
          total_recipients: leadsWithEmail.length,
        },
        preview_url: emailImageUrl,
      }).select().single();

      if (emailAssetError) {
        console.error("Email asset insert error:", emailAssetError);
      }

      if (emailAsset) {
        assetsCreated.push(emailAsset.id);
        console.log("Email asset created:", emailAsset.id);
        
        // Create campaign record linked to leads
        const { data: emailCampaign, error: emailCampaignError } = await supabaseClient.from("campaigns").insert({
          asset_id: emailAsset.id,
          channel: "email",
          status: "pending",
          budget_allocated: budgetPerChannel,
          workspace_id: workspaceId,
          target_audience: { 
            vertical, 
            campaignName, 
            goal,
            lead_ids: leadsWithEmail.map(l => l.id),
            total_leads: leadsWithEmail.length,
          },
        }).select().single();
        
        if (emailCampaignError) {
          console.error("Email campaign insert error:", emailCampaignError);
        }
        
        if (emailCampaign) {
          campaignIds.push(emailCampaign.id);
        }
      }
    } catch (error) {
      console.error("Email generation failed:", error);
    }

    // Step 3: Generate social media post
    try {
      console.log("Generating social content...");
      const { data: socialContent, error: socialContentError } = await supabaseClient.functions.invoke("content-generate", {
        body: { vertical, contentType: "social", assetGoal: goal, businessProfile: enrichedProfile },
      });

      if (socialContentError) {
        console.error("Social content generation error:", socialContentError);
      }

      const { data: socialImage, error: socialImageError } = await supabaseClient.functions.invoke("generate-hero-image", {
        body: { vertical, contentType: "social", goal },
      });

      if (socialImageError) {
        console.error("Social image generation error:", socialImageError);
      }

      console.log("Inserting social asset...");
      const { data: socialAsset, error: socialAssetError } = await supabaseClient.from("assets").insert({
        name: `${campaignName} - Social Post`,
        type: "landing_page",
        status: "review",
        channel: "social",
        goal: goal,
        created_by: user.id,
        workspace_id: workspaceId,
        content: {
          text: socialContent?.content || "",
          vertical,
          hero_image_url: socialImage?.imageUrl,
          preview_url: socialImage?.imageUrl,
        },
        preview_url: socialImage?.imageUrl,
      }).select().single();

      if (socialAssetError) {
        console.error("Social asset insert error:", socialAssetError);
      }

      if (socialAsset) {
        assetsCreated.push(socialAsset.id);
        console.log("Social asset created:", socialAsset.id);
        
        const { data: socialCampaign, error: socialCampaignError } = await supabaseClient.from("campaigns").insert({
          asset_id: socialAsset.id,
          channel: "social",
          status: "pending",
          budget_allocated: budgetPerChannel,
          workspace_id: workspaceId,
          target_audience: { vertical, campaignName, goal },
        }).select().single();
        
        if (socialCampaignError) {
          console.error("Social campaign insert error:", socialCampaignError);
        }
        
        if (socialCampaign) {
          campaignIds.push(socialCampaign.id);
        }
      }
    } catch (error) {
      console.error("Social post generation failed:", error);
    }

    // Step 4: Generate video
    try {
      console.log("Generating video content...");
      const { data: videoContent, error: videoContentError } = await supabaseClient.functions.invoke("content-generate", {
        body: { vertical, contentType: "video", assetGoal: goal, businessProfile: enrichedProfile },
      });

      if (videoContentError) {
        console.error("Video content generation error:", videoContentError);
      }

      console.log("Inserting video asset...");
      const { data: videoAsset, error: videoAssetError } = await supabaseClient.from("assets").insert({
        name: `${campaignName} - Video`,
        type: "video",
        status: "review",
        channel: "video",
        goal: goal,
        created_by: user.id,
        workspace_id: workspaceId,
        content: {
          script: videoContent?.content || "",
          vertical,
          goal,
        },
      }).select().single();

      if (videoAssetError) {
        console.error("Video asset insert error:", videoAssetError);
      }

      if (videoAsset) {
        assetsCreated.push(videoAsset.id);
        console.log("Video asset created:", videoAsset.id);
        
        const { data: videoCampaign, error: videoCampaignError } = await supabaseClient.from("campaigns").insert({
          asset_id: videoAsset.id,
          channel: "video",
          status: "pending",
          budget_allocated: budgetPerChannel,
          workspace_id: workspaceId,
          target_audience: { vertical, campaignName, goal },
        }).select().single();
        
        if (videoCampaignError) {
          console.error("Video campaign insert error:", videoCampaignError);
        }
        
        if (videoCampaign) {
          campaignIds.push(videoCampaign.id);
        }
        
        // Trigger video generation in background
        supabaseClient.functions.invoke("generate-video", {
          body: {
            assetId: videoAsset.id,
            vertical,
            prompt: videoContent?.content || goal,
          },
        }).catch(console.error);
      }
    } catch (error) {
      console.error("Video generation failed:", error);
    }

    // Step 5: Generate voice campaign - linked to CRM leads with phone numbers
    try {
      console.log("Generating voice content...");
      const { data: voiceContent, error: voiceContentError } = await supabaseClient.functions.invoke("content-generate", {
        body: { vertical, contentType: "voice", assetGoal: goal, businessProfile: enrichedProfile },
      });

      if (voiceContentError) {
        console.error("Voice content generation error:", voiceContentError);
      }

      console.log("Inserting voice asset...");
      const { data: voiceAsset, error: voiceAssetError } = await supabaseClient.from("assets").insert({
        name: `${campaignName} - Voice Campaign`,
        type: "voice",
        status: "review",
        channel: "voice",
        goal: goal,
        created_by: user.id,
        workspace_id: workspaceId,
        content: {
          script: voiceContent?.content || "",
          vertical,
          goal,
          // Link to CRM leads with phone numbers for outbound calls
          target_leads: leadsWithPhone.map(l => ({ 
            id: l.id, 
            phone: l.phone, 
            name: `${l.first_name} ${l.last_name}`,
            company: l.company
          })),
          total_calls: leadsWithPhone.length,
          call_status: "pending", // pending, in_progress, completed
        },
      }).select().single();

      if (voiceAssetError) {
        console.error("Voice asset insert error:", voiceAssetError);
      }

      if (voiceAsset) {
        assetsCreated.push(voiceAsset.id);
        console.log("Voice asset created:", voiceAsset.id);
        
        // Create campaign record linked to leads
        const { data: voiceCampaign, error: voiceCampaignError } = await supabaseClient.from("campaigns").insert({
          asset_id: voiceAsset.id,
          channel: "voice",
          status: "pending",
          budget_allocated: budgetPerChannel,
          workspace_id: workspaceId,
          target_audience: { 
            vertical, 
            campaignName, 
            goal,
            lead_ids: leadsWithPhone.map(l => l.id),
            total_leads: leadsWithPhone.length,
          },
        }).select().single();
        
        if (voiceCampaignError) {
          console.error("Voice campaign insert error:", voiceCampaignError);
        }
        
        if (voiceCampaign) campaignIds.push(voiceCampaign.id);
      }
    } catch (error) {
      console.error("Voice campaign generation failed:", error);
    }

    console.log(`Campaign created with ${assetsCreated.length} assets and ${campaignIds.length} campaigns`);
    console.log(`Voice campaign linked to ${leadsWithPhone.length} leads with phone numbers`);
    console.log(`Email campaign linked to ${leadsWithEmail.length} leads with emails`);

    return new Response(
      JSON.stringify({
        success: true,
        campaignName,
        assetsCreated: assetsCreated.length,
        campaignsCreated: campaignIds.length,
        leadsScraped,
        leadsLinked: {
          voice: leadsWithPhone.length,
          email: leadsWithEmail.length,
        },
        assetIds: assetsCreated,
        campaignIds: campaignIds,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in campaign-orchestrator:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
