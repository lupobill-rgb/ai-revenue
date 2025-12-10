/**
 * CMO Campaign Card with Autopilot Controls
 * Displays campaign status, stats, and autopilot settings
 * Uses React Query mutations for automatic cache invalidation
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Bot, Target, Users, Calendar, Sparkles } from 'lucide-react';
import type { CMOCampaign, CampaignGoal } from '@/lib/cmo/types';
import { useToggleCampaignAutopilot, useUpdateCampaignGoal } from '@/hooks/useCMO';
import { toast } from 'sonner';

interface CMOCampaignCardProps {
  campaign: CMOCampaign;
  onUpdate?: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  active: 'bg-green-500/10 text-green-500',
  paused: 'bg-yellow-500/10 text-yellow-500',
  completed: 'bg-purple-500/10 text-purple-500',
};

const GOAL_OPTIONS: { value: CampaignGoal; label: string }[] = [
  { value: 'leads', label: 'More leads' },
  { value: 'meetings', label: 'More meetings' },
  { value: 'revenue', label: 'More revenue' },
  { value: 'engagement', label: 'More engagement' },
];

export function CMOCampaignCard({ campaign, onUpdate }: CMOCampaignCardProps) {
  const toggleAutopilot = useToggleCampaignAutopilot();
  const updateGoal = useUpdateCampaignGoal();
  
  const isUpdating = toggleAutopilot.isPending || updateGoal.isPending;

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
      </CardContent>
    </Card>
  );
}
