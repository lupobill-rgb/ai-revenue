// supabase/functions/_shared/workspace-password.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

/**
 * Workspace-level password protection for public forms (per-tenant gating).
 * Passwords are stored as bcrypt/argon2 hashes in workspaces.public_form_password_hash
 * 
 * Usage:
 * ```typescript
 * import { verifyWorkspacePassword, hashPassword } from "../_shared/workspace-password.ts";
 * 
 * // In edge function:
 * const result = await verifyWorkspacePassword(workspaceId, providedPassword);
 * if (!result.valid) {
 *   return new Response(JSON.stringify({ error: result.error }), { status: 401 });
 * }
 * ```
 */

export interface WorkspacePasswordResult {
  valid: boolean;
  error?: string;
  requiresPassword?: boolean;
}

/**
 * Hash a password for storage using Web Crypto API (SHA-256 + salt)
 * For production, consider using bcrypt via a Deno module
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
  
  const encoder = new TextEncoder();
  const data = encoder.encode(saltHex + password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return `sha256:${saltHex}:${hashHex}`;
}

/**
 * Verify a password against a stored hash
 */
export async function verifyPasswordHash(password: string, storedHash: string): Promise<boolean> {
  if (!storedHash.startsWith('sha256:')) {
    console.error('[workspace-password] Unknown hash format');
    return false;
  }

  const parts = storedHash.split(':');
  if (parts.length !== 3) {
    console.error('[workspace-password] Invalid hash format');
    return false;
  }

  const [, salt, expectedHash] = parts;
  
  const encoder = new TextEncoder();
  const data = encoder.encode(salt + password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const computedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  // Timing-safe comparison
  if (computedHash.length !== expectedHash.length) return false;
  
  let diff = 0;
  for (let i = 0; i < computedHash.length; i++) {
    diff |= computedHash.charCodeAt(i) ^ expectedHash.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Verify workspace password from request
 */
export async function verifyWorkspacePassword(
  workspaceId: string,
  providedPassword: string | null
): Promise<WorkspacePasswordResult> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !supabaseKey) {
    console.error('[workspace-password] Missing Supabase credentials');
    return { valid: false, error: 'Server configuration error' };
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Fetch workspace password hash
  const { data: workspace, error } = await supabase
    .from('workspaces')
    .select('public_form_password_hash')
    .eq('id', workspaceId)
    .single();

  if (error || !workspace) {
    console.error('[workspace-password] Workspace not found:', workspaceId);
    return { valid: false, error: 'Workspace not found' };
  }

  const storedHash = workspace.public_form_password_hash;

  // No password set = no protection required
  if (!storedHash) {
    console.log('[workspace-password] No password configured for workspace');
    return { valid: true, requiresPassword: false };
  }

  // Password required but not provided
  if (!providedPassword) {
    console.log('[workspace-password] Password required but not provided');
    return { valid: false, error: 'Password required', requiresPassword: true };
  }

  // Verify the password
  const isValid = await verifyPasswordHash(providedPassword, storedHash);
  
  if (isValid) {
    console.log('[workspace-password] Password verified successfully');
    return { valid: true, requiresPassword: true };
  }

  console.log('[workspace-password] Invalid password');
  return { valid: false, error: 'Invalid password', requiresPassword: true };
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
