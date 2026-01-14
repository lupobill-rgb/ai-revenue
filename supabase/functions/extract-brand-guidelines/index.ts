import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.84.0";
import { openaiChatCompletionsRaw } from "../_shared/providers/openai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BrandRequest {
  websiteUrl: string;
  logoImageBase64?: string;
  forceRefresh?: boolean;
}

function extractDomain(url: string): string {
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return url.toLowerCase().replace(/[^a-z0-9.-]/g, "");
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { websiteUrl, logoImageBase64, forceRefresh }: BrandRequest = await req.json();
    
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const model = Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini";
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!FIRECRAWL_API_KEY) {
      throw new Error("FIRECRAWL_API_KEY is not configured");
    }
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    const domain = extractDomain(websiteUrl);
    console.log("Extracting brand for domain:", domain);

    // Check cache first (24h TTL)
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    
    if (!forceRefresh) {
      const { data: cached } = await supabase
        .from("brand_extraction_cache")
        .select("extracted_data, expires_at")
        .eq("domain", domain)
        .gt("expires_at", new Date().toISOString())
        .single();
      
      if (cached?.extracted_data) {
        console.log("Returning cached brand data for:", domain);
        return new Response(
          JSON.stringify({
            success: true,
            brandGuidelines: cached.extracted_data,
            cached: true,
            websiteTitle: cached.extracted_data.brandName || domain,
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          }
        );
      }
    }

    console.log("Scraping website with Firecrawl:", websiteUrl);

    // Use Firecrawl REST API with branding format for consistent extraction
    const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: websiteUrl.startsWith("http") ? websiteUrl : `https://${websiteUrl}`,
        formats: ['markdown', 'branding'],
        onlyMainContent: true,
        timeout: 30000,
      }),
    });

    if (!scrapeResponse.ok) {
      const errorText = await scrapeResponse.text();
      console.error("Firecrawl API error:", scrapeResponse.status, errorText);
      throw new Error(`Firecrawl scrape failed: ${scrapeResponse.status}`);
    }

    const scrapeResult = await scrapeResponse.json();
    console.log("Firecrawl scrape successful");

    const markdownContent = scrapeResult.data?.markdown || "";
    const metadata = scrapeResult.data?.metadata || {};
    const branding = scrapeResult.data?.branding || {};

    // Start with Firecrawl branding data if available
    let parsedBrandData: any = {
      brandName: metadata.title || branding.name || domain,
      primaryColor: branding.colors?.primary || "#000000",
      secondaryColor: branding.colors?.secondary || "#666666",
      accentColor: branding.colors?.accent || branding.colors?.background || "#0066cc",
      backgroundColor: branding.colors?.background || "#ffffff",
      textColor: branding.colors?.textPrimary || "#000000",
      headingFont: branding.typography?.fontFamilies?.heading || branding.fonts?.[0]?.family || "Inter",
      bodyFont: branding.typography?.fontFamilies?.primary || branding.fonts?.[1]?.family || "Inter",
      brandVoice: "",
      brandTone: "",
      messagingPillars: [],
      industry: "",
      logo: branding.images?.logo || "",
      favicon: branding.images?.favicon || metadata.favicon || "",
      colorScheme: branding.colorScheme || "light",
    };

    // Use AI to analyze brand voice and industry (deterministic prompt)
    console.log("Analyzing brand with AI...");

    const analysisPrompt = `Analyze this website content and extract brand voice and industry.

Website: ${metadata.title || domain}
URL: ${websiteUrl}
Content (truncated): ${markdownContent.substring(0, 6000)}

You must return ONLY a valid JSON object with exactly this structure (no extra fields):
{
  "brandVoice": "2-3 sentence description of brand voice and communication style",
  "brandTone": "Single word or short phrase describing tone (e.g., Professional, Friendly, Bold)",
  "messagingPillars": ["Key message 1", "Key message 2", "Key message 3"],
  "industry": "Single industry vertical name"
}

Guidelines:
- For brandVoice: describe how they communicate (formal/casual, technical/simple, etc.)
- For industry: pick ONE from this list: Accounting & Finance, Advertising & Marketing, Aerospace & Defense, Agriculture & Farming, Automotive, Banking & Financial Services, Biotechnology & Pharmaceuticals, Construction & Engineering, Consulting & Professional Services, Consumer Goods & Retail, E-commerce, Education & Training, Energy & Utilities, Entertainment & Media, Environmental Services, Food & Beverage, Government & Public Sector, Healthcare & Medical, Hospitality & Tourism, Human Resources & Staffing, Information Technology, Insurance, Legal Services, Logistics & Transportation, Manufacturing, Non-Profit & NGO, Real Estate & Property, Restaurants & Food Service, SaaS & Software, Sports & Recreation, Telecommunications, Travel & Leisure, Other
- For messagingPillars: extract 3 key value propositions

Return ONLY the JSON object, no markdown code blocks, no explanation.`;

    const aiResponse = await openaiChatCompletionsRaw(
      {
        model,
        messages: [{ role: "user", content: analysisPrompt }],
        temperature: 0.1, // Low temperature for determinism
      },
      OPENAI_API_KEY,
    );

    if (aiResponse.ok) {
      const aiData = await aiResponse.json();
      let analysisData = aiData.choices[0].message.content;
      analysisData = analysisData.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      try {
        const analysis = JSON.parse(analysisData);
        parsedBrandData.brandVoice = analysis.brandVoice || parsedBrandData.brandVoice;
        parsedBrandData.brandTone = analysis.brandTone || parsedBrandData.brandTone;
        parsedBrandData.messagingPillars = analysis.messagingPillars || parsedBrandData.messagingPillars;
        parsedBrandData.industry = analysis.industry || parsedBrandData.industry;
        console.log("AI brand analysis successful");
      } catch (e) {
        console.error("Failed to parse AI analysis:", e);
      }
    } else {
      console.error("AI analysis failed:", aiResponse.status);
    }

    // Analyze logo if provided (override colors)
    if (logoImageBase64) {
      console.log("Analyzing logo colors...");
      
      const logoAnalysisPrompt = `Analyze this logo image and extract the exact colors used. Return ONLY a valid JSON object:
{
  "dominantColor": "#hexcode",
  "accentColors": ["#hexcode1", "#hexcode2"]
}
Return ONLY JSON, no markdown.`;

      const logoResponse = await openaiChatCompletionsRaw(
        {
          model,
          messages: [{
            role: "user",
            content: [
              { type: "text", text: logoAnalysisPrompt },
              { type: "image_url", image_url: { url: logoImageBase64.startsWith("data:") ? logoImageBase64 : `data:image/png;base64,${logoImageBase64}` } },
            ],
          }],
          temperature: 0.1,
        },
        OPENAI_API_KEY,
      );

      if (logoResponse.ok) {
        const logoData = await logoResponse.json();
        let logoColorsRaw = logoData.choices[0].message.content;
        logoColorsRaw = logoColorsRaw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        
        try {
          const logoColors = JSON.parse(logoColorsRaw);
          if (logoColors.dominantColor) {
            parsedBrandData.primaryColor = logoColors.dominantColor;
          }
          if (logoColors.accentColors?.length > 0) {
            parsedBrandData.secondaryColor = logoColors.accentColors[0];
            if (logoColors.accentColors.length > 1) {
              parsedBrandData.accentColor = logoColors.accentColors[1];
            }
          }
          console.log("Logo color analysis successful");
        } catch (e) {
          console.error("Failed to parse logo colors:", e);
        }
      }
    }

    // Save to cache
    await supabase
      .from("brand_extraction_cache")
      .upsert({
        domain,
        extracted_data: parsedBrandData,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      }, { onConflict: "domain" });

    console.log("Brand extraction successful, cached for 24h");

    return new Response(
      JSON.stringify({
        success: true,
        brandGuidelines: parsedBrandData,
        cached: false,
        websiteTitle: metadata.title || domain,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error("Error in extract-brand-guidelines:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error occurred"
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
