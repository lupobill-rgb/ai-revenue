import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface DemoModeState {
  demoMode: boolean;
  loading: boolean;
  workspaceId: string | null;
}

/**
 * Hook to get the centralized demo_mode state from the workspace.
 * All sample/demo data gating should use this hook instead of local toggles.
 */
export function useDemoMode(): DemoModeState {
  const [demoMode, setDemoMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  useEffect(() => {
    const fetchDemoMode = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false);
          return;
        }

        // Get workspace from localStorage or find user's first workspace
        let wsId = localStorage.getItem("currentWorkspaceId");
        
        if (!wsId) {
          const { data: workspaces } = await supabase
            .from("workspaces")
            .select("id")
            .eq("owner_id", user.id)
            .order("created_at", { ascending: true })
            .limit(1);
          
          if (workspaces && workspaces.length > 0) {
            wsId = workspaces[0].id;
          }
        }

        if (wsId) {
          setWorkspaceId(wsId);
          
          const { data: workspace } = await supabase
            .from("workspaces")
            .select("demo_mode")
            .eq("id", wsId)
            .maybeSingle();
          
          if (workspace) {
            setDemoMode(workspace.demo_mode ?? false);
          }
        }
      } catch (error) {
        console.error("Error fetching demo mode:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDemoMode();

    // Subscribe to workspace changes
    const channel = supabase
      .channel('demo-mode-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'workspaces',
        },
        (payload) => {
          if (payload.new && workspaceId && payload.new.id === workspaceId) {
            setDemoMode(payload.new.demo_mode ?? false);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [workspaceId]);

  return { demoMode, loading, workspaceId };
}
