import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
};

serve(async (req) => {
  console.log("[test-cors] Request received:", req.method);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    console.log("[test-cors] Returning OPTIONS response");
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  // Handle actual request
  console.log("[test-cors] Returning success response");
  return new Response(
    JSON.stringify({
      success: true,
      message: "CORS test function works!",
      timestamp: new Date().toISOString(),
      method: req.method,
    }),
    {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    }
  );
});
