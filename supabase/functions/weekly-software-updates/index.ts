import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
};

interface SoftwareUpdate {
  title: string;
  description: string;
  type: 'feature' | 'improvement' | 'maintenance' | 'fix' | 'notice';
  date: string;
}

interface RequestBody {
  cron?: boolean;
  customUpdates?: SoftwareUpdate[];
  subject?: string;
}

// Get the latest updates - in production, these would come from a database table
function getLatestUpdates(): SoftwareUpdate[] {
  // TODO: Replace with actual database query when updates table is created
  return [];
}

function formatUpdateType(type: string): string {
  const icons: Record<string, string> = {
    feature: '🚀',
    improvement: '✨',
    maintenance: '🔧',
    fix: '🐛',
    notice: '📢'
  };
  const labels: Record<string, string> = {
    feature: 'New Feature',
    improvement: 'Improvement',
    maintenance: 'Maintenance',
    fix: 'Bug Fix',
    notice: 'Notice'
  };
  return `${icons[type] || '📢'} ${labels[type] || type}`;
}

function generateEmailHtml(updates: SoftwareUpdate[], userName: string): string {
  const updatesList = updates.length > 0 
    ? updates.map(update => `
      <tr>
        <td style="padding: 16px; border-bottom: 1px solid #eee;">
          <div style="font-size: 12px; color: #666; margin-bottom: 4px;">
            ${formatUpdateType(update.type)} • ${update.date}
          </div>
          <div style="font-size: 16px; font-weight: 600; color: #333; margin-bottom: 8px;">
            ${update.title}
          </div>
          <div style="font-size: 14px; color: #555; line-height: 1.5;">
            ${update.description}
          </div>
        </td>
      </tr>
    `).join('')
    : `
      <tr>
        <td style="padding: 32px; text-align: center; color: #666;">
          <p>No major updates this week. We're working on exciting new features!</p>
          <p>Stay tuned for next week's digest.</p>
        </td>
      </tr>
    `;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 32px 16px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 32px; text-align: center;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">
                    📦 Weekly Software Update
                  </h1>
                  <p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">
                    UbiGrowth Platform Updates
                  </p>
                </td>
              </tr>
              
              <!-- Greeting -->
              <tr>
                <td style="padding: 24px 24px 16px 24px;">
                  <p style="margin: 0; font-size: 16px; color: #333;">
                    Hi ${userName || 'there'},
                  </p>
                  <p style="margin: 12px 0 0 0; font-size: 14px; color: #555; line-height: 1.5;">
                    Here's what's new in UbiGrowth this week:
                  </p>
                </td>
              </tr>
              
              <!-- Updates List -->
              <tr>
                <td style="padding: 0 24px;">
                  <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #eee; border-radius: 8px; overflow: hidden;">
                    ${updatesList}
                  </table>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="padding: 24px; text-align: center; border-top: 1px solid #eee; margin-top: 24px;">
                  <p style="margin: 0 0 12px 0; font-size: 14px; color: #666;">
                    Questions or feedback? Reply to this email.
                  </p>
                  <p style="margin: 0; font-size: 12px; color: #999;">
                    © ${new Date().getFullYear()} UbiGrowth. All rights reserved.
                  </p>
                  <p style="margin: 8px 0 0 0; font-size: 11px; color: #bbb;">
                    You're receiving this because you're a UbiGrowth user.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authorization - accept either internal secret OR service role key
    const internalSecret = req.headers.get("x-internal-secret");
    const authHeader = req.headers.get("authorization");
    const expectedSecret = Deno.env.get("INTERNAL_FUNCTION_SECRET");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    let body: RequestBody = {};
    try {
      body = await req.json();
    } catch {
      // Empty body is fine
    }

    // Check internal secret OR service role bearer token
    const hasValidInternalSecret = internalSecret && expectedSecret && internalSecret === expectedSecret;
    const hasValidServiceRole = authHeader?.startsWith("Bearer ") && 
                                 authHeader.slice(7) === serviceRoleKey;

    // Debug: log first/last chars to help diagnose mismatches
    console.log("Auth debug:", {
      receivedPrefix: internalSecret?.slice(0, 4),
      receivedSuffix: internalSecret?.slice(-4),
      expectedPrefix: expectedSecret?.slice(0, 4),
      expectedSuffix: expectedSecret?.slice(-4),
      match: hasValidInternalSecret
    });

    if (!hasValidInternalSecret && !hasValidServiceRole) {
      console.log("Unauthorized call to weekly-software-updates", {
        hasInternalSecret: !!internalSecret,
        hasExpectedSecret: !!expectedSecret,
        hasAuthHeader: !!authHeader
      });
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const customUpdates = body.customUpdates || [];
    const customSubject = body.subject;
    
    console.log("Starting software updates email job...", { 
      hasCustomUpdates: customUpdates.length > 0,
      customSubject 
    });

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get all users from auth.users
    const { data: authUsers, error: usersError } = await supabase.auth.admin.listUsers();

    if (usersError) {
      console.error("Error fetching users:", usersError);
      return new Response(JSON.stringify({ error: usersError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const users = authUsers?.users || [];
    console.log(`Found ${users.length} users to send updates to`);

    if (users.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: "No users to send updates to",
        sent: 0 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get latest updates - use custom updates if provided
    const updates = customUpdates.length > 0 ? customUpdates : getLatestUpdates();
    console.log(`Found ${updates.length} updates for this week`);

    const results: { email: string; success: boolean; error?: string }[] = [];

    // Send email to each user
    for (const user of users) {
      if (!user.email) {
        console.log(`Skipping user ${user.id} - no email`);
        continue;
      }

      try {
        const userName = user.user_metadata?.full_name || 
                        user.user_metadata?.name || 
                        user.email.split('@')[0];

        const emailHtml = generateEmailHtml(updates, userName);

        const defaultSubject = `📦 Weekly Platform Update - ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
        
        const { error: emailError } = await resend.emails.send({
          from: "UbiGrowth <updates@resend.dev>",
          to: [user.email],
          subject: customSubject || defaultSubject,
          html: emailHtml,
        });

        if (emailError) {
          console.error(`Failed to send email to ${user.email}:`, emailError);
          results.push({ email: user.email, success: false, error: emailError.message });
        } else {
          console.log(`Successfully sent update to ${user.email}`);
          results.push({ email: user.email, success: true });
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Error sending to ${user.email}:`, error);
        results.push({ 
          email: user.email, 
          success: false, 
          error: error instanceof Error ? error.message : "Unknown error" 
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`Weekly updates complete: ${successCount} sent, ${failCount} failed`);

    return new Response(JSON.stringify({
      success: true,
      sent: successCount,
      failed: failCount,
      updatesIncluded: updates.length,
      results
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Weekly software updates error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
