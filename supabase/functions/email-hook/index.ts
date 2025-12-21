import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

interface AuthEmailPayload {
  user: {
    id: string;
    email: string;
    user_metadata?: {
      full_name?: string;
    };
  };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: string;
    site_url: string;
  };
}

const getEmailTemplate = (
  type: string,
  userName: string,
  actionUrl: string
): { subject: string; html: string } => {
  const brandName = "UbiGrowth";
  const brandColor = "#1DA4FF";
  const year = new Date().getFullYear();

  const baseStyles = `
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #02040A; margin: 0; padding: 40px 20px; }
    .container { max-width: 560px; margin: 0 auto; background-color: #0F1116; border-radius: 12px; padding: 40px; border: 1px solid #1B2330; }
    .logo { font-size: 24px; font-weight: bold; color: ${brandColor}; margin-bottom: 32px; }
    h1 { color: #FFFFFF; font-size: 24px; font-weight: 600; margin: 0 0 16px 0; }
    p { color: #C7CCD1; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0; }
    .button { display: inline-block; background-color: ${brandColor}; color: #FFFFFF; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px; margin: 24px 0; }
    .button:hover { background-color: #66D0FF; }
    .footer { margin-top: 32px; padding-top: 24px; border-top: 1px solid #1B2330; color: #6B7280; font-size: 14px; }
    .footer a { color: ${brandColor}; text-decoration: none; }
    .code { background-color: #1B2330; padding: 16px; border-radius: 8px; font-family: monospace; font-size: 18px; color: #FFFFFF; letter-spacing: 2px; margin: 16px 0; display: inline-block; }
  `;

  switch (type) {
    case "recovery":
    case "magiclink":
      return {
        subject: `Reset your ${brandName} password`,
        html: `
          <!DOCTYPE html>
          <html>
          <head><style>${baseStyles}</style></head>
          <body>
            <div class="container">
              <div class="logo">${brandName}</div>
              <h1>Reset Your Password</h1>
              <p>Hi${userName ? ` ${userName}` : ""},</p>
              <p>We received a request to reset your password. Click the button below to choose a new password:</p>
              <a href="${actionUrl}" class="button">Reset Password</a>
              <p>This link will expire in 24 hours. If you didn't request a password reset, you can safely ignore this email.</p>
              <div class="footer">
                <p>&copy; ${year} ${brandName}. All rights reserved.</p>
                <p>Questions? Contact us at <a href="mailto:support@ubigrowth.ai">support@ubigrowth.ai</a></p>
              </div>
            </div>
          </body>
          </html>
        `,
      };

    case "signup":
    case "email_confirmation":
      return {
        subject: `Confirm your ${brandName} email`,
        html: `
          <!DOCTYPE html>
          <html>
          <head><style>${baseStyles}</style></head>
          <body>
            <div class="container">
              <div class="logo">${brandName}</div>
              <h1>Confirm Your Email</h1>
              <p>Hi${userName ? ` ${userName}` : ""},</p>
              <p>Thanks for signing up! Please confirm your email address by clicking the button below:</p>
              <a href="${actionUrl}" class="button">Confirm Email</a>
              <p>If you didn't create an account with ${brandName}, you can safely ignore this email.</p>
              <div class="footer">
                <p>&copy; ${year} ${brandName}. All rights reserved.</p>
                <p>Questions? Contact us at <a href="mailto:support@ubigrowth.ai">support@ubigrowth.ai</a></p>
              </div>
            </div>
          </body>
          </html>
        `,
      };

    case "invite":
      return {
        subject: `You've been invited to ${brandName}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head><style>${baseStyles}</style></head>
          <body>
            <div class="container">
              <div class="logo">${brandName}</div>
              <h1>You're Invited!</h1>
              <p>Hi${userName ? ` ${userName}` : ""},</p>
              <p>You've been invited to join a team on ${brandName}. Click the button below to accept the invitation and set up your account:</p>
              <a href="${actionUrl}" class="button">Accept Invitation</a>
              <p>This invitation link will expire in 7 days.</p>
              <div class="footer">
                <p>&copy; ${year} ${brandName}. All rights reserved.</p>
                <p>Questions? Contact us at <a href="mailto:support@ubigrowth.ai">support@ubigrowth.ai</a></p>
              </div>
            </div>
          </body>
          </html>
        `,
      };

    case "email_change":
      return {
        subject: `Confirm your new email for ${brandName}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head><style>${baseStyles}</style></head>
          <body>
            <div class="container">
              <div class="logo">${brandName}</div>
              <h1>Confirm Email Change</h1>
              <p>Hi${userName ? ` ${userName}` : ""},</p>
              <p>We received a request to change your email address. Click the button below to confirm this change:</p>
              <a href="${actionUrl}" class="button">Confirm New Email</a>
              <p>If you didn't request this change, please contact support immediately.</p>
              <div class="footer">
                <p>&copy; ${year} ${brandName}. All rights reserved.</p>
                <p>Questions? Contact us at <a href="mailto:support@ubigrowth.ai">support@ubigrowth.ai</a></p>
              </div>
            </div>
          </body>
          </html>
        `,
      };

    default:
      return {
        subject: `Action required for your ${brandName} account`,
        html: `
          <!DOCTYPE html>
          <html>
          <head><style>${baseStyles}</style></head>
          <body>
            <div class="container">
              <div class="logo">${brandName}</div>
              <h1>Action Required</h1>
              <p>Hi${userName ? ` ${userName}` : ""},</p>
              <p>Please click the button below to complete your action:</p>
              <a href="${actionUrl}" class="button">Continue</a>
              <div class="footer">
                <p>&copy; ${year} ${brandName}. All rights reserved.</p>
                <p>Questions? Contact us at <a href="mailto:support@ubigrowth.ai">support@ubigrowth.ai</a></p>
              </div>
            </div>
          </body>
          </html>
        `,
      };
  }
};

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    if (!resend) {
      console.error("RESEND_API_KEY not configured");
      return new Response(JSON.stringify({ error: "Email service not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const payload: AuthEmailPayload = await req.json();
    console.log("Email hook received:", JSON.stringify(payload, null, 2));

    const { user, email_data } = payload;
    const { token_hash, redirect_to, email_action_type, site_url } = email_data;

    // Build the action URL
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || site_url;
    const actionUrl = `${supabaseUrl}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${encodeURIComponent(redirect_to)}`;

    const userName = user.user_metadata?.full_name || "";
    const { subject, html } = getEmailTemplate(email_action_type, userName, actionUrl);

    // Send email via Resend
    const fromAddress = Deno.env.get("AUTH_EMAIL_FROM") || "noreply@updates.ubigrowth.ai";
    
    const emailResponse = await resend.emails.send({
      from: `UbiGrowth <${fromAddress}>`,
      to: [user.email],
      subject,
      html,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in email-hook:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
