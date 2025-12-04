/**
 * Module Toggles UI Component
 * For use in Settings / Tenant Control page
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAllModulesEnabled, useToggleModule, ModuleName } from "@/hooks/useModuleEnabled";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Brain, TrendingUp, DollarSign, Settings2, Users, Shield } from "lucide-react";

const MODULE_CONFIG: Record<ModuleName, { 
  label: string; 
  description: string; 
  icon: typeof Brain;
  badge?: string;
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
  },
  ai_coo: {
    label: "AI COO",
    description: "Operations management, workflows, and process optimization",
    icon: Settings2,
    badge: "Coming Soon",
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

  const handleToggle = async (moduleName: ModuleName, enabled: boolean) => {
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

  if (isLoading) {
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
          <Shield className="h-5 w-5 text-primary" />
          Module Access
        </CardTitle>
        <CardDescription>
          Enable or disable AI modules for your workspace. Disabled modules will be hidden from navigation.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {(Object.keys(MODULE_CONFIG) as ModuleName[]).map((moduleName) => {
          const config = MODULE_CONFIG[moduleName];
          const Icon = config.icon;
          const isEnabled = modules[moduleName];

          return (
            <div
              key={moduleName}
              className="flex items-center justify-between rounded-lg border border-border p-4"
            >
              <div className="flex items-start gap-4">
                <div className="rounded-md bg-primary/10 p-2">
                  <Icon className="h-5 w-5 text-primary" />
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
              <Switch
                id={moduleName}
                checked={isEnabled}
                onCheckedChange={(checked) => handleToggle(moduleName, checked)}
              />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export default ModuleToggles;
