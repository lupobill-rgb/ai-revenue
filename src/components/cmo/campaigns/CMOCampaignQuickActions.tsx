/**
 * CMO Campaign Quick Actions
 * Provides quick action buttons for campaign management
 */

import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bot, Plus, Sparkles, Target, TrendingUp } from 'lucide-react';

interface CMOCampaignQuickActionsProps {
  onActionClick?: (action: string) => void;
}

export function CMOCampaignQuickActions({ onActionClick }: CMOCampaignQuickActionsProps) {
  const navigate = useNavigate();

  const handleLaunchAutopilot = () => {
    navigate('/create?tab=content&type=autopilot');
    onActionClick?.('autopilot');
  };

  const handleCreateCampaign = () => {
    navigate('/create?tab=content');
    onActionClick?.('create');
  };

  return (
    <Card className="bg-gradient-to-br from-primary/5 via-transparent to-primary/5 border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Quick Actions
        </CardTitle>
      </CardHeader>
      <CardContent className="flex gap-3 flex-wrap">
        <Button
          onClick={handleLaunchAutopilot}
          className="gap-2"
        >
          <Bot className="h-4 w-4" />
          Launch Autopilot Campaign
        </Button>
        <Button
          variant="outline"
          onClick={handleCreateCampaign}
          className="gap-2 hover:bg-primary/10 hover:border-primary"
        >
          <Plus className="h-4 w-4" />
          Create Campaign
        </Button>
        <Button
          variant="outline"
          onClick={() => navigate('/reports')}
          className="gap-2 hover:bg-primary/10 hover:border-primary"
        >
          <TrendingUp className="h-4 w-4" />
          View Analytics
        </Button>
        <Button
          variant="outline"
          onClick={() => navigate('/crm')}
          className="gap-2 hover:bg-primary/10 hover:border-primary"
        >
          <Target className="h-4 w-4" />
          Manage Leads
        </Button>
      </CardContent>
    </Card>
  );
}
