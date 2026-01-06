import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    // Parse state to get user_id and redirect URL with security validation
    let userId: string;
    let redirectUrl = "https://ubigrowth.ai/settings/integrations";
    
    try {
      if (!state) {
        throw new Error("Missing state parameter");
      }
      const stateData = JSON.parse(atob(state));
      
      // Validate userId is a UUID
      if (!stateData.user_id || typeof stateData.user_id !== 'string' || stateData.user_id.length < 32) {
        throw new Error("Invalid user_id in state");
      }
      userId = stateData.user_id;
      
      // Validate redirect URL is safe
      const candidateRedirect = stateData.redirect_url || redirectUrl;
      if (isRedirectSafe(candidateRedirect)) {
        redirectUrl = candidateRedirect;
      } else {
        console.warn("Unsafe redirect URL rejected:", candidateRedirect);
      }
    } catch (stateError) {
      console.error("Invalid state parameter:", stateError);
      return Response.redirect(`${redirectUrl}?gmail_error=invalid_state`);
    }

    if (error) {
      console.error("OAuth error:", error);
      return Response.redirect(`${redirectUrl}?gmail_error=${error}`);
    }

    if (!code) {
      console.error("No authorization code received");
      return Response.redirect(`${redirectUrl}?gmail_error=no_code`);
    }

    const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID")!;
    const clientSecret = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET")!;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Exchange code for tokens
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: `${supabaseUrl}/functions/v1/gmail-oauth-callback`,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error("Token exchange failed:", tokenData);
      return Response.redirect(`${redirectUrl}?gmail_error=token_exchange_failed`);
    }

    const { access_token, refresh_token, expires_in } = tokenData;

    if (!refresh_token) {
      console.error("No refresh token received - user may need to revoke access and try again");
      return Response.redirect(`${redirectUrl}?gmail_error=no_refresh_token`);
    }

    // Get user email from Google
    const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const userInfo = await userInfoResponse.json();
    const email = userInfo.email;

    if (!email) {
      console.error("Could not get user email from Google");
      return Response.redirect(`${redirectUrl}?gmail_error=no_email`);
    }

    // Calculate token expiration
    const tokenExpiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

    // Store tokens in database using service role
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { error: upsertError } = await supabase
      .from("user_gmail_tokens")
      .upsert({
        user_id: userId,
        email,
        access_token,
        refresh_token,
        token_expires_at: tokenExpiresAt,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "user_id",
      });

    if (upsertError) {
      console.error("Failed to store tokens:", upsertError);
      return Response.redirect(`${redirectUrl}?gmail_error=storage_failed`);
    }

    console.log("Gmail connected successfully for user:", userId, "email:", email);

    return Response.redirect(`${redirectUrl}?gmail_connected=true`);
  } catch (error) {
    console.error("Error in gmail-oauth-callback:", error);
    return Response.redirect(`https://ubigrowth.ai/settings/integrations?gmail_error=unknown`);
  }
});
