// ElevenLabs Integration - List Agents (workspace-scoped)
// Returns the workspace's stored ElevenLabs agents, and hydrates agent config from ElevenLabs.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type VoiceSettings = {
  elevenlabs_api_key: string | null;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ success: false, error: "Authorization required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const workspaceId = body.workspace_id || body.workspaceId;
    if (!workspaceId) {
      return new Response(JSON.stringify({ success: false, error: "workspace_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !supabaseAnonKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Server configuration error: missing Supabase env" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user has access to this workspace (RLS-enforced).
    const { data: ws, error: wsErr } = await supabaseClient
      .from("workspaces")
      .select("id")
      .eq("id", workspaceId)
      .maybeSingle();
    if (wsErr || !ws) {
      return new Response(JSON.stringify({ success: false, error: "Forbidden (workspace access denied)" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve ElevenLabs API key (prefer project secret; fall back to workspace key).
    let elevenKey = (Deno.env.get("ELEVENLABS_API_KEY") ?? "").trim();
    if (!elevenKey) {
      if (!supabaseServiceKey) {
        return new Response(
          JSON.stringify({ success: false, error: "ElevenLabs API key not configured (missing ELEVENLABS_API_KEY secret)" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const admin = createClient(supabaseUrl, supabaseServiceKey);
      const { data: settings } = await admin
        .from("ai_settings_voice")
        .select("elevenlabs_api_key")
        .eq("workspace_id", workspaceId)
        .maybeSingle<VoiceSettings>();
      elevenKey = (settings?.elevenlabs_api_key ?? "").trim();
    }

    if (!elevenKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error:
            "ElevenLabs API key not configured (set ELEVENLABS_API_KEY secret or add it in Settings > Integrations > Voice)",
          agents: [],
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // List workspace-scoped ElevenLabs agents from DB.
    const { data: rows, error: rowsErr } = await supabaseClient
      .from("voice_agents")
      .select("id, agent_id, name, use_case, status, is_default, created_at, config")
      .eq("workspace_id", workspaceId)
      .eq("provider", "elevenlabs")
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (rowsErr) throw rowsErr;

    const agents = await Promise.all(
      (rows ?? []).map(async (row: any) => {
        const agentId = row.agent_id || row.config?.agent_id || null;
        let conversation_config: any = null;
        let elevenError: string | null = null;

        if (agentId) {
          try {
            const res = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agentId}`, {
              method: "GET",
              headers: {
                "xi-api-key": elevenKey,
              },
            });
            if (!res.ok) {
              const t = await res.text();
              elevenError = `ElevenLabs API error: ${res.status} - ${t}`;
            } else {
              const details = await res.json();
              conversation_config = details?.conversation_config ?? null;
            }
          } catch (e) {
            elevenError = e instanceof Error ? e.message : "Failed to fetch agent details";
          }
        }

        const firstMessage =
          conversation_config?.agent?.first_message ??
          conversation_config?.agent?.firstMessage ??
          row.config?.first_message ??
          row.config?.firstMessage ??
          "";

        return {
          // Keep both shapes for backwards compatibility in UI mapping.
          id: agentId,
          agent_id: agentId,
          name: row.name || "Unnamed Agent",
          use_case: row.use_case ?? row.config?.use_case ?? "sales_outreach",
          status: row.status ?? "active",
          is_default: Boolean(row.is_default),
          created_at: row.created_at,
          first_message: firstMessage,
          conversation_config,
          error: elevenError ?? undefined,
        };
      })
    );

    return new Response(JSON.stringify({ success: true, agents, count: agents.length }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("❌ elevenlabs-list-agents failed:", error);
    return new Response(
      JSON.stringify({
        success: false,
        agents: [],
        error: error instanceof Error ? error.message : "Failed to fetch agents",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
