/**
 * CMO Campaign Card with Autopilot Controls & Orchestration
 * Displays campaign status, stats, and autopilot settings
 * Uses React Query mutations for automatic cache invalidation
 * Integrates with orchestration layer for launching and optimizing
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { 
  Bot, Target, Users, Calendar, Sparkles, Activity, 
  Play, Pause, Zap, CheckCircle, AlertCircle, Settings 
} from 'lucide-react';
import type { CMOCampaign, CampaignGoal } from '@/lib/cmo/types';
import { 
  useToggleCampaignAutopilot, 
  useUpdateCampaignGoal,
  useLaunchCampaign,
  useOptimizeCampaign,
  usePauseCampaign,
  useResumeCampaign,
  useValidateIntegrations,
} from '@/hooks/useCMO';
import { CampaignRunDetailsDrawer } from '@/components/campaigns/CampaignRunDetailsDrawer';
import { toast } from 'sonner';
import { useWorkspace } from '@/hooks/useWorkspace';

interface CMOCampaignCardProps {
  campaign: CMOCampaign;
  onUpdate?: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  active: 'bg-green-500/10 text-green-500',
  paused: 'bg-yellow-500/10 text-yellow-500',
  completed: 'bg-purple-500/10 text-purple-500',
  scheduled: 'bg-blue-500/10 text-blue-500',
};

const GOAL_OPTIONS: { value: CampaignGoal; label: string }[] = [
  { value: 'leads', label: 'More leads' },
  { value: 'meetings', label: 'More meetings' },
  { value: 'revenue', label: 'More revenue' },
  { value: 'engagement', label: 'More engagement' },
];

export function CMOCampaignCard({ campaign, onUpdate }: CMOCampaignCardProps) {
  const [showRunDetails, setShowRunDetails] = useState(false);
  const { workspaceId } = useWorkspace();
  
  const toggleAutopilot = useToggleCampaignAutopilot();
  const updateGoal = useUpdateCampaignGoal();
  const launchCampaign = useLaunchCampaign();
  const optimizeCampaign = useOptimizeCampaign();
  const pauseCampaign = usePauseCampaign();
  const resumeCampaign = useResumeCampaign();
  
  // Get campaign channels for validation
  const campaignChannels = campaign.channels?.map(c => c.channel_name) || ['email', 'social'];
  
  // Validate integrations for this campaign's channels
  const { data: integrations } = useValidateIntegrations(
    workspaceId || '',
    campaignChannels
  );
  
  const isUpdating = toggleAutopilot.isPending || updateGoal.isPending;
  const isLaunching = launchCampaign.isPending;
  const isOptimizing = optimizeCampaign.isPending;
  const isPausing = pauseCampaign.isPending;
  const isResuming = resumeCampaign.isPending;
  const isLoading = isUpdating || isLaunching || isOptimizing || isPausing || isResuming;

  // Calculate integration readiness
  const readyIntegrations = integrations?.filter(i => i.ready) || [];
  const notReadyIntegrations = integrations?.filter(i => !i.ready && campaignChannels.some(c => c.includes(i.name) || i.name.includes(c))) || [];
  const integrationReadiness = integrations?.length 
    ? Math.round((readyIntegrations.length / integrations.length) * 100)
    : 0;

  const handleToggleAutopilot = () => {
    toggleAutopilot.mutate(
      { campaignId: campaign.id, enabled: !campaign.autopilot_enabled },
      {
        onSuccess: () => {
          toast.success(
            campaign.autopilot_enabled ? 'Autopilot disabled' : 'Autopilot enabled'
          );
          onUpdate?.();
        },
        onError: () => {
          toast.error('Failed to toggle autopilot');
        },
      }
    );
  };

  const handleGoalChange = (goal: string) => {
    updateGoal.mutate(
      { campaignId: campaign.id, goal: goal || null },
      {
        onSuccess: () => {
          toast.success('Campaign goal updated');
          onUpdate?.();
        },
        onError: () => {
          toast.error('Failed to update goal');
        },
      }
    );
  };

  const handleLaunch = () => {
    if (notReadyIntegrations.length > 0) {
      toast.error(`Configure integrations first: ${notReadyIntegrations.map(i => i.name).join(', ')}`);
      return;
    }
    
    launchCampaign.mutate(
      { campaignId: campaign.id, channels: campaignChannels },
      {
        onSuccess: (result) => {
          toast.success(
            `Campaign launched! ${result.channels_launched.length} channels active, ${result.deals_created} deals created`
          );
          onUpdate?.();
        },
        onError: (error) => {
          toast.error(`Launch failed: ${error.message}`);
        },
      }
    );
  };

  const handleOptimize = () => {
    optimizeCampaign.mutate(campaign.id, {
      onSuccess: (result) => {
        toast.success(`Campaign optimized: ${result.recommendations.length} improvements applied`);
        onUpdate?.();
      },
      onError: (error) => {
        toast.error(`Optimization failed: ${error.message}`);
      },
    });
  };

  const handlePause = () => {
    pauseCampaign.mutate(campaign.id, {
      onSuccess: () => {
        toast.success('Campaign paused');
        onUpdate?.();
      },
      onError: (error) => {
        toast.error(`Failed to pause: ${error.message}`);
      },
    });
  };

  const handleResume = () => {
    resumeCampaign.mutate(campaign.id, {
      onSuccess: () => {
        toast.success('Campaign resumed');
        onUpdate?.();
      },
      onError: (error) => {
        toast.error(`Failed to resume: ${error.message}`);
      },
    });
  };

  const channels = campaign.channels?.map((c) => c.channel_name).join(' • ') || 'No channels';

  return (
    <Card className="hover:border-primary/50 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base font-medium">
              {campaign.campaign_name}
            </CardTitle>
            {campaign.description && (
              <p className="text-sm text-muted-foreground line-clamp-1">
                {campaign.description}
              </p>
            )}
          </div>
          <Badge className={STATUS_COLORS[campaign.status || 'draft']}>
            {campaign.status || 'draft'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Channels */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Target className="h-4 w-4" />
          <span>{channels}</span>
        </div>

        {/* Integration Readiness */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Integration Status</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <div className="flex items-center gap-1">
                    {notReadyIntegrations.length === 0 ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-yellow-500" />
                    )}
                    <span className="text-xs">
                      {readyIntegrations.length}/{integrations?.length || 0} ready
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  {notReadyIntegrations.length === 0 ? (
                    <p>All integrations configured</p>
                  ) : (
                    <div className="space-y-1">
                      <p className="font-medium">Missing:</p>
                      {notReadyIntegrations.map(i => (
                        <p key={i.name} className="text-xs">{i.name}: {i.error}</p>
                      ))}
                    </div>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Progress value={integrationReadiness} className="h-1.5" />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span>ICP: {campaign.target_icp || 'Not set'}</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span>
              {campaign.start_date
                ? new Date(campaign.start_date).toLocaleDateString()
                : 'No date'}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          {campaign.status === 'draft' && (
            <Button 
              className="flex-1 gap-2" 
              size="sm"
              onClick={handleLaunch}
              disabled={isLoading || notReadyIntegrations.length > 0}
            >
              {isLaunching ? (
                <>Loading...</>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Launch
                </>
              )}
            </Button>
          )}
          {campaign.status === 'active' && (
            <>
              <Button 
                variant="outline" 
                className="flex-1 gap-2" 
                size="sm"
                onClick={handleOptimize}
                disabled={isLoading}
              >
                {isOptimizing ? (
                  <>Optimizing...</>
                ) : (
                  <>
                    <Zap className="h-4 w-4" />
                    Optimize
                  </>
                )}
              </Button>
              <Button 
                variant="outline" 
                className="gap-2" 
                size="sm"
                onClick={handlePause}
                disabled={isLoading}
              >
                <Pause className="h-4 w-4" />
              </Button>
            </>
          )}
          {campaign.status === 'paused' && (
            <Button 
              className="flex-1 gap-2" 
              size="sm"
              onClick={handleResume}
              disabled={isLoading}
            >
              {isResuming ? (
                <>Resuming...</>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Resume
                </>
              )}
            </Button>
          )}
          {notReadyIntegrations.length > 0 && campaign.status === 'draft' && (
            <Button 
              variant="outline" 
              size="sm"
              className="gap-2"
              asChild
            >
              <a href="/settings/integrations">
                <Settings className="h-4 w-4" />
                Setup
              </a>
            </Button>
          )}
        </div>

        {/* Autopilot Controls */}
        <div className="border-t pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary" />
              <Label htmlFor={`autopilot-${campaign.id}`} className="text-sm font-medium">
                Autopilot
              </Label>
            </div>
            <Switch
              id={`autopilot-${campaign.id}`}
              checked={campaign.autopilot_enabled || false}
              onCheckedChange={handleToggleAutopilot}
              disabled={isUpdating}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm text-muted-foreground">Campaign Goal</Label>
            <Select
              value={campaign.goal || ''}
              onValueChange={handleGoalChange}
              disabled={isUpdating}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select goal…" />
              </SelectTrigger>
              <SelectContent>
                {GOAL_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Last Optimization Note */}
        {campaign.last_optimization_at && (
          <div className="border-t pt-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5 mb-1">
              <Sparkles className="h-3 w-3 text-primary" />
              <strong>Last AI optimization:</strong>{' '}
              {new Date(campaign.last_optimization_at).toLocaleDateString()}
            </div>
            {campaign.last_optimization_note && (
              <p className="line-clamp-2">{campaign.last_optimization_note}</p>
            )}
          </div>
        )}

        {/* Run Details Button - show for deployed/active campaigns */}
        {(campaign.status === 'active' || campaign.status === 'deployed' || campaign.status === 'completed') && (
          <div className="border-t pt-3">
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={() => setShowRunDetails(true)}
            >
              <Activity className="h-4 w-4" />
              View Run Details
            </Button>
          </div>
        )}
      </CardContent>

      {/* Run Details Drawer */}
      <CampaignRunDetailsDrawer
        campaignId={campaign.id}
        campaignName={campaign.campaign_name}
        open={showRunDetails}
        onOpenChange={setShowRunDetails}
      />
    </Card>
  );
}
