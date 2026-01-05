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

// Utility function for one-time workspace resolution
export async function getWorkspaceId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: ownedWorkspace } = await supabase
    .from("workspaces")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (ownedWorkspace?.id) return ownedWorkspace.id;

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .maybeSingle();

  return membership?.workspace_id || null;
}

export default useWorkspace;
