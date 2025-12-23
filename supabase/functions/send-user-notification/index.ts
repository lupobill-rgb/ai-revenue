import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("[send-user-notification] Starting notification send...");

    // Authorization check
    const internalSecret = req.headers.get("x-internal-secret");
    const authHeader = req.headers.get("authorization");
    
    const expectedSecrets = [
      Deno.env.get("INTERNAL_FUNCTION_SECRET"),
      Deno.env.get("INTERNAL_FUNCTION_SECRET_VAULT"),
      "ubigrowth-internal-2024-secure-key",  // Legacy hardcoded key for compatibility
    ].filter((v): v is string => typeof v === "string" && v.length > 0);

    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    const hasValidInternalSecret = !!internalSecret && expectedSecrets.some((s) => s === internalSecret);
    const hasValidServiceRole = !!authHeader && authHeader.startsWith("Bearer ") && authHeader.slice(7) === serviceRoleKey;

    if (!hasValidInternalSecret && !hasValidServiceRole) {
      console.log("[send-user-notification] Unauthorized request");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get request body
    const body = await req.json().catch(() => ({}));
    const { subject, message, test_only } = body;

    if (!subject || !message) {
      return new Response(JSON.stringify({ error: "Missing subject or message" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get all users with email addresses
    const { data: users, error: usersError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (usersError) {
      console.error("[send-user-notification] Error fetching users:", usersError);
      return new Response(JSON.stringify({ error: "Failed to fetch users" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const emailAddresses = users.users
      .filter(u => u.email && u.email.length > 0)
      .map(u => u.email!);

    console.log(`[send-user-notification] Found ${emailAddresses.length} users to notify`);

    if (test_only) {
      return new Response(JSON.stringify({ 
        message: "Test mode - no emails sent",
        recipients: emailAddresses,
        count: emailAddresses.length
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send emails
    const results: { email: string; success: boolean; error?: string }[] = [];

    for (const email of emailAddresses) {
      try {
        const emailResponse = await resend.emails.send({
          from: "UbiGrowth AI <updates@ubigrowth.com>",
          to: [email],
          subject: subject,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #333; margin-bottom: 20px;">${subject}</h2>
              <div style="color: #555; line-height: 1.6;">
                ${message.replace(/\n/g, '<br>')}
              </div>
              <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
              <p style="color: #888; font-size: 12px;">
                This email was sent by UbiGrowth AI. If you have questions, please contact support.
              </p>
            </div>
          `,
        });

        console.log(`[send-user-notification] Email sent to ${email}:`, emailResponse);
        results.push({ email, success: true });
      } catch (emailError: any) {
        console.error(`[send-user-notification] Failed to send to ${email}:`, emailError);
        results.push({ email, success: false, error: emailError.message });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`[send-user-notification] Complete: ${successCount} sent, ${failCount} failed`);

    return new Response(JSON.stringify({
      message: `Notification sent to ${successCount} users`,
      successCount,
      failCount,
      results
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("[send-user-notification] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);
