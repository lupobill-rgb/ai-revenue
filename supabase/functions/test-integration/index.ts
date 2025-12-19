import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TestRequest {
  integrationType: "smtp" | "calendar" | "stripe";
  config: Record<string, any>;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { integrationType, config }: TestRequest = await req.json();
    console.log(`Testing ${integrationType} integration...`);

    let result: { success: boolean; message: string; details?: string };

    switch (integrationType) {
      case "smtp":
        result = await testSmtpConnection(config);
        break;
      case "calendar":
        result = await testCalendarUrl(config);
        break;
      case "stripe":
        result = await testStripeConnection(config);
        break;
      default:
        result = { success: false, message: `Unknown integration type: ${integrationType}` };
    }

    console.log(`Test result for ${integrationType}:`, result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: result.success ? 200 : 400,
    });
  } catch (error: any) {
    console.error("Integration test error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: "Test failed", 
        details: error.message 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

async function testSmtpConnection(config: Record<string, any>): Promise<{ success: boolean; message: string; details?: string }> {
  const { host, port, username, password } = config;

  if (!host || !port) {
    return { success: false, message: "Missing SMTP host or port" };
  }

  try {
    // Try to establish a TCP connection to the SMTP server
    // We can't do full SMTP handshake in Deno Deploy, but we can check if the host is reachable
    const conn = await Deno.connect({
      hostname: host,
      port: parseInt(port, 10),
    });
    
    // Read the initial SMTP greeting
    const buffer = new Uint8Array(1024);
    const bytesRead = await conn.read(buffer);
    
    if (bytesRead) {
      const greeting = new TextDecoder().decode(buffer.subarray(0, bytesRead));
      console.log("SMTP greeting:", greeting);
      
      // Check if it's a valid SMTP greeting (starts with 220)
      if (greeting.startsWith("220")) {
        conn.close();
        return { 
          success: true, 
          message: "SMTP server is reachable and responding",
          details: greeting.trim()
        };
      } else {
        conn.close();
        return { 
          success: false, 
          message: "Unexpected SMTP response",
          details: greeting.trim()
        };
      }
    }
    
    conn.close();
    return { success: false, message: "No response from SMTP server" };
  } catch (error: any) {
    console.error("SMTP connection error:", error);
    
    if (error.message?.includes("connection refused")) {
      return { 
        success: false, 
        message: "Connection refused", 
        details: `Could not connect to ${host}:${port}. Please check the host and port.` 
      };
    }
    
    if (error.message?.includes("timed out")) {
      return { 
        success: false, 
        message: "Connection timed out", 
        details: `The server ${host}:${port} did not respond in time.` 
      };
    }
    
    return { 
      success: false, 
      message: "SMTP connection failed", 
      details: error.message 
    };
  }
}

async function testCalendarUrl(config: Record<string, any>): Promise<{ success: boolean; message: string; details?: string }> {
  const { bookingUrl } = config;

  if (!bookingUrl) {
    return { success: false, message: "Missing booking URL" };
  }

  // Validate URL format
  try {
    const url = new URL(bookingUrl);
    
    // Check if it's a known calendar provider
    const knownProviders = ["calendly.com", "cal.com", "hubspot.com", "savvycal.com", "koalendar.com", "oncehub.com"];
    const isKnownProvider = knownProviders.some(provider => url.hostname.includes(provider));

    // Try to fetch the URL to verify it's accessible
    try {
      const response = await fetch(bookingUrl, { 
        method: "HEAD",
        headers: { "User-Agent": "UbiGrowth-Integration-Test/1.0" }
      });

      if (response.ok || response.status === 405) { // 405 = method not allowed but page exists
        return { 
          success: true, 
          message: "Booking URL is valid and accessible",
          details: isKnownProvider ? `Detected: ${url.hostname}` : undefined
        };
      } else if (response.status === 404) {
        return { 
          success: false, 
          message: "Booking page not found", 
          details: "The URL returned a 404 error. Please check if the link is correct." 
        };
      } else {
        return { 
          success: true, 
          message: "URL format is valid",
          details: `Server returned status ${response.status}. The page may require authentication.`
        };
      }
    } catch (fetchError: any) {
      // Fetch failed, but URL format is valid
      return { 
        success: true, 
        message: "URL format is valid but could not verify accessibility",
        details: "The page may be behind a firewall or require authentication."
      };
    }
  } catch (urlError) {
    return { 
      success: false, 
      message: "Invalid URL format", 
      details: "Please enter a valid URL starting with http:// or https://" 
    };
  }
}

async function testStripeConnection(config: Record<string, any>): Promise<{ success: boolean; message: string; details?: string }> {
  const { publishableKey, secretKey } = config;

  if (!publishableKey) {
    return { success: false, message: "Missing Stripe publishable key" };
  }

  // Validate publishable key format
  if (!publishableKey.startsWith("pk_test_") && !publishableKey.startsWith("pk_live_")) {
    return { 
      success: false, 
      message: "Invalid publishable key format", 
      details: "Stripe publishable keys should start with 'pk_test_' or 'pk_live_'" 
    };
  }

  // If we have a secret key hint, validate its format
  if (secretKey) {
    if (!secretKey.startsWith("sk_test_") && !secretKey.startsWith("sk_live_") && !secretKey.startsWith("••••")) {
      return { 
        success: false, 
        message: "Invalid secret key format", 
        details: "Stripe secret keys should start with 'sk_test_' or 'sk_live_'" 
      };
    }

    // Check that both keys are from the same mode (test/live)
    const pubMode = publishableKey.includes("_test_") ? "test" : "live";
    const secMode = secretKey.includes("_test_") ? "test" : "live";
    
    if (!secretKey.startsWith("••••") && pubMode !== secMode) {
      return { 
        success: false, 
        message: "Key mode mismatch", 
        details: `Publishable key is in ${pubMode} mode but secret key is in ${secMode} mode. Both should be the same.` 
      };
    }
  }

  const mode = publishableKey.includes("_test_") ? "Test" : "Live";
  return { 
    success: true, 
    message: `Stripe keys are valid (${mode} mode)`,
    details: secretKey ? "Both publishable and secret keys are configured" : "Only publishable key is configured"
  };
}
