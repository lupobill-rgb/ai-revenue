import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export type TenantContext = {
  userId: string;
  tenantId: string;
  workspaceId: string;
};

function asNonEmptyString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s ? s : null;
}

/**
 * Resolve tenant/workspace context using platform patterns:
 * - prefer `x-workspace-id` header (or `workspaceId` in body)
 * - derive `tenant_id` from `workspaces.tenant_id` (authoritative when workspaceId is present)
 * - ONLY use membership mapping if constrained by workspaceId
 *
 * IMPORTANT: we do NOT assume tenant_id exists in JWT claims.
 */
export async function resolveTenantContext(
  req: Request,
  supabase: SupabaseClient,
  opts?: { body?: unknown; userId?: string }
): Promise<TenantContext> {
  const bodyObj = (opts?.body ?? {}) as any;
  const headerWorkspaceId = asNonEmptyString(req.headers.get("x-workspace-id"));

  let userId = asNonEmptyString(opts?.userId);
  if (!userId) {
    const { data } = await supabase.auth.getUser();
    userId = asNonEmptyString(data?.user?.id);
  }
  if (!userId) {
    throw new Error("Unauthorized");
  }

  let workspaceId =
    headerWorkspaceId ||
    asNonEmptyString(bodyObj?.workspaceId) ||
    asNonEmptyString(bodyObj?.workspace_id) ||
    null;

  // If not provided, try to infer a workspace like the smoke harness does.
  if (!workspaceId) {
    const { data: ownedWs } = await supabase
      .from("workspaces")
      .select("id")
      .eq("owner_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle<{ id: string }>();
    workspaceId = ownedWs?.id || null;
  }

  if (!workspaceId) {
    const { data: memberWs } = await supabase
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle<{ workspace_id: string }>();
    workspaceId = memberWs?.workspace_id || null;
  }

  if (!workspaceId) {
    throw new Error("Missing workspace_id (x-workspace-id or workspaceId)");
  }

  // Single source of truth: workspace -> tenant (authoritative when workspaceId exists)
  const { data: wsRow } = await supabase
    .from("workspaces")
    .select("tenant_id")
    .eq("id", workspaceId)
    .maybeSingle<{ tenant_id: string | null }>();

  const tenantFromWorkspace = asNonEmptyString(wsRow?.tenant_id);
  if (tenantFromWorkspace) {
    return { userId, tenantId: tenantFromWorkspace, workspaceId };
  }

  // Fallback (tenant-safe): membership join -> tenant, constrained by workspaceId
  const { data: membershipData } = await supabase
    .from("workspace_members")
    .select("workspaces!inner(tenant_id)")
    .eq("user_id", userId)
    .eq("workspace_id", workspaceId)
    .limit(1)
    .maybeSingle();

  const tenantFromMembership = asNonEmptyString((membershipData as any)?.workspaces?.tenant_id);
  if (tenantFromMembership) {
    return { userId, tenantId: tenantFromMembership, workspaceId };
  }

  throw new Error("Unable to resolve tenant_id for workspace");
}

