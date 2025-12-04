import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ContentInput {
  tenant_id: string;
  campaign_id?: string;
  assets: AssetInput[];
}

interface AssetInput {
  content_id?: string;
  title: string;
  content_type: string;
  channel?: string;
  funnel_stage?: string;
  target_icp?: string;
  key_message?: string;
  supporting_points?: string[];
  cta?: string;
  tone?: string;
  estimated_production_time?: string;
  dependencies?: string[];
  publish_date?: string;
  variants?: VariantInput[];
}

interface VariantInput {
  variant_name: string;
  variant_type?: string;
  subject_line?: string;
  headline?: string;
  body_content?: string;
  cta_text?: string;
  visual_description?: string;
  metadata?: any;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const input: ContentInput = await req.json();
    
    if (!input.tenant_id || !input.assets || input.assets.length === 0) {
      return new Response(JSON.stringify({ error: 'tenant_id and assets array are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const createdAssets: any[] = [];
    const createdVariants: any[] = [];

    // Insert each asset with its variants
    for (const assetInput of input.assets) {
      const { data: asset, error: assetError } = await supabase
        .from('cmo_content_assets')
        .insert({
          workspace_id: input.tenant_id,
          tenant_id: input.tenant_id,
          campaign_id: input.campaign_id,
          content_id: assetInput.content_id,
          title: assetInput.title,
          content_type: assetInput.content_type,
          channel: assetInput.channel,
          funnel_stage: assetInput.funnel_stage,
          target_icp: assetInput.target_icp,
          key_message: assetInput.key_message,
          supporting_points: assetInput.supporting_points || [],
          cta: assetInput.cta,
          tone: assetInput.tone,
          estimated_production_time: assetInput.estimated_production_time,
          dependencies: assetInput.dependencies || [],
          publish_date: assetInput.publish_date,
          created_by: user.id,
          status: 'draft'
        })
        .select()
        .single();

      if (assetError) {
        console.error('Error creating asset:', assetError);
        continue;
      }

      createdAssets.push(asset);

      // Insert variants if provided
      if (assetInput.variants && assetInput.variants.length > 0) {
        const variantInserts = assetInput.variants.map(variant => ({
          asset_id: asset.id,
          variant_name: variant.variant_name,
          variant_type: variant.variant_type || 'A',
          subject_line: variant.subject_line,
          headline: variant.headline,
          body_content: variant.body_content,
          cta_text: variant.cta_text,
          visual_description: variant.visual_description,
          metadata: variant.metadata || {}
        }));

        const { data: variantsData, error: variantsError } = await supabase
          .from('cmo_content_variants')
          .insert(variantInserts)
          .select();

        if (variantsError) {
          console.error('Error creating variants:', variantsError);
        } else {
          createdVariants.push(...(variantsData || []));
        }
      }
    }

    // Log agent run
    await supabase.from('agent_runs').insert({
      workspace_id: input.tenant_id,
      tenant_id: input.tenant_id,
      agent: 'cmo-generate-content',
      mode: 'generate',
      input: input,
      output: { assets: createdAssets, variants: createdVariants },
      status: 'completed'
    });

    console.log('Content generated:', createdAssets.length, 'assets,', createdVariants.length, 'variants');

    return new Response(JSON.stringify({ 
      success: true, 
      assets: createdAssets, 
      variants: createdVariants 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('cmo-generate-content error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
