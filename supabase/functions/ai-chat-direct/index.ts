import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import type { LLMMessage } from "../_shared/llmRouter.ts";
import { openaiChatStream } from "../_shared/providers/openai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-workspace-id, x-request-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    console.log("[ai-chat-direct] OPTIONS preflight request received");
    return new Response(null, { 
      status: 200,
      headers: corsHeaders 
    });
  }

  try {
    console.log("[ai-chat-direct] Request received");

    // Check OPENAI_API_KEY
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY environment variable is not set");
    }

    const { messages, context } = await req.json();
    
    console.log("[ai-chat-direct] Calling OpenAI directly...");

    // Vendor fetch moved into `_shared/providers/*` for router-guard compliance.
    const response = await openaiChatStream({
      apiKey: OPENAI_API_KEY,
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a helpful AI assistant for ${context?.businessName || "a business"}. Be concise and helpful.`,
        },
        ...(messages as ChatMessage[]),
      ] as unknown as LLMMessage[],
      temperature: 0.7,
      maxTokens: 2048,
      timeoutMs: 55_000,
    });

    console.log("[ai-chat-direct] Streaming response from OpenAI");

    // Pass through the stream with CORS headers
    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
      },
    });

  } catch (error) {
    console.error("[ai-chat-direct] Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error occurred"
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
