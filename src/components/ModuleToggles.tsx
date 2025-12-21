/**
 * Module Toggles UI Component
 * For use in Settings / Tenant Control page
 * 
 * Platform admins can toggle modules on/off
 * Tenant admins can only VIEW enabled modules (read-only)
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAllModulesEnabled, useToggleModule, ModuleName } from "@/hooks/useModuleEnabled";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Brain, TrendingUp, DollarSign, Settings2, Users, Shield, Lock, Eye } from "lucide-react";

const MODULE_CONFIG: Record<ModuleName, { 
  label: string; 
  description: string; 
  icon: typeof Brain;
  badge?: string;
  comingSoon?: boolean;
}> = {
  ai_cmo: {
    label: "AI CMO",
    description: "AI-powered marketing automation with campaign planning, content generation, and optimization",
    icon: Brain,
    badge: "Active",
  },
  ai_cro: {
    label: "AI CRO",
    description: "Revenue operations with deal reviews, forecasting, and pipeline optimization",
    icon: TrendingUp,
    badge: "Active",
  },
  ai_cfo: {
    label: "AI CFO",
    description: "Financial planning, budgeting, and reporting automation",
    icon: DollarSign,
    badge: "Coming Soon",
    comingSoon: true,
  },
  ai_coo: {
    label: "AI COO",
    description: "Operations management, workflows, and process optimization",
    icon: Settings2,
    badge: "Coming Soon",
    comingSoon: true,
  },
  crm: {
    label: "CRM",
    description: "Lead management, pipeline tracking, and email sequences",
    icon: Users,
  },
  os_admin: {
    label: "OS Admin",
    description: "System administration and advanced configuration",
    icon: Shield,
  },
};

export function ModuleToggles() {
  const { modules, isLoading, refetch } = useAllModulesEnabled();
  const { toggleModule } = useToggleModule();
  const { toast } = useToast();
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);

  useEffect(() => {
    checkPlatformAdmin();
  }, []);

  const checkPlatformAdmin = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setCheckingAdmin(false);
      return;
    }

    const { data } = await supabase.rpc("is_platform_admin");
    setIsPlatformAdmin(!!data);
    setCheckingAdmin(false);
  };

  const handleToggle = async (moduleName: ModuleName, enabled: boolean) => {
    // Only platform admins can toggle
    if (!isPlatformAdmin) {
      toast({
        title: "Permission Denied",
        description: "Only platform administrators can enable or disable modules.",
        variant: "destructive",
      });
      return;
    }

    // Prevent enabling coming soon modules
    if (enabled && MODULE_CONFIG[moduleName].comingSoon) {
      toast({
        title: "Coming Soon",
        description: `${MODULE_CONFIG[moduleName].label} is not yet available. Stay tuned!`,
      });
      return;
    }

    const result = await toggleModule(moduleName, enabled);
    
    if (result.success) {
      toast({
        title: enabled ? "Module Enabled" : "Module Disabled",
        description: `${MODULE_CONFIG[moduleName].label} has been ${enabled ? "enabled" : "disabled"}.`,
      });
      refetch();
    } else {
      toast({
        title: "Error",
        description: result.error || "Failed to update module access",
        variant: "destructive",
      });
    }
  };

  if (isLoading || checkingAdmin) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isPlatformAdmin ? (
            <Shield className="h-5 w-5 text-primary" />
          ) : (
            <Eye className="h-5 w-5 text-muted-foreground" />
          )}
          Module Access
        </CardTitle>
        <CardDescription>
          {isPlatformAdmin 
            ? "Enable or disable AI modules for your workspace. Disabled modules will be hidden from navigation."
            : "View enabled modules for your workspace. Contact a platform administrator to change module access."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!isPlatformAdmin && (
          <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
            <Lock className="h-4 w-4" />
            Module configuration is managed by platform administrators
          </div>
        )}

        {(Object.keys(MODULE_CONFIG) as ModuleName[]).map((moduleName) => {
          const config = MODULE_CONFIG[moduleName];
          const Icon = config.icon;
          const isEnabled = modules[moduleName];
          const isComingSoon = config.comingSoon;

          return (
            <div
              key={moduleName}
              className={`flex items-center justify-between rounded-lg border border-border p-4 ${
                isComingSoon ? "opacity-60" : ""
              }`}
            >
              <div className="flex items-start gap-4">
                <div className={`rounded-md p-2 ${isEnabled ? "bg-primary/10" : "bg-muted"}`}>
                  <Icon className={`h-5 w-5 ${isEnabled ? "text-primary" : "text-muted-foreground"}`} />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Label htmlFor={moduleName} className="font-medium">
                      {config.label}
                    </Label>
                    {config.badge && (
                      <Badge 
                        variant={config.badge === "Active" ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {config.badge}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {config.description}
                  </p>
                </div>
              </div>
              
              {isPlatformAdmin ? (
                <Switch
                  id={moduleName}
                  checked={isEnabled}
                  onCheckedChange={(checked) => handleToggle(moduleName, checked)}
                  disabled={isComingSoon}
                />
              ) : (
                <Badge variant={isEnabled ? "default" : "outline"}>
                  {isEnabled ? "Enabled" : "Disabled"}
                </Badge>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export default ModuleToggles;
