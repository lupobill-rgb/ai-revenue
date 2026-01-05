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
  demo_mode?: boolean;
  stripe_connected?: boolean;
  tenant_id?: string | null;
}

// Data quality status from gated views
export type DataQualityStatus = 'LIVE_OK' | 'DEMO_MODE' | 'NO_PROVIDER_CONNECTED' | 'NO_ANALYTICS_CONNECTED' | 'NO_STRIPE_CONNECTED';

interface WorkspaceContextValue {
  workspaceId: string | null;
  workspace: Workspace | null;
  workspaces: Workspace[];
  isLoading: boolean;
  error: string | null;
  hasWorkspace: boolean;
  // Demo mode controls
  demoMode: boolean;
  stripeConnected: boolean;
  analyticsConnected: boolean;
  dataQualityStatus: DataQualityStatus;
  toggleDemoMode: () => Promise<void>;
  // Workspace actions
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
  
  // Demo mode and integration status
  const [demoMode, setDemoMode] = useState(false);
  const [stripeConnected, setStripeConnected] = useState(false);
  const [analyticsConnected, setAnalyticsConnected] = useState(false);

  // Fetch integration status from gated view
  const fetchIntegrationStatus = useCallback(async (wsId: string) => {
    try {
      const { data } = await supabase
        .from("v_impressions_clicks_by_workspace")
        .select("demo_mode, stripe_connected, analytics_connected, data_quality_status")
        .eq("workspace_id", wsId)
        .single();
      
      if (data) {
        setDemoMode(data.demo_mode ?? false);
        setStripeConnected(data.stripe_connected ?? false);
        setAnalyticsConnected(data.analytics_connected ?? false);
      }
    } catch (err) {
      console.error("Failed to fetch integration status:", err);
    }
  }, []);

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

      console.log("[WorkspaceProvider] fetchWorkspaces user:", user.id, user.email);

      // Fetch all workspaces user has access to (owned or member)
      const { data: ownedWorkspaces, error: ownedError } = await supabase
        .from("workspaces")
        .select("id, name, slug, owner_id, is_default, demo_mode, stripe_connected, tenant_id")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: true });

      if (ownedError) {
        console.error("[WorkspaceProvider] ownedWorkspaces error:", ownedError);
        throw ownedError;
      }

      // Also get workspaces user is a member of
      const { data: memberWorkspaces, error: memberError } = await supabase
        .from("workspace_members")
        .select("workspace:workspaces(id, name, slug, owner_id, is_default, demo_mode, stripe_connected, tenant_id)")
        .eq("user_id", user.id)
        .neq("role", "owner"); // Avoid duplicates with owned

      if (memberError) {
        console.error("[WorkspaceProvider] memberWorkspaces error:", memberError);
        throw memberError;
      }

      // Combine and dedupe
      const memberWs = (memberWorkspaces || [])
        .map((m) => m.workspace as Workspace | null)
        .filter((w): w is Workspace => w !== null);

      const allWorkspaces = [...(ownedWorkspaces || []), ...memberWs] as Workspace[];
      const uniqueWorkspaces = allWorkspaces.filter(
        (w, i, arr) => arr.findIndex((x) => x.id === w.id) === i
      );

      // If the user has *no* workspaces (common for legacy accounts), auto-create one.
      // This keeps the app usable without requiring manual backend intervention.
      if (uniqueWorkspaces.length === 0) {
        const autoKey = `workspace_autocreated_${user.id}`;
        const alreadyTried = localStorage.getItem(autoKey) === "1";

        if (!alreadyTried) {
          localStorage.setItem(autoKey, "1");

          const baseName = (user.email?.split("@")[0] || "My").replace(/[^a-zA-Z0-9]+/g, " ").trim();
          const name = baseName ? `${baseName}'s Workspace` : "My Workspace";
          const slug = `${(baseName || "my").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${user.id.slice(0, 6)}`;

          console.log("[WorkspaceProvider] No workspaces found; auto-creating:", { name, slug });

          const { data: ws, error: createErr } = await supabase
            .from("workspaces")
            .insert({
              name,
              slug,
              owner_id: user.id,
              is_default: true,
              demo_mode: true,
            })
            .select("id, name, slug, owner_id, is_default, demo_mode, stripe_connected, tenant_id")
            .single();

          if (createErr) {
            console.error("[WorkspaceProvider] auto-create workspace failed:", createErr);
          } else if (ws) {
            await supabase.from("workspace_members").insert({
              workspace_id: ws.id,
              user_id: user.id,
              role: "owner",
            });

            toast.success("Workspace created", { description: "We created your first workspace automatically." });
            // Re-run fetch to ensure selection logic runs against fresh list
            // (avoid depending on local ws variable and keep selection consistent)
            return await fetchWorkspaces();
          }
        }
      }

      setWorkspaces(uniqueWorkspaces);
      console.log("[WorkspaceProvider] workspaces loaded:", uniqueWorkspaces.length);

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
        setDemoMode(selectedWorkspace.demo_mode ?? false);
        setStripeConnected(selectedWorkspace.stripe_connected ?? false);
        localStorage.setItem(STORAGE_KEY, selectedWorkspace.id);

        // Fetch full integration status from view
        fetchIntegrationStatus(selectedWorkspace.id);

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
  }, [fetchIntegrationStatus]);

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
    setDemoMode(selected.demo_mode ?? false);
    setStripeConnected(selected.stripe_connected ?? false);
    localStorage.setItem(STORAGE_KEY, id);
    
    // Fetch full integration status
    fetchIntegrationStatus(id);

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
  }, [workspaces, fetchIntegrationStatus]);

  // Toggle demo mode for current workspace
  const toggleDemoMode = useCallback(async () => {
    if (!workspaceId) {
      toast.error("No workspace selected");
      return;
    }

    const newDemoMode = !demoMode;
    
    const { error } = await supabase
      .from("workspaces")
      .update({ demo_mode: newDemoMode })
      .eq("id", workspaceId);

    if (error) {
      toast.error("Failed to toggle demo mode");
      console.error(error);
      return;
    }

    setDemoMode(newDemoMode);
    
    // Update workspace in state
    setWorkspace((prev) => prev ? { ...prev, demo_mode: newDemoMode } : null);
    setWorkspaces((prev) => 
      prev.map((w) => w.id === workspaceId ? { ...w, demo_mode: newDemoMode } : w)
    );

    toast.success(newDemoMode ? "Demo mode enabled" : "Live mode enabled");
  }, [workspaceId, demoMode]);

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

  // Compute data quality status
  const dataQualityStatus: DataQualityStatus = demoMode 
    ? 'DEMO_MODE' 
    : (!analyticsConnected && !stripeConnected)
      ? 'NO_PROVIDER_CONNECTED'
      : !analyticsConnected 
        ? 'NO_ANALYTICS_CONNECTED'
        : !stripeConnected 
          ? 'NO_STRIPE_CONNECTED' 
          : 'LIVE_OK';

  const value: WorkspaceContextValue = {
    workspaceId,
    workspace,
    workspaces,
    isLoading,
    error,
    hasWorkspace: !!workspaceId,
    // Demo mode controls
    demoMode,
    stripeConnected,
    analyticsConnected,
    dataQualityStatus,
    toggleDemoMode,
    // Workspace actions
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
