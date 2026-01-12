import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { runLLM } from "../_shared/llmRouter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-workspace-id, x-tenant-id",
  "Access-Control-Expose-Headers": "x-ai-revenue-build",
  "x-ai-revenue-build": "content-generate-llm-router-v1",
};

interface ContentRequest {
  vertical: string;
  contentType: 'email' | 'social' | 'landing_page' | 'video' | 'voice';
  assetGoal?: string;
  tone?: string;
  businessProfile?: any;
  workspaceId?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing or invalid Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return new Response(JSON.stringify({ error: "Missing or invalid Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized", details: userError?.message || "Invalid JWT" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { vertical, contentType, assetGoal, tone = 'professional', businessProfile, workspaceId: bodyWorkspaceId }: ContentRequest =
      await req.json();

    const workspaceId = req.headers.get("x-workspace-id") || req.headers.get("x-tenant-id") || bodyWorkspaceId || null;
    if (!workspaceId) {
      return new Response(
        JSON.stringify({ error: "Missing workspace context", missing: ["x-workspace-id"] }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate workspace membership (owner or member)
    const { data: workspace, error: wsError } = await supabase
      .from("workspaces")
      .select("id, owner_id")
      .eq("id", workspaceId)
      .maybeSingle();

    if (wsError || !workspace) {
      return new Response(JSON.stringify({ error: "Invalid workspace", details: wsError?.message || "Not found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let hasAccess = workspace.owner_id === user.id;
    if (!hasAccess) {
      const { data: membership, error: membershipError } = await supabase
        .from("workspace_members")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (membershipError) {
        return new Response(JSON.stringify({ error: "Workspace membership check failed", details: membershipError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      hasAccess = !!membership;
    }

    if (!hasAccess) {
      return new Response(JSON.stringify({ error: "Forbidden: workspace access denied" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Generating ${contentType} content for ${vertical}`);

    // Build business context from profile if available
    let businessContext = '';
    let businessName = 'your business';
    
    if (businessProfile) {
      const parts = [];
      
      if (businessProfile.business_name) {
        businessName = businessProfile.business_name;
        parts.push(`Business Name: ${businessProfile.business_name}`);
      }
      if (businessProfile.business_description) parts.push(`Business Description: ${businessProfile.business_description}`);
      if (businessProfile.industry) parts.push(`Industry: ${businessProfile.industry}`);
      
      if (businessProfile.unique_selling_points?.length > 0) {
        parts.push(`Unique Selling Points: ${businessProfile.unique_selling_points.join(', ')}`);
      }
      if (businessProfile.competitive_advantages) parts.push(`Competitive Advantages: ${businessProfile.competitive_advantages}`);
      
      if (businessProfile.brand_voice) parts.push(`Brand Voice: ${businessProfile.brand_voice}`);
      if (businessProfile.brand_tone) parts.push(`Brand Tone: ${businessProfile.brand_tone}`);
      
      if (businessProfile.messaging_pillars?.length > 0) {
        parts.push(`Key Messaging Pillars: ${businessProfile.messaging_pillars.join(', ')}`);
      }
      if (businessProfile.cta_patterns?.length > 0) {
        parts.push(`Preferred CTAs: ${businessProfile.cta_patterns.join(', ')}`);
      }
      
      if (businessProfile.target_audiences && Object.keys(businessProfile.target_audiences).length > 0) {
        const audiences = typeof businessProfile.target_audiences === 'object' 
          ? JSON.stringify(businessProfile.target_audiences) 
          : businessProfile.target_audiences;
        parts.push(`Target Audiences: ${audiences}`);
      }
      
      if (parts.length > 0) {
        businessContext = '\n\nBUSINESS CONTEXT:\n' + parts.join('\n');
      }
    }

    // Add campaign performance insights if available
    if (businessProfile?.campaign_insights) {
      const insights = businessProfile.campaign_insights;
      const perfParts = [];
      if (insights.avg_engagement_rate) perfParts.push(`Average Engagement: ${insights.avg_engagement_rate}%`);
      if (insights.total_conversions) perfParts.push(`Total Conversions: ${insights.total_conversions}`);
      if (insights.performance_note) perfParts.push(`Performance Note: ${insights.performance_note}`);
      if (perfParts.length > 0) {
        businessContext += '\n\nPREVIOUS CAMPAIGN INSIGHTS:\n' + perfParts.join('\n');
      }
    }

    const effectiveTone = businessProfile?.content_tone || businessProfile?.brand_tone || tone;

    // Build AI prompt based on content type
    let systemPrompt = '';
    let userPrompt = '';
    let titlePrompt = '';

    if (contentType === 'email') {
      systemPrompt = `You are an expert email marketing copywriter specializing in the ${vertical} industry.
Create compelling, conversion-focused email content with a ${effectiveTone} tone.${businessContext}

IMPORTANT RULES:
- Write in plain text without markdown formatting (no **, *, ##, etc.)
- Create a compelling subject line
- Include personalization placeholders: {{first_name}}, {{company}}, {{location}} where appropriate
- Include a clear call-to-action
- Keep the email concise but impactful

Format your response EXACTLY as:
Subject: [Your subject line here]

[Email body starts here]`;
      
      userPrompt = assetGoal 
        ? `Create an email campaign for ${businessName} in the ${vertical} industry with this goal: ${assetGoal}` 
        : `Create a promotional email campaign for ${businessName} in the ${vertical} industry.`;
      
      titlePrompt = `${businessName} ${vertical} Email Campaign`;
    } else if (contentType === 'social') {
      systemPrompt = `You are an expert social media content creator for the ${vertical} industry.
Create engaging, shareable social media posts with a ${effectiveTone} tone.${businessContext}

IMPORTANT RULES:
- Write in plain text without markdown formatting
- Keep posts concise (under 280 characters for Twitter, under 2200 for Instagram)
- Include relevant hashtags
- Include a clear call-to-action
- Make it engaging and shareable`;
      
      userPrompt = assetGoal 
        ? `Create a social media post for ${businessName} in ${vertical} with this goal: ${assetGoal}` 
        : `Create an engaging social media post for ${businessName} in ${vertical}.`;
      
      titlePrompt = `${businessName} ${vertical} Social Post`;
    } else if (contentType === 'video') {
      systemPrompt = `You are an expert video marketing scriptwriter specializing in the ${vertical} industry.
Create compelling video scripts with a ${effectiveTone} tone.${businessContext}

IMPORTANT RULES:
- Write in plain text without markdown formatting
- Include: opening hook, main message, key benefits, and strong call-to-action
- Format as a natural script with clear sections
- Keep it engaging and actionable
- Include scene descriptions in [brackets]`;
      
      userPrompt = assetGoal 
        ? `Create a video script for ${businessName} in ${vertical} with this goal: ${assetGoal}` 
        : `Create a promotional video script for ${businessName} in ${vertical}.`;
      
      titlePrompt = `${businessName} ${vertical} Video Script`;
    } else if (contentType === 'voice') {
      systemPrompt = `You are an expert voice call script writer specializing in the ${vertical} industry.
Create natural, conversational call scripts for ${businessName} with a ${effectiveTone} tone.${businessContext}

IMPORTANT RULES:
- Write in plain text without markdown formatting
- Make it sound natural and conversational (this will be read by AI voice)
- Include personalization: use {{first_name}} and {{company}} placeholders
- Keep sentences short and easy to speak
- Make all content specific to ${businessName} - never use generic company names

Structure your response in THREE SECTIONS separated by double newlines:

SECTION 1 - OPENING SCRIPT:
A warm, professional greeting introducing ${businessName} and the purpose of the call.

SECTION 2 - PITCH SCRIPT:
The main value proposition for ${businessName}, highlighting key benefits and offers.

SECTION 3 - OBJECTION HANDLING:
Natural responses to common concerns, always relating back to ${businessName}'s strengths.`;
      
      userPrompt = assetGoal 
        ? `Create a complete outbound voice call script for ${businessName} in ${vertical} with this goal: ${assetGoal}. Remember to make all content specific to ${businessName}, not generic.` 
        : `Create a complete outbound call script for ${businessName} in ${vertical}. Make sure all content is specific to ${businessName} and their services.`;
      
      titlePrompt = `${businessName} ${vertical} Voice Script`;
    } else {
      systemPrompt = `You are an expert landing page copywriter for the ${vertical} industry.
Create persuasive landing page content with a ${effectiveTone} tone.${businessContext}

IMPORTANT RULES:
- Write in plain text without markdown formatting
- Include: headline, subheadline, key benefits, testimonial placeholder, and CTA
- Make it conversion-focused`;
      
      userPrompt = assetGoal 
        ? `Create landing page content for ${businessName} in ${vertical} with this goal: ${assetGoal}` 
        : `Create a landing page for ${businessName} in ${vertical}.`;
      
      titlePrompt = `${businessName} ${vertical} Landing Page`;
    }

    // Validate required payload fields
    const missing: string[] = [];
    if (!vertical || typeof vertical !== "string") missing.push("vertical");
    if (!contentType || typeof contentType !== "string") missing.push("contentType");
    if (missing.length > 0) {
      return new Response(JSON.stringify({ error: "Missing required fields", missing }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[content-generate] Calling LLM router for ${contentType}`);

    const out = await runLLM({
      tenantId: workspaceId,
      capability: "content.generate",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      maxTokens: 1200,
      timeoutMs: 25_000,
    });

    if (out.kind !== "text") {
      return new Response(JSON.stringify({ error: "AI generation failed", details: "Unexpected streaming response" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const generatedContent = out.text;

    console.log(`AI generated content successfully for ${contentType}`);

    // Clean up markdown
    const cleanContent = (text: string): string => {
      return text
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .replace(/_([^_]+)_/g, '$1')
        .replace(/^#+\s+/gm, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/[`~]/g, '')
        .replace(/  +/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    };

    // Extract subject line for emails
    let subject = '';
    let content = cleanContent(generatedContent);
    
    if (contentType === 'email') {
      const subjectMatch = generatedContent.match(/Subject:?\s*(.+?)(?:\n|$)/i);
      if (subjectMatch) {
        subject = cleanContent(subjectMatch[1].trim());
        content = cleanContent(generatedContent.replace(subjectMatch[0], '').trim());
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        title: titlePrompt,
        content,
        subject,
        vertical,
        contentType,
        tone: effectiveTone
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error("Error in content-generate:", error);
    return new Response(
      JSON.stringify({
        error: "Unhandled error",
        details: error instanceof Error ? error.message : "Unknown error occurred"
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
