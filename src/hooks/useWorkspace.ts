import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceContext } from "@/contexts/WorkspaceContext";

/**
 * Hook for React components to get the active workspace ID from context.
 * This is the PREFERRED method for React components - always use this instead of getWorkspaceId().
 */
export function useActiveWorkspaceId(): string | null {
  const ctx = useWorkspaceContext();
  return ctx?.workspaceId ?? null;
}

interface WorkspaceState {
  workspaceId: string | null;
  userId: string | null;
  isLoading: boolean;
}

export function useWorkspace() {
  const [state, setState] = useState<WorkspaceState>({
    workspaceId: null,
    userId: null,
    isLoading: true,
  });

  useEffect(() => {
    resolveWorkspace();
  }, []);

  const resolveWorkspace = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setState({ workspaceId: null, userId: null, isLoading: false });
      return;
    }

    // Check if user owns a workspace
    // NOTE: user can have multiple workspaces, so avoid maybeSingle() without a LIMIT.
    const { data: ownedWorkspace, error: ownedErr } = await supabase
      .from("workspaces")
      .select("id")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (ownedErr) console.error("[useWorkspace] owned workspace lookup failed:", ownedErr);

    let workspaceId = ownedWorkspace?.id;

    // If not owner, check workspace membership
    if (!workspaceId) {
      const { data: membership, error: memberErr } = await supabase
        .from("workspace_members")
        .select("workspace_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (memberErr) console.error("[useWorkspace] membership lookup failed:", memberErr);

      workspaceId = membership?.workspace_id;
    }

    setState({
      workspaceId: workspaceId || null,
      userId: user.id,
      isLoading: false,
    });
  };

  return {
    ...state,
    refetch: resolveWorkspace,
  };
}

const STORAGE_KEY = "currentWorkspaceId";

/**
 * Utility function for non-React code paths (e.g., bootstrapping before context loads).
 * 
 * IMPORTANT: For React components, use useActiveWorkspaceId() instead - it reads from context
 * and is the source of truth for the user's selected workspace.
 * 
 * This function is SAFE: if user has multiple workspaces and no clear selection, it returns null
 * to force explicit workspace selection rather than silently picking the wrong one.
 */
export async function getWorkspaceId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // 1. Check localStorage for persisted selection (matches WorkspaceContext behavior)
  const savedId = localStorage.getItem(STORAGE_KEY);
  if (savedId) {
    // Verify user still has access to this workspace (owner or member)
    const { data: hasOwnerAccess } = await supabase
      .from("workspaces")
      .select("id")
      .eq("id", savedId)
      .eq("owner_id", user.id)
      .maybeSingle();
    
    if (hasOwnerAccess?.id) return savedId;
    
    // Check membership access
    const { data: memberAccess } = await supabase
      .from("workspace_members")
      .select("workspace_id")
      .eq("workspace_id", savedId)
      .eq("user_id", user.id)
      .maybeSingle();
    
    if (memberAccess?.workspace_id) return savedId;
    
    // Invalid saved ID - clear it
    localStorage.removeItem(STORAGE_KEY);
  }

  // 2. Count accessible workspaces - if more than 1, return null to force selection
  const { data: ownedWorkspaces } = await supabase
    .from("workspaces")
    .select("id")
    .eq("owner_id", user.id)
    .limit(2);

  const { data: memberWorkspaces } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .limit(2);

  const ownedIds = (ownedWorkspaces || []).map(w => w.id);
  const memberIds = (memberWorkspaces || []).map(m => m.workspace_id);
  const uniqueIds = [...new Set([...ownedIds, ...memberIds])];

  // If exactly one workspace, return it
  if (uniqueIds.length === 1) {
    localStorage.setItem(STORAGE_KEY, uniqueIds[0]);
    return uniqueIds[0];
  }

  // If multiple workspaces and no saved selection, return null to force explicit selection
  // This prevents silent writes to the wrong workspace
  if (uniqueIds.length > 1) {
    console.warn("[getWorkspaceId] Multiple workspaces found, no saved selection - returning null to force selection");
    return null;
  }

  // No workspaces at all
  return null;
}

export default useWorkspace;
