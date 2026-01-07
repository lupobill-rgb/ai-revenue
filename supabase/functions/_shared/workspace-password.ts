// supabase/functions/_shared/workspace-password.ts

import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Workspace-level password protection for public forms (per-tenant gating).
 * Passwords are stored as bcrypt hashes using pgcrypto in workspaces.public_form_password_hash
 * 
 * Logic:
 * - If public_form_password_hash IS NULL: no password required
 * - If set: provided password must match
 * 
 * To set a password (run via SQL):
 * ```sql
 * UPDATE public.workspaces
 * SET public_form_password_hash = extensions.crypt('MyPassword123', extensions.gen_salt('bf'))
 * WHERE id = '<workspace-uuid>';
 * ```
 * 
 * Usage in edge function:
 * ```typescript
 * import { checkWorkspaceFormPassword, extractPasswordFromRequest } from "../_shared/workspace-password.ts";
 * 
 * const password = extractPasswordFromRequest(req, body);
 * const isValid = await checkWorkspaceFormPassword(workspaceId, password);
 * if (!isValid) {
 *   return new Response(JSON.stringify({ error: "Invalid or missing password" }), { status: 401 });
 * }
 * ```
 */

/**
 * Check workspace form password using pgcrypto's crypt() function
 * Returns true if:
 * - No password is configured (public_form_password_hash IS NULL)
 * - Password matches the stored hash
 */
export async function checkWorkspaceFormPassword(
  workspaceId: string,
  providedPassword: string | null
): Promise<boolean> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !supabaseKey) {
    console.error('[workspace-password] Missing Supabase credentials');
    return false;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data, error } = await supabase.rpc(
    'check_workspace_form_password',
    { 
      _workspace_id: workspaceId, 
      _password: providedPassword ?? ''
    }
  );

  if (error) {
    console.error('[workspace-password] Check error:', error);
    return false;
  }

  if (data === true) {
    console.log('[workspace-password] Access granted');
    return true;
  }

  console.log('[workspace-password] Access denied');
  return false;
}

/**
 * Extract password from request (header or body)
 */
export function extractPasswordFromRequest(req: Request, body?: Record<string, unknown>): string | null {
  // Check X-Form-Password header
  const headerPassword = req.headers.get('X-Form-Password');
  if (headerPassword) return headerPassword;

  // Check body.formPassword
  if (body && typeof body.formPassword === 'string') {
    return body.formPassword;
  }

  return null;
}
