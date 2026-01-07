/**
 * Shared authentication utilities for edge functions
 * 
 * IMPORTANT: When using Supabase client in edge functions, `supabase.auth.getUser()`
 * without a token parameter requires a session cookie, which isn't available in
 * edge functions. Instead, we must:
 * 1. Extract the JWT from the Authorization header
 * 2. Use the service role client with `getUser(token)` to verify the JWT
 */

import { createClient, SupabaseClient, User } from "npm:@supabase/supabase-js@2";

export interface AuthResult {
  user: User | null;
  error: string | null;
  supabaseClient: SupabaseClient | null;
}

/**
 * Verifies the JWT from the Authorization header and returns the authenticated user
 * along with a properly configured Supabase client for RLS-enforced queries.
 * 
 * @param req - The incoming request
 * @returns AuthResult with user, error, and supabaseClient
 */
export async function verifyAuth(req: Request): Promise<AuthResult> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
    return {
      user: null,
      error: "Missing Supabase configuration",
      supabaseClient: null,
    };
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return {
      user: null,
      error: "Missing or invalid Authorization header",
      supabaseClient: null,
    };
  }

  const token = authHeader.replace("Bearer ", "");

  // Use service role client to verify the token
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user) {
    console.error("Authentication error:", authError);
    return {
      user: null,
      error: "Unauthorized",
      supabaseClient: null,
    };
  }

  // Create client with user's token for RLS enforcement
  const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  return {
    user,
    error: null,
    supabaseClient,
  };
}

/**
 * Returns a 401 Unauthorized response with CORS headers
 */
export function unauthorizedResponse(corsHeaders: Record<string, string>, message = "Unauthorized"): Response {
  return new Response(
    JSON.stringify({ error: message }),
    { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

/**
 * Creates a service role client for operations that bypass RLS
 * Use sparingly and only for internal operations like logging
 */
export function createServiceClient(): SupabaseClient {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(supabaseUrl, supabaseServiceKey);
}
