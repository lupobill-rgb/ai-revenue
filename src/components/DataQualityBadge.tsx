/**
 * DataQualityBadge - Fail-fast visual indicator for data quality status
 * 
 * HARD RULE: Every KPI display area MUST show this badge.
 * Shows one of: DEMO_MODE, LIVE_OK, NO_STRIPE_CONNECTED, NO_ANALYTICS_CONNECTED, NO_PROVIDER_CONNECTED
 * 
 * If status is not LIVE_OK and not DEMO_MODE, KPIs must show 0.
 */

import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { 
  Database, 
  CheckCircle2, 
  AlertCircle, 
  CreditCard, 
  BarChart3, 
  Activity,
  Settings,
  Phone
} from "lucide-react";
import { useNavigate } from "react-router-dom";

export type DataQualityStatus = 
  | 'DEMO_MODE' 
  | 'LIVE_OK' 
  | 'NO_STRIPE_CONNECTED' 
  | 'NO_ANALYTICS_CONNECTED' 
  | 'NO_PROVIDER_CONNECTED'
  | 'NO_VOICE_PROVIDER_CONNECTED'
  | 'EMPTY_CRM'
  | 'REVENUE_UNVERIFIED';

interface DataQualityBadgeProps {
  status: DataQualityStatus;
  compact?: boolean;
  className?: string;
}

/**
 * Compact badge for inline display next to KPIs
 */
export function DataQualityBadge({ status, compact = false, className = "" }: DataQualityBadgeProps) {
  const config = getStatusConfig(status);
  
  if (compact) {
    return (
      <Badge 
        variant="outline" 
        className={`${config.badgeClass} text-xs ${className}`}
      >
        <config.icon className="h-3 w-3 mr-1" />
        {config.shortLabel}
      </Badge>
    );
  }
  
  return (
    <Badge 
      variant="outline" 
      className={`${config.badgeClass} ${className}`}
    >
      <config.icon className="h-3 w-3 mr-1" />
      {config.label}
    </Badge>
  );
}

interface DataQualityBannerProps {
  status: DataQualityStatus;
  onConnectStripe?: () => void;
  onConnectAnalytics?: () => void;
  showActions?: boolean;
}

/**
 * Full-width banner for dashboard headers - shows warnings and CTAs
 */
export function DataQualityBanner({ 
  status, 
  onConnectStripe, 
  onConnectAnalytics,
  showActions = true 
}: DataQualityBannerProps) {
  const navigate = useNavigate();
  const config = getStatusConfig(status);
  
  // LIVE_OK doesn't need a banner
  if (status === 'LIVE_OK') return null;
  
  return (
    <Alert className={`mb-6 ${config.alertClass}`}>
      <config.icon className={`h-4 w-4 ${config.iconClass}`} />
      <AlertTitle className="font-semibold">{config.alertTitle}</AlertTitle>
      <AlertDescription className="mt-1">
        {config.alertDescription}
        {showActions && (
          <div className="mt-3 flex gap-2">
            {(status === 'NO_STRIPE_CONNECTED' || status === 'NO_PROVIDER_CONNECTED') && (
              <Button 
                size="sm" 
                variant="outline" 
                onClick={onConnectStripe || (() => navigate("/settings/integrations"))}
              >
                <CreditCard className="h-3 w-3 mr-1" />
                Connect Stripe
              </Button>
            )}
            {(status === 'NO_ANALYTICS_CONNECTED' || status === 'NO_PROVIDER_CONNECTED') && (
              <Button 
                size="sm" 
                variant="outline" 
                onClick={onConnectAnalytics || (() => navigate("/settings/integrations"))}
              >
                <BarChart3 className="h-3 w-3 mr-1" />
                Connect Analytics
              </Button>
            )}
            {status === 'NO_VOICE_PROVIDER_CONNECTED' && (
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => navigate("/settings/integrations")}
              >
                <Phone className="h-3 w-3 mr-1" />
                Connect Voice Provider
              </Button>
            )}
            {status === 'DEMO_MODE' && (
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => navigate("/settings")}
              >
                <Settings className="h-3 w-3 mr-1" />
                Exit Demo Mode
              </Button>
            )}
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
}

/**
 * Helper to determine if KPIs should show real values or zeros
 */
export function canShowKPI(status: DataQualityStatus, kpiType: 'revenue' | 'impressions' | 'pipeline' | 'voice' | 'all'): boolean {
  // Demo mode shows demo values
  if (status === 'DEMO_MODE') return true;
  
  // LIVE_OK shows all real values
  if (status === 'LIVE_OK') return true;
  
  // Otherwise, check specific KPI gating
  switch (kpiType) {
    case 'revenue':
      return status !== 'NO_STRIPE_CONNECTED' && status !== 'NO_PROVIDER_CONNECTED';
    case 'impressions':
      return status !== 'NO_ANALYTICS_CONNECTED' && status !== 'NO_PROVIDER_CONNECTED';
    case 'voice':
      return status !== 'NO_VOICE_PROVIDER_CONNECTED' && status !== 'NO_PROVIDER_CONNECTED';
    case 'pipeline':
      // Pipeline KPIs (leads, wins, losses) always show - they come from CRM
      return true;
    case 'all':
      return false; // If asking for all, must have LIVE_OK or DEMO_MODE
    default:
      return false;
  }
}

/**
 * Format a KPI value with proper gating - returns 0 if not allowed
 */
export function formatGatedKPI(
  value: number | null | undefined,
  status: DataQualityStatus,
  kpiType: 'revenue' | 'impressions' | 'pipeline' | 'voice' | 'all',
  formatter: (v: number) => string = (v) => v.toLocaleString()
): string {
  if (!canShowKPI(status, kpiType)) {
    return kpiType === 'revenue' ? '$0.00' : '0';
  }
  
  if (value === null || value === undefined) {
    return kpiType === 'revenue' ? '$0.00' : '0';
  }
  
  return formatter(value);
}

// Internal helper for status configuration
function getStatusConfig(status: DataQualityStatus) {
  switch (status) {
    case 'DEMO_MODE':
      return {
        label: 'Demo Mode',
        shortLabel: 'DEMO',
        icon: Database,
        badgeClass: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
        alertClass: 'border-amber-500/50 bg-amber-500/10',
        iconClass: 'text-amber-500',
        alertTitle: 'Demo Data Active',
        alertDescription: 'You are viewing sample data. Toggle off demo mode to see real metrics.',
      };
    case 'LIVE_OK':
      return {
        label: 'Live Data',
        shortLabel: 'LIVE',
        icon: CheckCircle2,
        badgeClass: 'bg-green-500/10 text-green-600 border-green-500/20',
        alertClass: '',
        iconClass: 'text-green-500',
        alertTitle: 'Live Data',
        alertDescription: 'All metrics are from verified data sources.',
      };
    case 'NO_STRIPE_CONNECTED':
      return {
        label: 'No Stripe',
        shortLabel: 'NO STRIPE',
        icon: CreditCard,
        badgeClass: 'bg-destructive/10 text-destructive border-destructive/20',
        alertClass: 'border-destructive/50 bg-destructive/10',
        iconClass: 'text-destructive',
        alertTitle: 'Revenue Unavailable',
        alertDescription: 'Connect Stripe to track revenue, ROI, and deal values. Revenue KPIs show $0 until connected.',
      };
    case 'NO_ANALYTICS_CONNECTED':
      return {
        label: 'No Analytics',
        shortLabel: 'NO ANALYTICS',
        icon: BarChart3,
        badgeClass: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
        alertClass: 'border-orange-500/50 bg-orange-500/10',
        iconClass: 'text-orange-500',
        alertTitle: 'Analytics Unavailable',
        alertDescription: 'Connect Google Analytics or Meta Ads to track impressions and clicks. Engagement KPIs show 0 until connected.',
      };
    case 'NO_PROVIDER_CONNECTED':
      return {
        label: 'No Providers',
        shortLabel: 'DISCONNECTED',
        icon: AlertCircle,
        badgeClass: 'bg-destructive/10 text-destructive border-destructive/20',
        alertClass: 'border-destructive/50 bg-destructive/10',
        iconClass: 'text-destructive',
        alertTitle: 'No Data Providers Connected',
        alertDescription: 'Connect Stripe and Analytics integrations to populate your dashboard with real data.',
      };
    case 'NO_VOICE_PROVIDER_CONNECTED':
      return {
        label: 'No Voice Provider',
        shortLabel: 'NO VOICE',
        icon: Phone,
        badgeClass: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
        alertClass: 'border-orange-500/50 bg-orange-500/10',
        iconClass: 'text-orange-500',
        alertTitle: 'Setup Required',
        alertDescription: 'Connect ElevenLabs to enable live call analytics. Until connected, voice KPIs show 0.',
      };
    case 'EMPTY_CRM':
      return {
        label: 'Empty CRM',
        shortLabel: 'NO DATA',
        icon: Activity,
        badgeClass: 'bg-muted text-muted-foreground border-border',
        alertClass: 'border-border bg-muted/50',
        iconClass: 'text-muted-foreground',
        alertTitle: 'No CRM Data',
        alertDescription: 'Import leads or create deals to start tracking your pipeline.',
      };
    case 'REVENUE_UNVERIFIED':
      return {
        label: 'Unverified Revenue',
        shortLabel: 'UNVERIFIED',
        icon: AlertCircle,
        badgeClass: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
        alertClass: 'border-amber-500/50 bg-amber-500/10',
        iconClass: 'text-amber-500',
        alertTitle: 'Revenue Not Verified',
        alertDescription: 'Deal values exist but are not verified against Stripe transactions.',
      };
    default:
      return {
        label: 'Unknown',
        shortLabel: '?',
        icon: AlertCircle,
        badgeClass: 'bg-muted text-muted-foreground border-border',
        alertClass: '',
        iconClass: 'text-muted-foreground',
        alertTitle: 'Unknown Status',
        alertDescription: '',
      };
  }
}
