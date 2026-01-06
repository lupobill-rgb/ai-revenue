import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth, createServiceClient } from "../_shared/auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Generate idempotency key using SHA-256
async function generateIdempotencyKey(parts: string[]): Promise<string> {
  const data = parts.filter(Boolean).join("|");
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const vapiPrivateKey = Deno.env.get('VAPI_PRIVATE_KEY');
    
    if (!vapiPrivateKey) {
      console.error('VAPI_PRIVATE_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'VAPI_PRIVATE_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify auth - user is optional for this endpoint (can be called by system)
    const { user, supabaseClient } = await verifyAuth(req);
    const serviceClient = createServiceClient();

    const { 
      assistantId, 
      phoneNumberId, 
      customerNumber, 
      customerName, 
      leadId,
      tenantId,
      workspaceId,
      campaignId 
    } = await req.json();

    if (!assistantId || !customerNumber) {
      return new Response(
        JSON.stringify({ error: 'assistantId and customerNumber are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Derive tenant context
    const effectiveTenantId = tenantId || user?.id || "unknown";
    const effectiveWorkspaceId = workspaceId || effectiveTenantId;

    console.log(`[vapi-outbound-call] Initiating call to ${customerNumber} with assistant ${assistantId}`);

    // Build the call payload
    const callPayload: Record<string, unknown> = {
      assistantId,
      customer: {
        number: customerNumber,
        name: customerName || undefined,
      },
    };

    // Add phoneNumberId if provided
    if (phoneNumberId) {
      callPayload.phoneNumberId = phoneNumberId;
    }

    // Generate idempotency key for this call
    const idempotencyKey = await generateIdempotencyKey([
      effectiveTenantId,
      leadId || customerNumber,
      assistantId,
      new Date().toISOString().slice(0, 10), // Daily uniqueness
    ]);

    // IDEMPOTENCY: Insert outbox entry BEFORE provider call with status 'queued'
    const { data: insertedOutbox, error: insertError } = await serviceClient
      .from("channel_outbox")
      .insert({
        tenant_id: effectiveTenantId,
        workspace_id: effectiveWorkspaceId,
        channel: "voice",
        provider: "vapi",
        recipient_id: leadId || null,
        recipient_phone: customerNumber,
        payload: { 
          assistant_id: assistantId,
          phone_number_id: phoneNumberId,
          customer_name: customerName,
          campaign_id: campaignId,
        },
        status: "queued",
        idempotency_key: idempotencyKey,
        skipped: false,
      })
      .select("id")
      .single();

    // If insert failed due to unique constraint (idempotent replay), skip call
    if (insertError) {
      if (insertError.code === "23505") {
        console.log(`[vapi-outbound-call] Idempotent skip - call already queued for ${customerNumber}`);
        await serviceClient
          .from("channel_outbox")
          .update({ skipped: true, skip_reason: "idempotent_replay" })
          .eq("tenant_id", effectiveTenantId)
          .eq("workspace_id", effectiveWorkspaceId)
          .eq("idempotency_key", idempotencyKey);
        
        return new Response(
          JSON.stringify({ 
            success: false, 
            skipped: true,
            reason: "Duplicate call prevented by idempotency check",
            message: `Call to ${customerNumber} already attempted today` 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.error("[vapi-outbound-call] Failed to insert outbox:", insertError);
    }

    const outboxId = insertedOutbox?.id;

    // Make the outbound call via Vapi API
    const response = await fetch('https://api.vapi.ai/call/phone', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${vapiPrivateKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(callPayload),
    });

    const responseText = await response.text();
    console.log('[vapi-outbound-call] Vapi API response:', response.status, responseText);

    if (!response.ok) {
      let errorMessage = 'Failed to initiate call';
      try {
        const errorData = JSON.parse(responseText);
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch {
        errorMessage = responseText || errorMessage;
      }
      
      // Update outbox with failure
      if (outboxId) {
        await serviceClient
          .from("channel_outbox")
          .update({
            status: "failed",
            error: errorMessage,
          })
          .eq("id", outboxId);
      }
      
      return new Response(
        JSON.stringify({ error: errorMessage, status: response.status }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const callData = JSON.parse(responseText);
    console.log('[vapi-outbound-call] Call initiated successfully, provider_message_id:', callData.id);

    // Update outbox with success and provider_message_id (V1 requirement)
    if (outboxId) {
      await serviceClient
        .from("channel_outbox")
        .update({
          status: "called",
          provider_message_id: callData.id,
          provider_response: callData,
        })
        .eq("id", outboxId);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        callId: callData.id,
        provider_message_id: callData.id,
        status: callData.status,
        message: `Call initiated to ${customerNumber}` 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[vapi-outbound-call] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
