// supabase/functions/_shared/tenant-password.ts

import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Tenant-level password protection for public forms.
 * Passwords are stored as bcrypt hashes using pgcrypto in tenants.public_form_password_hash
 * 
 * Logic:
 * - If public_form_password_hash IS NULL: no password required
 * - If set: provided password must match
 * 
 * To set a password (run via SQL):
 * ```sql
 * UPDATE public.tenants
 * SET public_form_password_hash = extensions.crypt('MyPassword123', extensions.gen_salt('bf'))
 * WHERE id = '<tenant-uuid>';
 * ```
 * 
 * Usage in edge function:
 * ```typescript
 * import { checkTenantFormPassword, extractPasswordFromRequest } from "../_shared/tenant-password.ts";
 * 
 * const password = extractPasswordFromRequest(req, body);
 * const isValid = await checkTenantFormPassword(tenantId, password);
 * if (!isValid) {
 *   return new Response(JSON.stringify({ error: "Invalid or missing password" }), { status: 401 });
 * }
 * ```
 */

/**
 * Check tenant form password using pgcrypto's crypt() function
 * Returns true if:
 * - No password is configured (public_form_password_hash IS NULL)
 * - Password matches the stored hash
 */
export async function checkTenantFormPassword(
  tenantId: string,
  providedPassword: string | null
): Promise<boolean> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !supabaseKey) {
    console.error('[tenant-password] Missing Supabase credentials');
    return false;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data, error } = await supabase.rpc(
    "check_tenant_form_password",
    { 
      _tenant_id: tenantId, 
      _password: providedPassword ?? ''
    }
  );

  if (error) {
    console.error('[tenant-password] Check error:', error);
    return false;
  }

  if (data === true) {
    console.log('[tenant-password] Access granted');
    return true;
  }

  console.log('[tenant-password] Access denied');
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
