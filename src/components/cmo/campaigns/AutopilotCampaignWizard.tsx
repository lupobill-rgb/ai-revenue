/**
 * Autopilot Campaign Wizard
 * AI-powered autonomous campaign builder
 * Invalidates campaign queries on completion for automatic refresh
 */

import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Bot, Loader2, CheckCircle2, Mail, MessageSquare, Linkedin, Phone, Layout, Tags } from 'lucide-react';
import { buildAutopilotCampaign } from '@/lib/cmo/api';
import { getTenantContextSafe, requireTenantId } from '@/lib/tenant';
import { cmoKeys } from '@/hooks/useCMO';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { CampaignGoal } from '@/lib/cmo/types';

interface AutopilotCampaignWizardProps {
  workspaceId?: string;
  tenantId?: string;
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

const AVAILABLE_TAGS = [
  { name: "Hot Lead", color: "bg-red-500/10 text-red-500 border-red-500/20" },
  { name: "Decision Maker", color: "bg-purple-500/10 text-purple-500 border-purple-500/20" },
  { name: "Budget Approved", color: "bg-green-500/10 text-green-500 border-green-500/20" },
  { name: "Needs Demo", color: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
  { name: "Referral", color: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
  { name: "Enterprise", color: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20" },
  { name: "SMB", color: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20" },
  { name: "Follow Up", color: "bg-orange-500/10 text-orange-500 border-orange-500/20" },
  { name: "Priority", color: "bg-pink-500/10 text-pink-500 border-pink-500/20" },
  { name: "Competitor", color: "bg-slate-500/10 text-slate-500 border-slate-500/20" },
];

export function AutopilotCampaignWizard({ workspaceId, tenantId: propTenantId, onComplete }: AutopilotCampaignWizardProps) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [icp, setIcp] = useState('');
  const [offer, setOffer] = useState('');
  const [selectedChannels, setSelectedChannels] = useState<string[]>(['email']);
  const [desiredResult, setDesiredResult] = useState<CampaignGoal>('leads');
  const [filterByTags, setFilterByTags] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [matchingLeadsCount, setMatchingLeadsCount] = useState<number | null>(null);
  const [loadingCount, setLoadingCount] = useState(false);

  // Fetch matching leads count when tags change
  useEffect(() => {
    if (!filterByTags || selectedTags.length === 0) {
      setMatchingLeadsCount(null);
      return;
    }

    const fetchCount = async () => {
      setLoadingCount(true);
      try {
        const { count, error } = await supabase
          .from("leads")
          .select("id", { count: "exact", head: true })
          .overlaps("tags", selectedTags);

        if (!error) {
          setMatchingLeadsCount(count ?? 0);
        }
      } catch (err) {
        console.error("Error fetching lead count:", err);
      } finally {
        setLoadingCount(false);
      }
    };

    fetchCount();
  }, [filterByTags, selectedTags]);

  const handleChannelToggle = (channelId: string) => {
    setSelectedChannels((prev) =>
      prev.includes(channelId)
        ? prev.filter((c) => c !== channelId)
        : [...prev, channelId]
    );
  };

  const handleTagToggle = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag)
        ? prev.filter((t) => t !== tag)
        : [...prev, tag]
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
      // Resolve tenant context from multiple sources
      const context = await getTenantContextSafe();
      const resolvedWorkspaceId = workspaceId || context.workspaceId;
      
      // Validate we have tenant context
      requireTenantId({
        activeTenantId: propTenantId || context.tenantId,
        workspaceId: resolvedWorkspaceId,
      });

      const data = await buildAutopilotCampaign({
        icp,
        offer,
        channels: selectedChannels,
        desiredResult,
        workspaceId: resolvedWorkspaceId || undefined,
        targetTags: filterByTags && selectedTags.length > 0 ? selectedTags : undefined,
      });
      setResult(data);
      
      // Invalidate campaigns query for automatic refresh
      queryClient.invalidateQueries({ queryKey: cmoKeys.all });
      
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

          {/* Target Tags */}
          <fieldset className="space-y-3">
            <div className="flex items-center gap-2">
              <Checkbox 
                id="filter-by-tags"
                checked={filterByTags} 
                onCheckedChange={(checked) => {
                  setFilterByTags(checked === true);
                  if (!checked) setSelectedTags([]);
                }}
              />
              <Label htmlFor="filter-by-tags" className="cursor-pointer flex items-center gap-2">
                <Tags className="h-4 w-4" />
                Target specific lead tags
              </Label>
            </div>
            
            {filterByTags && (
              <div className="space-y-3 pl-6">
                <p className="text-sm text-muted-foreground">
                  Only leads with these tags will be included in the campaign:
                </p>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_TAGS.map((tag) => (
                    <Badge
                      key={tag.name}
                      variant="outline"
                      className={`cursor-pointer transition-all ${
                        selectedTags.includes(tag.name) 
                          ? tag.color + " ring-2 ring-offset-1 ring-primary" 
                          : "opacity-60 hover:opacity-100"
                      }`}
                      onClick={() => handleTagToggle(tag.name)}
                    >
                      <Checkbox 
                        checked={selectedTags.includes(tag.name)} 
                        className="mr-1.5 h-3 w-3"
                        onCheckedChange={() => handleTagToggle(tag.name)}
                      />
                      {tag.name}
                    </Badge>
                  ))}
                </div>
                {selectedTags.length > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">
                      Matching leads:
                    </span>
                    {loadingCount ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Badge variant="secondary">
                        {matchingLeadsCount?.toLocaleString() ?? 0}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            )}
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
