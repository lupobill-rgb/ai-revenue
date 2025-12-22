// Demo Mode Toggle - Controls workspace demo_mode with integration status indicators
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useWorkspaceContext } from "@/contexts/WorkspaceContext";
import { AlertCircle, CheckCircle2, Database, CreditCard, BarChart3 } from "lucide-react";

interface DemoModeToggleProps {
  className?: string;
  showIntegrationStatus?: boolean;
}

export function DemoModeToggle({ className = "", showIntegrationStatus = true }: DemoModeToggleProps) {
  const { 
    demoMode, 
    stripeConnected, 
    analyticsConnected, 
    dataQualityStatus,
    toggleDemoMode,
    isLoading 
  } = useWorkspaceContext();

  return (
    <div className={`flex items-center gap-4 ${className}`}>
      {/* Demo Mode Toggle */}
      <div className="flex items-center gap-2">
        <Switch
          id="demo-mode"
          checked={demoMode}
          onCheckedChange={toggleDemoMode}
          disabled={isLoading}
        />
        <Label htmlFor="demo-mode" className="text-sm font-medium cursor-pointer">
          {demoMode ? "Demo Mode" : "Live Mode"}
        </Label>
      </div>

      {/* Data Quality Status Badge */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <Badge 
              variant={dataQualityStatus === 'LIVE_OK' ? 'default' : dataQualityStatus === 'DEMO_MODE' ? 'secondary' : 'destructive'}
              className="gap-1"
            >
              {dataQualityStatus === 'LIVE_OK' && <CheckCircle2 className="h-3 w-3" />}
              {dataQualityStatus === 'DEMO_MODE' && <Database className="h-3 w-3" />}
              {dataQualityStatus !== 'LIVE_OK' && dataQualityStatus !== 'DEMO_MODE' && <AlertCircle className="h-3 w-3" />}
              {dataQualityStatus.replace(/_/g, ' ')}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">
              {dataQualityStatus === 'LIVE_OK' && "All integrations connected. Showing real data."}
              {dataQualityStatus === 'DEMO_MODE' && "Demo mode active. Showing sample data."}
              {dataQualityStatus === 'NO_STRIPE_CONNECTED' && "Revenue data hidden. Connect Stripe to see real revenue."}
              {dataQualityStatus === 'NO_ANALYTICS_CONNECTED' && "Impressions hidden. Connect analytics provider."}
              {dataQualityStatus === 'NO_PROVIDER_CONNECTED' && "No providers connected. Revenue and impressions hidden."}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Integration Status Indicators */}
      {showIntegrationStatus && !demoMode && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <div className={`flex items-center gap-1 ${stripeConnected ? 'text-green-600' : 'text-muted-foreground'}`}>
                  <CreditCard className="h-3 w-3" />
                  <span className="sr-only">Stripe</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{stripeConnected ? "Stripe connected" : "Stripe not connected"}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <div className={`flex items-center gap-1 ${analyticsConnected ? 'text-green-600' : 'text-muted-foreground'}`}>
                  <BarChart3 className="h-3 w-3" />
                  <span className="sr-only">Analytics</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{analyticsConnected ? "Analytics connected" : "Analytics not connected"}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}
    </div>
  );
}