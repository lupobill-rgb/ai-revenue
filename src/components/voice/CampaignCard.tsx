/**
 * Voice Campaign Card Component
 * Displays campaign status, stats, and actions
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Play,
  Pause,
  MoreVertical,
  Phone,
  Users,
  Clock,
  TrendingUp,
  CheckCircle2,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { VoiceCampaign } from '@/lib/voice/types';

interface CampaignCardProps {
  campaign: VoiceCampaign;
  onStart?: () => void;
  onPause?: () => void;
  onEdit?: () => void;
  onViewDetails?: () => void;
  isExecuting?: boolean;
}

const STATUS_COLORS: Record<VoiceCampaign['status'], string> = {
  draft: 'bg-muted text-muted-foreground',
  scheduled: 'bg-blue-500/10 text-blue-500',
  active: 'bg-green-500/10 text-green-500',
  paused: 'bg-yellow-500/10 text-yellow-500',
  completed: 'bg-purple-500/10 text-purple-500',
};

export function CampaignCard({
  campaign,
  onStart,
  onPause,
  onEdit,
  onViewDetails,
  isExecuting,
}: CampaignCardProps) {
  const stats = campaign.stats;
  const progress = stats ? (stats.called / stats.totalLeads) * 100 : 0;

  return (
    <Card className="hover:border-primary/50 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base font-medium">{campaign.name}</CardTitle>
            {campaign.goal && (
              <p className="text-sm text-muted-foreground line-clamp-1">{campaign.goal}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge className={STATUS_COLORS[campaign.status]}>{campaign.status}</Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onViewDetails}>View Details</DropdownMenuItem>
                <DropdownMenuItem onClick={onEdit}>Edit Campaign</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats Grid */}
        {stats && (
          <div className="grid grid-cols-4 gap-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{stats.totalLeads}</p>
                <p className="text-xs text-muted-foreground">Leads</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{stats.called}</p>
                <p className="text-xs text-muted-foreground">Called</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{stats.answered}</p>
                <p className="text-xs text-muted-foreground">Answered</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{stats.booked}</p>
                <p className="text-xs text-muted-foreground">Booked</p>
              </div>
            </div>
          </div>
        )}

        {/* Progress */}
        {stats && stats.totalLeads > 0 && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Progress</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          {campaign.status === 'draft' || campaign.status === 'paused' ? (
            <Button
              onClick={onStart}
              disabled={isExecuting}
              className="flex-1"
              size="sm"
            >
              <Play className="h-4 w-4 mr-2" />
              {campaign.status === 'paused' ? 'Resume' : 'Start'}
            </Button>
          ) : campaign.status === 'active' ? (
            <Button
              onClick={onPause}
              variant="outline"
              className="flex-1"
              size="sm"
            >
              <Pause className="h-4 w-4 mr-2" />
              Pause
            </Button>
          ) : null}
          <Button variant="outline" size="sm" onClick={onViewDetails}>
            Details
          </Button>
        </div>

        {/* Metadata */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Created {new Date(campaign.createdAt).toLocaleDateString()}
          </span>
          {stats?.avgDuration && (
            <span>Avg: {Math.round(stats.avgDuration / 60)}m</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
