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
import { Bot, Loader2, CheckCircle2, Mail, MessageSquare, Linkedin, Phone, Layout, Users, Tag } from 'lucide-react';
import { buildAutopilotCampaign } from '@/lib/cmo/api';
import { requireTenantId } from '@/lib/tenant';
import { cmoKeys } from '@/hooks/useCMO';
import { toast } from 'sonner';
import type { CampaignGoal } from '@/lib/cmo/types';
import { useWorkspaceContext, useActiveWorkspaceId } from '@/contexts/WorkspaceContext';
import { WorkspaceGate } from '@/components/WorkspaceGate';
import { supabase } from '@/integrations/supabase/client';

interface AutopilotCampaignWizardProps {
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

export function AutopilotCampaignWizard({ onComplete }: AutopilotCampaignWizardProps) {
  const queryClient = useQueryClient();
  const workspaceId = useActiveWorkspaceId();
  const { workspace } = useWorkspaceContext();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [icp, setIcp] = useState('');
  const [offer, setOffer] = useState('');
  const [selectedChannels, setSelectedChannels] = useState<string[]>(['email']);
  const [desiredResult, setDesiredResult] = useState<CampaignGoal>('leads');
  
  // Tag/Segment targeting state
  const [enableTagTargeting, setEnableTagTargeting] = useState(false);
  const [enableSegmentTargeting, setEnableSegmentTargeting] = useState(false);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [availableSegments, setAvailableSegments] = useState<Array<{ code: string; name: string }>>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedSegments, setSelectedSegments] = useState<string[]>([]);
  const [matchingLeadsCount, setMatchingLeadsCount] = useState<number | null>(null);
  const [loadingCount, setLoadingCount] = useState(false);

  // Fetch available tags and segments
  useEffect(() => {
    if (!workspaceId) return;
    
    const fetchTagsAndSegments = async () => {
      // Fetch unique tags from leads
      const { data: leadsData } = await supabase
        .from('leads')
        .select('tags')
        .eq('workspace_id', workspaceId)
        .not('tags', 'is', null);
      
      if (leadsData) {
        const tagsSet = new Set<string>();
        leadsData.forEach((lead: any) => {
          if (Array.isArray(lead.tags)) {
            lead.tags.forEach((tag: string) => tagsSet.add(tag));
          }
        });
        setAvailableTags(Array.from(tagsSet).sort());
      }
      
      // Fetch active segments (Master Prompt requirement: tenant_id + is_active)
      const { data: segmentsData } = await supabase
        .from('cmo_icp_segments')
        .select('segment_code, segment_name')
        .eq('workspace_id', workspaceId)
        .eq('is_active', true)
        .order('segment_name');
      
      if (segmentsData) {
        setAvailableSegments(
          segmentsData.map((s: any) => ({ code: s.segment_code, name: s.segment_name }))
        );
      }
    };
    
    fetchTagsAndSegments();
  }, [workspaceId]);

  // Calculate matching leads count when filters change
  useEffect(() => {
    if (!workspaceId || (!enableTagTargeting && !enableSegmentTargeting)) {
      setMatchingLeadsCount(null);
      return;
    }
    
    const fetchMatchingCount = async () => {
      setLoadingCount(true);
      try {
        let query = supabase
          .from('leads')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', workspaceId);
        
        // Apply tag filter if enabled
        if (enableTagTargeting && selectedTags.length > 0) {
          query = query.overlaps('tags', selectedTags);
        }
        
        // Apply segment filter if enabled
        if (enableSegmentTargeting && selectedSegments.length > 0) {
          query = query.in('segment_code', selectedSegments);
        }
        
        const { count } = await query;
        setMatchingLeadsCount(count);
      } catch (error) {
        console.error('Error fetching matching leads count:', error);
      } finally {
        setLoadingCount(false);
      }
    };
    
    fetchMatchingCount();
  }, [workspaceId, enableTagTargeting, enableSegmentTargeting, selectedTags, selectedSegments]);

  const handleChannelToggle = (channelId: string) => {
    setSelectedChannels((prev) =>
      prev.includes(channelId)
        ? prev.filter((c) => c !== channelId)
        : [...prev, channelId]
    );
  };

  const handleBuild = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!workspaceId) {
      toast.error('Select a workspace to build an autopilot campaign');
      return;
    }

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
      // Validate we have tenant context
      requireTenantId({
        activeTenantId: workspace?.tenant_id ?? null,
        workspaceId,
      });

      const data = await buildAutopilotCampaign({
        icp,
        offer,
        channels: selectedChannels,
        desiredResult,
        workspaceId,
        targetTags: enableTagTargeting && selectedTags.length > 0 ? selectedTags : undefined,
        targetSegments: enableSegmentTargeting && selectedSegments.length > 0 ? selectedSegments : undefined,
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
      <WorkspaceGate feature="autopilot campaign creation">
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
      </WorkspaceGate>
    );
  }

  return (
    <WorkspaceGate feature="autopilot campaign creation">
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

          {/* Tag Targeting */}
          <div className="space-y-3 p-4 rounded-lg border bg-muted/20">
            <div className="flex items-center gap-3">
              <Checkbox
                id="enable-tag-targeting"
                checked={enableTagTargeting}
                onCheckedChange={(checked) => setEnableTagTargeting(checked === true)}
              />
              <div className="flex-1">
                <Label htmlFor="enable-tag-targeting" className="flex items-center gap-2 cursor-pointer">
                  <Tag className="h-4 w-4" />
                  Target specific lead tags
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Only reach leads with these tags
                </p>
              </div>
            </div>
            
            {enableTagTargeting && (
              <div className="space-y-2 pl-7">
                {availableTags.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No tags found in your leads</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {availableTags.map((tag) => (
                      <Badge
                        key={tag}
                        variant={selectedTags.includes(tag) ? 'default' : 'outline'}
                        className="cursor-pointer"
                        onClick={() => {
                          setSelectedTags(prev =>
                            prev.includes(tag)
                              ? prev.filter(t => t !== tag)
                              : [...prev, tag]
                          );
                        }}
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
                {selectedTags.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Selected: {selectedTags.join(', ')}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Segment Targeting */}
          <div className="space-y-3 p-4 rounded-lg border bg-muted/20">
            <div className="flex items-center gap-3">
              <Checkbox
                id="enable-segment-targeting"
                checked={enableSegmentTargeting}
                onCheckedChange={(checked) => setEnableSegmentTargeting(checked === true)}
              />
              <div className="flex-1">
                <Label htmlFor="enable-segment-targeting" className="flex items-center gap-2 cursor-pointer">
                  <Users className="h-4 w-4" />
                  Target specific segments
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Only reach leads in these ICP segments
                </p>
              </div>
            </div>
            
            {enableSegmentTargeting && (
              <div className="space-y-2 pl-7">
                {availableSegments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No active segments configured</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {availableSegments.map((segment) => (
                      <Badge
                        key={segment.code}
                        variant={selectedSegments.includes(segment.code) ? 'default' : 'outline'}
                        className="cursor-pointer"
                        onClick={() => {
                          setSelectedSegments(prev =>
                            prev.includes(segment.code)
                              ? prev.filter(s => s !== segment.code)
                              : [...prev, segment.code]
                          );
                        }}
                      >
                        {segment.name}
                      </Badge>
                    ))}
                  </div>
                )}
                {selectedSegments.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Selected: {availableSegments.filter(s => selectedSegments.includes(s.code)).map(s => s.name).join(', ')}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Matching Leads Count */}
          {(enableTagTargeting || enableSegmentTargeting) && (
            <div className="p-4 rounded-lg border bg-primary/5 border-primary/20">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium">Target Audience Size</p>
                  {loadingCount ? (
                    <p className="text-xs text-muted-foreground">Calculating...</p>
                  ) : matchingLeadsCount !== null ? (
                    <p className="text-lg font-bold text-primary">
                      {matchingLeadsCount.toLocaleString()} leads
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Select filters to see count</p>
                  )}
                </div>
              </div>
            </div>
          )}

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
    </WorkspaceGate>
  );
}
