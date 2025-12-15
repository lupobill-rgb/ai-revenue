import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Only allow test emails to these addresses for safety
const ALLOWED_TEST_EMAILS = ["bill@ubigrowth.com", "test@ubigrowth.com"];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, subject, body, fromName, fromAddress } = await req.json();

    if (!to || !ALLOWED_TEST_EMAILS.includes(to.toLowerCase())) {
      return new Response(
        JSON.stringify({ error: `Test emails only allowed to: ${ALLOWED_TEST_EMAILS.join(", ")}` }),
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

    const senderName = fromName || "UbiGrowth Test";
    const senderAddress = fromAddress || "onboarding@resend.dev";
    const emailSubject = subject || "Test Email from UbiGrowth";
    const emailBody = body || `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #1DA4FF;">Test Email</h1>
        <p>This is a test email to verify your email configuration is working correctly.</p>
        <p>Sent at: ${new Date().toISOString()}</p>
        <hr style="border: 1px solid #eee; margin: 20px 0;" />
        <p style="color: #666; font-size: 12px;">
          If you received this email, your email delivery is configured correctly.
        </p>
      </div>
    `;

    console.log(`[test-email] Sending test email to ${to} from ${senderName} <${senderAddress}>`);

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${senderName} <${senderAddress}>`,
        to: [to],
        subject: emailSubject,
        html: emailBody,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error(`[test-email] Resend error:`, result);
      return new Response(
        JSON.stringify({ error: result.message || "Failed to send email", details: result }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[test-email] Success! Email ID: ${result.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        emailId: result.id,
        to,
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
