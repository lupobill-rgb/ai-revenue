// CMO Context - Workspace and tenant state management

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { CMOWorkflowStep, CMOWorkflowState } from "@/lib/cmo/types";

interface CMOContextValue {
  // Tenant & Workspace
  tenantId: string | null;
  workspaceId: string | null;
  isLoading: boolean;
  error: string | null;
  
  // Workflow State
  workflowState: CMOWorkflowState;
  setCurrentStep: (step: CMOWorkflowStep) => void;
  markStepCompleted: (step: CMOWorkflowStep) => void;
  resetWorkflow: () => void;
  
  // Refresh
  refreshContext: () => Promise<void>;
}

const defaultWorkflowState: CMOWorkflowState = {
  currentStep: "brand-intake",
  completedSteps: [],
};

const CMOContext = createContext<CMOContextValue | undefined>(undefined);

export function CMOProvider({ children }: { children: React.ReactNode }) {
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workflowState, setWorkflowState] = useState<CMOWorkflowState>(defaultWorkflowState);

  const fetchContext = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setTenantId(null);
        setWorkspaceId(null);
        return;
      }

      // Get user's tenant
      const { data: userTenant, error: tenantError } = await supabase
        .from("user_tenants")
        .select("tenant_id")
        .eq("user_id", user.id)
        .single();

      if (tenantError && tenantError.code !== "PGRST116") {
        throw tenantError;
      }

      // Get user's workspace
      const { data: workspace, error: workspaceError } = await supabase
        .from("workspaces")
        .select("id")
        .eq("owner_id", user.id)
        .single();

      if (workspaceError && workspaceError.code !== "PGRST116") {
        throw workspaceError;
      }

      setTenantId(userTenant?.tenant_id || null);
      setWorkspaceId(workspace?.id || null);

      // Load workflow state from localStorage
      const savedState = localStorage.getItem(`cmo_workflow_${user.id}`);
      if (savedState) {
        try {
          setWorkflowState(JSON.parse(savedState));
        } catch {
          // Invalid saved state, use default
        }
      }
    } catch (err) {
      console.error("CMO context error:", err);
      setError(err instanceof Error ? err.message : "Failed to load CMO context");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContext();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchContext();
    });

    return () => subscription.unsubscribe();
  }, [fetchContext]);

  // Persist workflow state
  useEffect(() => {
    const saveState = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        localStorage.setItem(`cmo_workflow_${user.id}`, JSON.stringify(workflowState));
      }
    };
    saveState();
  }, [workflowState]);

  const setCurrentStep = useCallback((step: CMOWorkflowStep) => {
    setWorkflowState((prev) => ({ ...prev, currentStep: step }));
  }, []);

  const markStepCompleted = useCallback((step: CMOWorkflowStep) => {
    setWorkflowState((prev) => ({
      ...prev,
      completedSteps: prev.completedSteps.includes(step)
        ? prev.completedSteps
        : [...prev.completedSteps, step],
    }));
  }, []);

  const resetWorkflow = useCallback(() => {
    setWorkflowState(defaultWorkflowState);
  }, []);

  const value: CMOContextValue = {
    tenantId,
    workspaceId,
    isLoading,
    error,
    workflowState,
    setCurrentStep,
    markStepCompleted,
    resetWorkflow,
    refreshContext: fetchContext,
  };

  return <CMOContext.Provider value={value}>{children}</CMOContext.Provider>;
}

export function useCMOContext() {
  const context = useContext(CMOContext);
  if (context === undefined) {
    throw new Error("useCMOContext must be used within a CMOProvider");
  }
  return context;
}
