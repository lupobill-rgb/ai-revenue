import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

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

// Utility function for one-time workspace resolution
// Priority: 1) localStorage saved selection, 2) default workspace, 3) first owned, 4) first membership
export async function getWorkspaceId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // 1. Check localStorage for persisted selection (matches WorkspaceContext behavior)
  const savedId = localStorage.getItem(STORAGE_KEY);
  if (savedId) {
    // Verify user still has access to this workspace
    const { data: hasAccess } = await supabase
      .from("workspaces")
      .select("id")
      .eq("id", savedId)
      .maybeSingle();
    
    if (hasAccess?.id) return savedId;
    
    // Also check membership
    const { data: memberAccess } = await supabase
      .from("workspace_members")
      .select("workspace_id")
      .eq("workspace_id", savedId)
      .eq("user_id", user.id)
      .maybeSingle();
    
    if (memberAccess?.workspace_id) return savedId;
  }

  // 2. Check for default workspace
  const { data: defaultWorkspace } = await supabase
    .from("workspaces")
    .select("id")
    .eq("owner_id", user.id)
    .eq("is_default", true)
    .limit(1)
    .maybeSingle();

  if (defaultWorkspace?.id) return defaultWorkspace.id;

  // 3. First owned workspace (oldest)
  const { data: ownedWorkspace } = await supabase
    .from("workspaces")
    .select("id")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (ownedWorkspace?.id) return ownedWorkspace.id;

  // 4. First membership workspace
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return membership?.workspace_id || null;
}

export default useWorkspace;
