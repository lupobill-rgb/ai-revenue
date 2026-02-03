import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimits, rateLimitResponse, getClientIp } from "../_shared/rate-limit.ts";
import { verifyAuth, unauthorizedResponse, createServiceClient } from "../_shared/auth.ts";

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
    const elevenLabsApiKey = Deno.env.get('ELEVENLABS_API_KEY');
    if (!elevenLabsApiKey) {
      return new Response(
        JSON.stringify({ error: 'ELEVENLABS_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { user, error: authError, supabaseClient } = await verifyAuth(req);
    if (authError || !user || !supabaseClient) {
      return unauthorizedResponse(corsHeaders, authError || "Not authenticated");
    }

    // Rate limiting per user + IP
    const serviceClient = createServiceClient();
    const clientIp = getClientIp(req);
    const rateLimitResult = await checkRateLimits(
      serviceClient,
      "execute-voice-campaign",
      user.id,
      clientIp,
      RATE_LIMIT_CONFIG
    );
    if (!rateLimitResult.allowed) {
      return rateLimitResponse(rateLimitResult, corsHeaders);
    }

    const { assetId, agentId, assistantId, tenantId } = await req.json();
    const effectiveAgentId = agentId || assistantId;

    if (!assetId || !effectiveAgentId) {
      return new Response(
        JSON.stringify({ error: 'assetId and agentId are required' }),
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

    // Use provided tenantId or fall back to user.id
    const effectiveTenantId = tenantId || user.id;

    const content = asset.content as any;
    const targetLeads = content?.target_leads || [];

    if (targetLeads.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No leads with phone numbers linked to this campaign' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[execute-voice-campaign] Executing for ${targetLeads.length} leads, tenant: ${effectiveTenantId}`);

    const results: { leadId: string; success: boolean; callId?: string; error?: string }[] = [];
    let successCount = 0;
    let failCount = 0;

    // Process calls sequentially with delay to avoid rate limits
    for (const lead of targetLeads) {
      // Generate idempotency key for this call
      const idempotencyKey = `voice_${assetId}_${lead.id}_${new Date().toISOString().slice(0, 10)}`;

      // Check if already sent via channel_outbox
      const { data: existingOutbox } = await serviceClient
        .from('channel_outbox')
        .select('id, status, provider_message_id')
        .eq('idempotency_key', idempotencyKey)
        .in('status', ['called', 'pending', 'queued'])
        .maybeSingle();

      if (existingOutbox) {
        console.log(`[execute-voice-campaign] Skipping duplicate call for lead ${lead.id}, existing status: ${existingOutbox.status}`);
        if (existingOutbox.status === 'called') {
          results.push({ leadId: lead.id, success: true, callId: existingOutbox.provider_message_id || undefined });
          successCount++;
        }
        continue;
      }

      try {
        const callPayload: any = {
          agent_id: effectiveAgentId,
          to_phone_number: lead.phone,
          metadata: {
            lead_id: lead.id,
            lead_name: lead.name || undefined,
            company: lead.company || undefined,
            campaign_asset_id: assetId,
          },
        };

        const response = await fetch('https://api.elevenlabs.io/v1/convai/conversations/phone', {
          method: 'POST',
          headers: {
            'xi-api-key': elevenLabsApiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(callPayload),
        });

        const responseText = await response.text();
        
        if (response.ok) {
          const callData = JSON.parse(responseText);
          results.push({ leadId: lead.id, success: true, callId: callData.conversation_id });
          successCount++;

          // Insert into channel_outbox with provider response
          const { error: outboxError } = await serviceClient
            .from('channel_outbox')
            .insert({
              tenant_id: effectiveTenantId,
              tenant_id: asset.tenant_id,
              channel: 'voice',
              provider: 'elevenlabs',
              idempotency_key: idempotencyKey,
              recipient_id: lead.id,
              recipient_phone: lead.phone,
              payload: callPayload,
              status: 'called',
              provider_message_id: callData.conversation_id,
              provider_response: callData,
            });

          if (outboxError) {
            console.error("[execute-voice-campaign] Failed to log to channel_outbox:", outboxError);
          } else {
            console.log(`[execute-voice-campaign] Logged call to channel_outbox: ${callData.conversation_id}`);
          }

          // Log activity to crm_activities (unified CRM spine)
          const { error: activityError } = await serviceClient
            .from('crm_activities')
            .insert({
              tenant_id: effectiveTenantId,
              contact_id: lead.contactId || null,
              lead_id: lead.crmLeadId || null,
              activity_type: 'voice_call',
              meta: {
                call_id: callData.conversation_id,
                asset_id: assetId,
                agent_id: effectiveAgentId,
                outcome: 'initiated',
                phone: lead.phone,
                lead_name: lead.name,
                campaign_name: asset.name,
              },
            });

          if (activityError) {
            console.error("[execute-voice-campaign] Failed to log CRM activity:", activityError);
          } else {
            console.log(`[execute-voice-campaign] Logged voice_call activity for lead: ${lead.id}`);
          }

          // Trigger auto-scoring for engaged lead
          try {
            await supabaseClient.functions.invoke('auto-score-lead', {
              body: { leadId: lead.id },
            });
          } catch (scoreError) {
            console.error("[execute-voice-campaign] Error triggering auto-score:", scoreError);
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

          // Log failed call to channel_outbox
          await serviceClient
            .from('channel_outbox')
            .insert({
              tenant_id: effectiveTenantId,
              tenant_id: asset.tenant_id,
              channel: 'voice',
              provider: 'elevenlabs',
              idempotency_key: idempotencyKey,
              recipient_id: lead.id,
              recipient_phone: lead.phone,
              payload: callPayload,
              status: 'failed',
              error: errorMessage,
            });
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

        // Log error to channel_outbox
        await serviceClient
          .from('channel_outbox')
          .insert({
            tenant_id: effectiveTenantId,
            tenant_id: asset.tenant_id,
            channel: 'voice',
            provider: 'elevenlabs',
            idempotency_key: idempotencyKey,
            recipient_id: lead.id,
            recipient_phone: lead.phone,
            payload: {},
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error',
          });
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

      // Create/update campaign metrics - include tenant_id
      await supabaseClient.from('campaign_metrics').upsert({
        campaign_id: campaign.id,
        tenant_id: asset.tenant_id,
        sent_count: targetLeads.length,
        delivered_count: successCount,
        bounce_count: failCount,
      }, { onConflict: 'campaign_id' });
    }

    console.log(`[execute-voice-campaign] Completed: ${successCount} successful, ${failCount} failed`);

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
    console.error('[execute-voice-campaign] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
