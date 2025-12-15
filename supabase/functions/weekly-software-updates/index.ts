import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const INTERNAL_FUNCTION_SECRET = Deno.env.get("INTERNAL_FUNCTION_SECRET")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const resend = new Resend(RESEND_API_KEY);

interface Tenant {
  id: string;
  name: string;
}

interface UserWithEmail {
  user_id: string;
  email: string;
}

interface ReleaseNote {
  title: string;
  body_md: string;
}

serve(async (req) => {
  // Validate internal secret
  const auth = req.headers.get("x-internal-secret");
  if (auth !== INTERNAL_FUNCTION_SECRET) {
    console.error("Unauthorized: invalid internal secret");
    return new Response("Unauthorized", { status: 401 });
  }

  console.log("Starting weekly software updates email dispatch...");

  try {
    // 1) Load active tenants
    const { data: tenants, error: tenantsError } = await supabase
      .from("tenants")
      .select("id, name")
      .eq("status", "active");

    if (tenantsError) {
      console.error("Error loading tenants:", tenantsError);
      return new Response("Error loading tenants", { status: 500 });
    }

    console.log(`Found ${tenants?.length ?? 0} active tenants`);

    // 2) Get latest global release note (tenant_id IS NULL)
    const { data: globalNote } = await supabase
      .from("release_notes")
      .select("title, body_md")
      .is("tenant_id", null)
      .order("released_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let totalSent = 0;
    let totalFailed = 0;

    for (const tenant of (tenants ?? []) as Tenant[]) {
      // 3) Get users who opted in for this tenant
      const { data: userTenants, error: usersError } = await supabase
        .from("user_tenants")
        .select("user_id")
        .eq("tenant_id", tenant.id)
        .eq("wants_product_updates", true);

      if (usersError) {
        console.error(`Users error for tenant ${tenant.id}:`, usersError);
        continue;
      }

      if (!userTenants || userTenants.length === 0) {
        console.log(`No opted-in users for tenant ${tenant.name}`);
        continue;
      }

      // 4) Get user emails via auth admin API
      const usersWithEmail: UserWithEmail[] = [];
      for (const ut of userTenants) {
        try {
          const { data: { user } } = await supabase.auth.admin.getUserById(ut.user_id);
          if (user?.email) {
            usersWithEmail.push({ user_id: ut.user_id, email: user.email });
          }
        } catch (e) {
          console.error(`Error fetching user ${ut.user_id}:`, e);
        }
      }

      if (usersWithEmail.length === 0) {
        console.log(`No valid emails for tenant ${tenant.name}`);
        continue;
      }

      // 5) Check for tenant-specific release note, fallback to global
      const { data: tenantNote } = await supabase
        .from("release_notes")
        .select("title, body_md")
        .eq("tenant_id", tenant.id)
        .order("released_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const releaseNote: ReleaseNote | null = tenantNote || globalNote;

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
    .content { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .footer { font-size: 12px; color: #666; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px; }
    a { color: #1DA4FF; }
  </style>
</head>
<body>
  <h1>Weekly UbiGrowth Update</h1>
  <p>Hi there,</p>
  <p>Here's what's new in your UbiGrowth Revenue OS this week for <strong>${tenant.name}</strong>:</p>
  <div class="content">
    ${releaseNote?.body_md ?? "<p>No major changes this week – just reliability and performance improvements to keep your campaigns running smoothly.</p>"}
  </div>
  <p>Questions? Reply to this email or reach out to our team.</p>
  <div class="footer">
    <p>You're receiving this because you opted in to product updates. 
    <a href="https://app.ubigrowth.com/settings">Update your preferences</a> anytime.</p>
    <p>© ${new Date().getFullYear()} UbiGrowth. All rights reserved.</p>
  </div>
</body>
</html>`;

      // 6) Send emails
      for (const user of usersWithEmail) {
        try {
          await resend.emails.send({
            from: "UbiGrowth Updates <onboarding@resend.dev>",
            to: user.email,
            subject,
            html: htmlBody,
          });

          // Log to email_events table
          await supabase.from("email_events").insert({
            tenant_id: tenant.id,
            recipient_email: user.email,
            event_type_internal: "product_update_sent",
            provider_event_type: "weekly_software_update",
            occurred_at: new Date().toISOString(),
          });

          totalSent++;
          console.log(`Sent update to ${user.email} for tenant ${tenant.name}`);
        } catch (e) {
          console.error(`Error sending to ${user.email}:`, e);
          totalFailed++;
        }
      }
    }

    console.log(`Weekly updates complete: ${totalSent} sent, ${totalFailed} failed`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent: totalSent, 
        failed: totalFailed 
      }), 
      { 
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    console.error("Unexpected error in weekly updates:", error);
    return new Response(
      JSON.stringify({ error: String(error) }), 
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
