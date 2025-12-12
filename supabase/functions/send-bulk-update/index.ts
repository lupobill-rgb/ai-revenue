import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const resend = new Resend(RESEND_API_KEY);

    // Get all users
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();
    
    if (usersError) {
      throw new Error(`Failed to list users: ${usersError.message}`);
    }

    // Get latest global release note
    const { data: releaseNote } = await supabase
      .from("release_notes")
      .select("title, body_md")
      .is("tenant_id", null)
      .order("released_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const subject = releaseNote
      ? `[UbiGrowth] Weekly Update – ${releaseNote.title}`
      : `[UbiGrowth] Weekly Platform Update`;

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    h1 { color: #1DA4FF; font-size: 24px; margin-bottom: 16px; }
    h2 { color: #1DA4FF; font-size: 20px; }
    .content { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .footer { font-size: 12px; color: #666; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px; }
    a { color: #1DA4FF; }
    ul { padding-left: 20px; }
    li { margin-bottom: 8px; }
  </style>
</head>
<body>
  <h1>Weekly UbiGrowth Update</h1>
  <p>Hi there,</p>
  <p>Here's what's new in your UbiGrowth Revenue OS this week:</p>
  <div class="content">
    ${releaseNote?.body_md ?? "<p>No major changes this week – just reliability and performance improvements.</p>"}
  </div>
  <p>Questions? Reply to this email or reach out to our team.</p>
  <div class="footer">
    <p>You're receiving this because you're a UbiGrowth user. 
    <a href="https://app.ubigrowth.com/settings">Update your preferences</a> anytime.</p>
    <p>© ${new Date().getFullYear()} UbiGrowth. All rights reserved.</p>
  </div>
</body>
</html>`;

    const results: { email: string; success: boolean; error?: string }[] = [];

    for (const user of users || []) {
      if (!user.email) continue;
      
      try {
        const result = await resend.emails.send({
          from: "UbiGrowth Updates <updates@ubigrowth.ai>",
          to: user.email,
          subject,
          html: htmlBody,
        });

        // Add delay to avoid rate limiting (2 req/sec limit)
        await new Promise(resolve => setTimeout(resolve, 600));

        if (result.error) {
          results.push({ email: user.email, success: false, error: result.error.message });
          console.error(`Failed to send to ${user.email}:`, result.error);
        } else {
          results.push({ email: user.email, success: true });
          console.log(`Sent to ${user.email}, messageId: ${result.data?.id}`);
        }
      } catch (e) {
        results.push({ email: user.email, success: false, error: String(e) });
        console.error(`Error sending to ${user.email}:`, e);
      }
    }

    const sent = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`Bulk update complete: ${sent} sent, ${failed} failed`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent, 
        failed,
        results 
      }), 
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error("Error in bulk update:", error);
    return new Response(
      JSON.stringify({ error: String(error) }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
