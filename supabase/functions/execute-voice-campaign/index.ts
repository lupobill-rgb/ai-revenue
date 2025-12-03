import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, rateLimitResponse } from "../_shared/rate-limit.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limit config: 10/min, 50/hour, 200/day (voice API costs)
const RATE_LIMIT_CONFIG = { perMinute: 10, perHour: 50, perDay: 200 };

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const vapiPrivateKey = Deno.env.get('VAPI_PRIVATE_KEY');
    if (!vapiPrivateKey) {
      return new Response(
        JSON.stringify({ error: 'VAPI_PRIVATE_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authHeader = req.headers.get("Authorization");
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader! } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    // Rate limiting per user
    const rateLimitResult = await checkRateLimit(`voice_campaign:${user.id}`, RATE_LIMIT_CONFIG);
    if (!rateLimitResult.allowed) {
      console.warn(`[execute-voice-campaign] Rate limit exceeded for user ${user.id}`);
      return rateLimitResponse(rateLimitResult, corsHeaders);
    }

    const { assetId, assistantId, phoneNumberId } = await req.json();

    if (!assetId || !assistantId) {
      return new Response(
        JSON.stringify({ error: 'assetId and assistantId are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch the voice asset
    const { data: asset, error: assetError } = await supabaseClient
      .from('assets')
      .select('*')
      .eq('id', assetId)
      .eq('type', 'voice')
      .single();

    if (assetError || !asset) {
      return new Response(
        JSON.stringify({ error: 'Voice asset not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const content = asset.content as any;
    const targetLeads = content?.target_leads || [];

    if (targetLeads.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No leads with phone numbers linked to this campaign' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Executing voice campaign for ${targetLeads.length} leads`);

    const results: { leadId: string; success: boolean; callId?: string; error?: string }[] = [];
    let successCount = 0;
    let failCount = 0;

    // Process calls sequentially with delay to avoid rate limits
    for (const lead of targetLeads) {
      try {
        const callPayload: any = {
          assistantId,
          customer: {
            number: lead.phone,
            name: lead.name || undefined,
          },
        };

        if (phoneNumberId) {
          callPayload.phoneNumberId = phoneNumberId;
        }

        const response = await fetch('https://api.vapi.ai/call/phone', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${vapiPrivateKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(callPayload),
        });

        const responseText = await response.text();
        
        if (response.ok) {
          const callData = JSON.parse(responseText);
          results.push({ leadId: lead.id, success: true, callId: callData.id });
          successCount++;

          // Log activity for the lead - include workspace_id for RLS
          await supabaseClient.from('lead_activities').insert({
            lead_id: lead.id,
            activity_type: 'outbound_call',
            description: `Outbound call initiated via voice campaign: ${asset.name}`,
            created_by: user.id,
            workspace_id: asset.workspace_id,
            metadata: { callId: callData.id, assetId, assistantId },
          });

          // Trigger auto-scoring for engaged lead using user's JWT (RLS enforced)
          try {
            await supabaseClient.functions.invoke('auto-score-lead', {
              body: { leadId: lead.id },
            });
          } catch (scoreError) {
            console.error("Error triggering auto-score:", scoreError);
          }
        } else {
          let errorMessage = 'Call failed';
          try {
            const errorData = JSON.parse(responseText);
            errorMessage = errorData.message || errorData.error || errorMessage;
          } catch {
            errorMessage = responseText || errorMessage;
          }
          results.push({ leadId: lead.id, success: false, error: errorMessage });
          failCount++;
        }

        // Add delay between calls to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        results.push({ 
          leadId: lead.id, 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
        failCount++;
      }
    }

    // Update asset with call status
    await supabaseClient.from('assets').update({
      content: {
        ...content,
        call_status: 'completed',
        calls_made: successCount,
        calls_failed: failCount,
        last_executed_at: new Date().toISOString(),
      },
      status: 'live',
    }).eq('id', assetId);

    // Update campaign status
    const { data: campaign } = await supabaseClient
      .from('campaigns')
      .select('id')
      .eq('asset_id', assetId)
      .single();

    if (campaign) {
      await supabaseClient.from('campaigns').update({
        status: 'live',
        deployed_at: new Date().toISOString(),
      }).eq('id', campaign.id);

      // Create/update campaign metrics - include workspace_id
      await supabaseClient.from('campaign_metrics').upsert({
        campaign_id: campaign.id,
        workspace_id: asset.workspace_id,
        sent_count: targetLeads.length,
        delivered_count: successCount,
        bounce_count: failCount,
      }, { onConflict: 'campaign_id' });
    }

    console.log(`Voice campaign completed: ${successCount} successful, ${failCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        totalLeads: targetLeads.length,
        successCount,
        failCount,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in execute-voice-campaign:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
