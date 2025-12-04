/**
 * Module Toggle Hook
 * Checks tenant_module_access for current tenant
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ModuleName = "ai_cmo" | "ai_cro" | "ai_cfo" | "ai_coo" | "crm" | "os_admin";

// Default module visibility
const DEFAULT_MODULE_STATE: Record<ModuleName, boolean> = {
  ai_cmo: true,
  ai_cro: true,
  ai_cfo: false,
  ai_coo: false,
  crm: true,
  os_admin: true,
};

async function getTenantId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: userTenant } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .eq("user_id", user.id)
    .single();

  return userTenant?.tenant_id || user.id;
}

async function fetchModuleAccess(moduleName: ModuleName): Promise<boolean> {
  const tenantId = await getTenantId();
  if (!tenantId) return DEFAULT_MODULE_STATE[moduleName] ?? false;

  // Query tenant_module_access table
  const { data, error } = await supabase
    .from("tenant_module_access")
    .select("enabled")
    .eq("tenant_id", tenantId)
    .eq("module_id", moduleName)
    .single();

  if (error || !data) {
    // Fall back to default if no override exists
    return DEFAULT_MODULE_STATE[moduleName] ?? false;
  }

  return data.enabled;
}

async function fetchAllModuleAccess(): Promise<Record<ModuleName, boolean>> {
  const tenantId = await getTenantId();
  if (!tenantId) return { ...DEFAULT_MODULE_STATE };

  const { data, error } = await supabase
    .from("tenant_module_access")
    .select("module_id, enabled")
    .eq("tenant_id", tenantId);

  if (error || !data) {
    return { ...DEFAULT_MODULE_STATE };
  }

  // Merge defaults with tenant overrides
  const result = { ...DEFAULT_MODULE_STATE };
  data.forEach((row: { module_id: string; enabled: boolean }) => {
    if (row.module_id in result) {
      result[row.module_id as ModuleName] = row.enabled;
    }
  });

  return result;
}

/**
 * Hook to check if a single module is enabled for the current tenant
 */
export function useModuleEnabled(moduleName: ModuleName) {
  const { data: isEnabled, isLoading, error } = useQuery({
    queryKey: ["moduleAccess", moduleName],
    queryFn: () => fetchModuleAccess(moduleName),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  return {
    isEnabled: isEnabled ?? DEFAULT_MODULE_STATE[moduleName] ?? false,
    isLoading,
    error,
  };
}

/**
 * Hook to get all module access states
 */
export function useAllModulesEnabled() {
  const { data: modules, isLoading, error, refetch } = useQuery({
    queryKey: ["moduleAccess", "all"],
    queryFn: fetchAllModuleAccess,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  return {
    modules: modules ?? { ...DEFAULT_MODULE_STATE },
    isLoading,
    error,
    refetch,
  };
}

/**
 * Hook to toggle module access (admin only)
 */
export function useToggleModule() {
  const queryClient = useQueryClient();

  const toggleModule = async (moduleName: ModuleName, enabled: boolean): Promise<{ success: boolean; error?: string }> => {
    const tenantId = await getTenantId();
    if (!tenantId) {
      return { success: false, error: "No tenant found" };
    }

    const { error } = await supabase
      .from("tenant_module_access")
      .upsert({
        tenant_id: tenantId,
        module_id: moduleName,
        enabled,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "tenant_id,module_id",
      });

    if (error) {
      return { success: false, error: error.message };
    }

    // Invalidate cache
    await queryClient.invalidateQueries({ queryKey: ["moduleAccess"] });
    
    return { success: true };
  };

  return { toggleModule };
}

/**
 * Standalone function to check module access (for use outside React)
 */
export async function checkModuleEnabled(moduleName: ModuleName): Promise<boolean> {
  return fetchModuleAccess(moduleName);
}
