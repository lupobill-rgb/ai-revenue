/**
 * Autopilot Campaign Wizard
 * AI-powered autonomous campaign builder
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Bot, Loader2, CheckCircle2, Mail, MessageSquare, Linkedin, Phone, Layout } from 'lucide-react';
import { buildAutopilotCampaign } from '@/lib/cmo/api';
import { toast } from 'sonner';
import type { CampaignGoal } from '@/lib/cmo/types';

interface AutopilotCampaignWizardProps {
  workspaceId?: string;
  onComplete?: (result: any) => void;
}

const CHANNEL_OPTIONS = [
  { id: 'email', label: 'Email', icon: Mail },
  { id: 'sms', label: 'SMS', icon: MessageSquare },
  { id: 'linkedin', label: 'LinkedIn', icon: Linkedin },
  { id: 'voice', label: 'AI Voice', icon: Phone },
  { id: 'landing_page', label: 'Landing Pages', icon: Layout },
];

const GOAL_OPTIONS: { value: CampaignGoal; label: string }[] = [
  { value: 'leads', label: 'Generate qualified leads' },
  { value: 'meetings', label: 'Book meetings' },
  { value: 'revenue', label: 'Drive revenue' },
  { value: 'engagement', label: 'Grow engagement' },
];

export function AutopilotCampaignWizard({ workspaceId, onComplete }: AutopilotCampaignWizardProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [icp, setIcp] = useState('');
  const [offer, setOffer] = useState('');
  const [selectedChannels, setSelectedChannels] = useState<string[]>(['email']);
  const [desiredResult, setDesiredResult] = useState<CampaignGoal>('leads');

  const handleChannelToggle = (channelId: string) => {
    setSelectedChannels((prev) =>
      prev.includes(channelId)
        ? prev.filter((c) => c !== channelId)
        : [...prev, channelId]
    );
  };

  const handleBuild = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!icp.trim() || !offer.trim()) {
      toast.error('Please fill in ICP and offer details');
      return;
    }

    if (selectedChannels.length === 0) {
      toast.error('Please select at least one channel');
      return;
    }

    setLoading(true);
    try {
      const data = await buildAutopilotCampaign({
        icp,
        offer,
        channels: selectedChannels,
        desiredResult,
        workspaceId,
      });
      setResult(data);
      toast.success('Autopilot campaign created successfully!');
      onComplete?.(data);
    } catch (error: any) {
      console.error('Error building autopilot campaign:', error);
      toast.error(error.message || 'Failed to build campaign');
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
      <Card className="border-green-500/20 bg-green-500/5">
        <CardHeader>
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
            <div>
              <CardTitle className="text-green-500">Campaign Created</CardTitle>
              <CardDescription>
                AI has generated all assets for your campaign
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Posts, sequences, landing pages, and voice scripts were generated.
          </p>
          {result.assetsCreated && (
            <p className="text-sm">
              <strong>{result.assetsCreated}</strong> assets created across{' '}
              <strong>{selectedChannels.length}</strong> channels
            </p>
          )}
          <div className="flex gap-3">
            <Button onClick={() => setResult(null)} variant="outline">
              Create Another
            </Button>
            <Button onClick={() => (window.location.href = '/approvals')}>
              Review & Approve
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-transparent to-primary/5">
      <CardHeader>
        <div className="flex items-center gap-3">
          <Bot className="h-8 w-8 text-primary" />
          <div>
            <CardTitle>Autopilot Campaign Builder</CardTitle>
            <CardDescription>
              Let AI build everything - posts, sequences, landing pages, and voice scripts
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleBuild} className="space-y-6">
          {/* ICP */}
          <div className="space-y-2">
            <Label htmlFor="icp">Who are we targeting? (ICP) *</Label>
            <Textarea
              id="icp"
              value={icp}
              onChange={(e) => setIcp(e.target.value)}
              placeholder="e.g., B2B SaaS founders with 10-50 employees, struggling with customer acquisition..."
              rows={3}
              required
            />
          </div>

          {/* Offer */}
          <div className="space-y-2">
            <Label htmlFor="offer">What are we selling? *</Label>
            <Textarea
              id="offer"
              value={offer}
              onChange={(e) => setOffer(e.target.value)}
              placeholder="e.g., AI-powered marketing automation platform that 3x's lead generation..."
              rows={3}
              required
            />
          </div>

          {/* Channels */}
          <fieldset className="space-y-3">
            <Label>Which channels can we use?</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {CHANNEL_OPTIONS.map((channel) => (
                <div
                  key={channel.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedChannels.includes(channel.id)
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => handleChannelToggle(channel.id)}
                >
                  <Checkbox
                    checked={selectedChannels.includes(channel.id)}
                    onCheckedChange={() => handleChannelToggle(channel.id)}
                  />
                  <channel.icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{channel.label}</span>
                </div>
              ))}
            </div>
          </fieldset>

          {/* Goal */}
          <div className="space-y-2">
            <Label htmlFor="desiredResult">Primary Goal *</Label>
            <Select
              value={desiredResult}
              onValueChange={(v) => setDesiredResult(v as CampaignGoal)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select goal" />
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

          {/* Submit */}
          <Button type="submit" disabled={loading} className="w-full" size="lg">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Building…
              </>
            ) : (
              <>
                <Bot className="h-4 w-4 mr-2" />
                Let AI Build Everything
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
