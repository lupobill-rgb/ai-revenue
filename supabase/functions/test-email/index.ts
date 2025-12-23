import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TestEmailRequest {
  recipients: string[];
  subject: string;
  body: string;
  workspaceId: string;
  assetId?: string;
  // Legacy support
  to?: string;
  fromName?: string;
  fromAddress?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestData: TestEmailRequest = await req.json();
    const { recipients, subject, body, workspaceId, assetId, to, fromName, fromAddress } = requestData;

    // Validate workspaceId
    if (!workspaceId) {
      return new Response(
        JSON.stringify({ error: "workspaceId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Support both new array format and legacy single 'to' format
    let emailList: string[] = [];
    if (recipients && Array.isArray(recipients)) {
      emailList = recipients.filter(e => e && typeof e === 'string' && e.includes('@'));
    } else if (to) {
      emailList = [to];
    }

    if (emailList.length === 0) {
      return new Response(
        JSON.stringify({ error: "No valid email recipients provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (emailList.length > 20) {
      return new Response(
        JSON.stringify({ error: "Maximum 20 test recipients allowed" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client to fetch workspace email settings
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch workspace email settings
    const { data: emailSettings, error: settingsError } = await supabase
      .from("ai_settings_email")
      .select("sender_name, from_address")
      .eq("tenant_id", workspaceId)
      .maybeSingle();

    if (settingsError) {
      console.error("[test-email] Error fetching email settings:", settingsError);
    }

    // Use workspace settings, fall back to provided values or defaults
    let senderName = emailSettings?.sender_name || fromName || "UbiGrowth";
    let senderAddress = emailSettings?.from_address || fromAddress || "onboarding@resend.dev";

    // Validate that we have a proper from address (not the resend default unless no settings)
    if (!emailSettings?.from_address && senderAddress === "onboarding@resend.dev") {
      console.warn("[test-email] No custom email domain configured, using Resend default");
    }

    const emailSubject = subject || "Test Email";
    const emailBody = body || `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1>Test Email</h1>
        <p>This is a test email to verify your email configuration.</p>
        <p>Sent at: ${new Date().toISOString()}</p>
      </div>
    `;

    console.log(`[test-email] Sending to ${emailList.length} recipient(s) from ${senderName} <${senderAddress}>`);
    console.log(`[test-email] Workspace: ${workspaceId}, Asset: ${assetId || 'N/A'}`);

    // Send to all recipients
    const results = await Promise.allSettled(
      emailList.map(async (recipient) => {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: `${senderName} <${senderAddress}>`,
            to: [recipient],
            subject: emailSubject,
            html: emailBody,
          }),
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          console.error(`[test-email] Resend error for ${recipient}:`, errorData);
          throw new Error(errorData.message || `Failed to send to ${recipient}`);
        }
        
        return { recipient, response: await response.json() };
      })
    );

    const successful = results.filter(r => r.status === 'fulfilled');
    const failed = results.filter(r => r.status === 'rejected');

    console.log(`[test-email] Sent: ${successful.length}, Failed: ${failed.length}`);

    if (failed.length > 0) {
      failed.forEach((f, i) => {
        if (f.status === 'rejected') {
          console.error(`[test-email] Failed:`, f.reason);
        }
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        sentCount: successful.length,
        failedCount: failed.length,
        recipients: emailList,
        from: `${senderName} <${senderAddress}>`,
        subject: emailSubject,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[test-email] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
