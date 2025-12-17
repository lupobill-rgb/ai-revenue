import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface FeedbackRequest {
  userEmail: string;
  userName: string;
  currentPage: string;
  message: string;
  screenshot?: {
    filename: string;
    content: string; // base64 encoded
  } | null;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userEmail, userName, currentPage, message, screenshot }: FeedbackRequest = await req.json();

    console.log("Sending feedback email from:", userEmail, "with screenshot:", !!screenshot);

    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    
    // Build attachments array if screenshot provided
    const attachments = screenshot
      ? [
          {
            filename: screenshot.filename || "screenshot.png",
            content: screenshot.content,
          },
        ]
      : undefined;

    const screenshotNote = screenshot
      ? `<p style="color: #666;"><em>📎 Screenshot attached</em></p>`
      : "";

    const emailResponse = await resend.emails.send({
      from: "AI CMO Feedback <app@ubigrowth.com>",
      to: ["support@ubigrowth.com"],
      cc: [userEmail],
      subject: `Feedback from ${userName} - ${timestamp}`,
      html: `
        <h2>New Feedback Received</h2>
        <p><strong>From:</strong> ${userName} (${userEmail})</p>
        <p><strong>Page:</strong> ${currentPage}</p>
        <hr />
        <h3>Message:</h3>
        <p>${message.replace(/\n/g, "<br />")}</p>
        ${screenshotNote}
        <hr />
        <p style="color: #666; font-size: 12px;">This feedback was submitted via the UbiGrowth platform.</p>
      `,
      attachments,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-feedback-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
