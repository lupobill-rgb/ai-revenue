import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Allowed redirect domains for OAuth security
const ALLOWED_REDIRECT_DOMAINS = [
  'ubigrowth.ai',
  'preview--ubigrowth-ai.lovable.app',
  'lovable.app',
  'localhost:5173',
  'localhost:3000',
];

function isRedirectSafe(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ALLOWED_REDIRECT_DOMAINS.some(domain => 
      parsed.hostname === domain || 
      parsed.hostname.endsWith(`.${domain}`) ||
      parsed.host === domain
    );
  } catch {
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify user is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("Missing Supabase configuration");
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error("Auth error:", userError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID");
    if (!clientId) {
      console.error("GOOGLE_OAUTH_CLIENT_ID not configured");
      return new Response(JSON.stringify({ error: "Google OAuth not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the redirect URL from request body with security validation
    const body = await req.json().catch(() => ({}));
    const requestedRedirect = typeof body.redirectUrl === 'string' ? body.redirectUrl : null;
    
    // Default to safe redirect, only use requested if it passes validation
    let finalRedirectUrl = "https://ubigrowth.ai/settings/integrations";
    if (requestedRedirect && isRedirectSafe(requestedRedirect)) {
      finalRedirectUrl = requestedRedirect;
    } else if (requestedRedirect) {
      console.warn("Rejected unsafe redirect URL:", requestedRedirect);
    }

    // Build OAuth URL
    const redirectUri = `${supabaseUrl}/functions/v1/gmail-oauth-callback`;
    const scope = "https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.email";
    
    // Store state with user_id and redirect URL for callback
    const state = btoa(JSON.stringify({ 
      user_id: user.id, 
      redirect_url: finalRedirectUrl 
    }));

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", scope);
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent");
    authUrl.searchParams.set("state", state);

    console.log("Generated OAuth URL for user:", user.id);

    return new Response(JSON.stringify({ authUrl: authUrl.toString() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error in gmail-oauth-start:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
