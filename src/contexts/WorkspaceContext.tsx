// Workspace Context - Auto-selects workspace on login, persists selection
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Workspace {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  is_default?: boolean | null;
}

interface WorkspaceContextValue {
  workspaceId: string | null;
  workspace: Workspace | null;
  workspaces: Workspace[];
  isLoading: boolean;
  error: string | null;
  hasWorkspace: boolean;
  selectWorkspace: (workspaceId: string) => Promise<void>;
  createWorkspace: (name: string, slug?: string) => Promise<Workspace | null>;
  refreshWorkspaces: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

const STORAGE_KEY = "currentWorkspaceId";

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWorkspaces = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setWorkspaceId(null);
        setWorkspace(null);
        setWorkspaces([]);
        return;
      }

      // Fetch all workspaces user has access to (owned or member)
      const { data: ownedWorkspaces, error: ownedError } = await supabase
        .from("workspaces")
        .select("id, name, slug, owner_id, is_default")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: true });

      if (ownedError) throw ownedError;

      // Also get workspaces user is a member of
      const { data: memberWorkspaces, error: memberError } = await supabase
        .from("workspace_members")
        .select("workspace:workspaces(id, name, slug, owner_id, is_default)")
        .eq("user_id", user.id)
        .neq("role", "owner"); // Avoid duplicates with owned

      if (memberError) throw memberError;

      // Combine and dedupe
      const memberWs = (memberWorkspaces || [])
        .map((m) => m.workspace as Workspace | null)
        .filter((w): w is Workspace => w !== null);
      
      const allWorkspaces = [...(ownedWorkspaces || []), ...memberWs] as Workspace[];
      const uniqueWorkspaces = allWorkspaces.filter(
        (w, i, arr) => arr.findIndex((x) => x.id === w.id) === i
      );

      setWorkspaces(uniqueWorkspaces);

      // Auto-select workspace
      const savedId = localStorage.getItem(STORAGE_KEY);
      let selectedWorkspace: Workspace | null = null;

      // Try saved workspace first
      if (savedId) {
        selectedWorkspace = uniqueWorkspaces.find((w) => w.id === savedId) || null;
      }

      // If no valid saved, try default workspace
      if (!selectedWorkspace) {
        selectedWorkspace = uniqueWorkspaces.find((w) => w.is_default) || null;
      }

      // Fall back to first workspace
      if (!selectedWorkspace && uniqueWorkspaces.length > 0) {
        selectedWorkspace = uniqueWorkspaces[0];
      }

      if (selectedWorkspace) {
        setWorkspaceId(selectedWorkspace.id);
        setWorkspace(selectedWorkspace);
        localStorage.setItem(STORAGE_KEY, selectedWorkspace.id);
        
        // Update last used in DB (fire and forget)
        (async () => {
          try {
            await supabase.rpc("set_last_used_workspace", {
              p_user_id: user.id,
              p_workspace_id: selectedWorkspace.id,
            });
          } catch (e) {
            console.error(e);
          }
        })();
      } else {
        setWorkspaceId(null);
        setWorkspace(null);
      }
    } catch (err) {
      console.error("Workspace context error:", err);
      setError(err instanceof Error ? err.message : "Failed to load workspaces");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkspaces();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        fetchWorkspaces();
      } else if (event === "SIGNED_OUT") {
        setWorkspaceId(null);
        setWorkspace(null);
        setWorkspaces([]);
        localStorage.removeItem(STORAGE_KEY);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchWorkspaces]);

  const selectWorkspace = useCallback(async (id: string) => {
    const selected = workspaces.find((w) => w.id === id);
    if (!selected) {
      toast.error("Workspace not found");
      return;
    }

    setWorkspaceId(id);
    setWorkspace(selected);
    localStorage.setItem(STORAGE_KEY, id);

    // Update last used in DB
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      try {
        await supabase.rpc("set_last_used_workspace", {
          p_user_id: user.id,
          p_workspace_id: id,
        });
      } catch (e) {
        console.error(e);
      }
    }

    toast.success(`Switched to ${selected.name}`);
  }, [workspaces]);

  const createWorkspace = useCallback(async (name: string, slug?: string): Promise<Workspace | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be logged in");
        return null;
      }

      const workspaceSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

      const { data, error } = await supabase
        .from("workspaces")
        .insert({
          name,
          slug: workspaceSlug,
          owner_id: user.id,
        })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          toast.error("A workspace with this name already exists");
        } else {
          toast.error("Failed to create workspace");
        }
        return null;
      }

      // Add to workspace_members
      const { error: memberError } = await supabase.from("workspace_members").insert({
        workspace_id: data.id,
        user_id: user.id,
        role: "owner",
      });
      if (memberError) console.error(memberError);

      toast.success("Workspace created!");
      
      // Refresh and select new workspace
      await fetchWorkspaces();
      await selectWorkspace(data.id);
      
      return data;
    } catch (err) {
      console.error("Create workspace error:", err);
      toast.error("Failed to create workspace");
      return null;
    }
  }, [fetchWorkspaces, selectWorkspace]);

  const value: WorkspaceContextValue = {
    workspaceId,
    workspace,
    workspaces,
    isLoading,
    error,
    hasWorkspace: !!workspaceId,
    selectWorkspace,
    createWorkspace,
    refreshWorkspaces: fetchWorkspaces,
  };

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspaceContext() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error("useWorkspaceContext must be used within a WorkspaceProvider");
  }
  return context;
}

// Re-export for backwards compatibility
export { WorkspaceContext };
