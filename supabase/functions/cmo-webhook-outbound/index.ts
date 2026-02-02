import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type IntegrationType = 'gohighlevel' | 'twilio' | 'meta_ads' | 'webhook';

interface WebhookRequest {
  tenant_id: string;
  integration: IntegrationType;
  action: string;
  payload: any;
}

// Integration configurations stored per tenant
interface IntegrationConfig {
  gohighlevel?: {
    api_key: string;
    location_id: string;
    base_url?: string;
  };
  twilio?: {
    account_sid: string;
    auth_token: string;
    from_number: string;
  };
  meta_ads?: {
    access_token: string;
    ad_account_id: string;
    app_id?: string;
  };
  webhook?: {
    url: string;
    secret?: string;
    headers?: Record<string, string>;
  };
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

    const { tenant_id, integration, action, payload }: WebhookRequest = await req.json();

    if (!tenant_id || !integration || !action) {
      return new Response(JSON.stringify({ 
        error: 'tenant_id, integration, and action are required' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch tenant's integration config from tenant settings
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('settings')
      .eq('id', tenant_id)
      .single();

    if (tenantError || !tenant) {
      return new Response(JSON.stringify({ error: 'Tenant not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const integrations: IntegrationConfig = tenant.settings?.integrations || {};
    const config = integrations[integration];

    if (!config) {
      return new Response(JSON.stringify({ 
        error: `Integration ${integration} not configured for this tenant`,
        hint: 'Configure integrations in tenant settings'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let result: any;

    switch (integration) {
      case 'gohighlevel':
        result = await handleGoHighLevel(config, action, payload);
        break;
      case 'twilio':
        result = await handleTwilio(config, action, payload);
        break;
      case 'meta_ads':
        result = await handleMetaAds(config, action, payload);
        break;
      case 'webhook':
        result = await handleGenericWebhook(config, action, payload);
        break;
      default:
        return new Response(JSON.stringify({ error: `Unknown integration: ${integration}` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    // Log the outbound call
    await supabase.from('agent_runs').insert({
      tenant_id: tenant_id,
      tenant_id: tenant_id,
      agent: 'cmo-webhook-outbound',
      mode: `${integration}:${action}`,
      input: { payload },
      output: result,
      status: result.success ? 'completed' : 'failed'
    });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Webhook outbound error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function handleGoHighLevel(config: any, action: string, payload: any) {
  const baseUrl = config.base_url || 'https://rest.gohighlevel.com/v1';
  
  const endpoints: Record<string, { method: string; path: string }> = {
    'create_contact': { method: 'POST', path: '/contacts' },
    'update_contact': { method: 'PUT', path: `/contacts/${payload.contact_id}` },
    'create_opportunity': { method: 'POST', path: '/opportunities' },
    'add_to_campaign': { method: 'POST', path: `/contacts/${payload.contact_id}/campaigns/${payload.campaign_id}` },
    'send_sms': { method: 'POST', path: '/conversations/messages' },
  };

  const endpoint = endpoints[action];
  if (!endpoint) {
    return { success: false, error: `Unknown GoHighLevel action: ${action}` };
  }

  try {
    const response = await fetch(`${baseUrl}${endpoint.path}`, {
      method: endpoint.method,
      headers: {
        'Authorization': `Bearer ${config.api_key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...payload, locationId: config.location_id }),
    });

    const data = await response.json();
    return { success: response.ok, data };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Request failed' };
  }
}

async function handleTwilio(config: any, action: string, payload: any) {
  const baseUrl = `https://api.twilio.com/2010-04-01/Accounts/${config.account_sid}`;
  const auth = btoa(`${config.account_sid}:${config.auth_token}`);

  if (action === 'send_sms') {
    try {
      const response = await fetch(`${baseUrl}/Messages.json`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: payload.to,
          From: config.from_number,
          Body: payload.body,
        }),
      });

      const data = await response.json();
      return { success: response.ok, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Request failed' };
    }
  }

  if (action === 'make_call') {
    try {
      const response = await fetch(`${baseUrl}/Calls.json`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: payload.to,
          From: config.from_number,
          Url: payload.twiml_url,
        }),
      });

      const data = await response.json();
      return { success: response.ok, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Request failed' };
    }
  }

  return { success: false, error: `Unknown Twilio action: ${action}` };
}

async function handleMetaAds(config: any, action: string, payload: any) {
  const baseUrl = 'https://graph.facebook.com/v18.0';

  const endpoints: Record<string, { method: string; path: string }> = {
    'create_campaign': { method: 'POST', path: `/act_${config.ad_account_id}/campaigns` },
    'create_adset': { method: 'POST', path: `/act_${config.ad_account_id}/adsets` },
    'create_ad': { method: 'POST', path: `/act_${config.ad_account_id}/ads` },
    'get_insights': { method: 'GET', path: `/${payload.object_id}/insights` },
    'pause_campaign': { method: 'POST', path: `/${payload.campaign_id}` },
  };

  const endpoint = endpoints[action];
  if (!endpoint) {
    return { success: false, error: `Unknown Meta Ads action: ${action}` };
  }

  try {
    const url = new URL(`${baseUrl}${endpoint.path}`);
    url.searchParams.set('access_token', config.access_token);

    const options: RequestInit = { method: endpoint.method };
    
    if (endpoint.method === 'POST') {
      options.headers = { 'Content-Type': 'application/json' };
      options.body = JSON.stringify(payload);
    } else if (endpoint.method === 'GET' && payload.params) {
      Object.entries(payload.params).forEach(([key, value]) => {
        url.searchParams.set(key, String(value));
      });
    }

    const response = await fetch(url.toString(), options);
    const data = await response.json();
    return { success: response.ok, data };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Request failed' };
  }
}

async function handleGenericWebhook(config: any, action: string, payload: any) {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...config.headers,
    };

    if (config.secret) {
      // Add HMAC signature for webhook security
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(config.secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const signature = await crypto.subtle.sign(
        'HMAC',
        key,
        encoder.encode(JSON.stringify(payload))
      );
      headers['X-Webhook-Signature'] = btoa(String.fromCharCode(...new Uint8Array(signature)));
    }

    const response = await fetch(config.url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ action, ...payload, timestamp: new Date().toISOString() }),
    });

    let data;
    try {
      data = await response.json();
    } catch {
      data = { status: response.status, statusText: response.statusText };
    }

    return { success: response.ok, data };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Request failed' };
  }
}
