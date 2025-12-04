import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { 
  GitBranch,
  Loader2,
  Sparkles,
  Target,
  Users,
  ShoppingCart,
  Heart,
  Megaphone,
  ArrowDown,
  Save,
  BarChart3
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface FunnelData {
  funnel: {
    funnel_name: string;
    funnel_type: string;
    description: string;
    target_icp_segments: string[];
    target_offers: string[];
    total_budget: number;
    expected_conversion_rate: number;
    expected_revenue: number;
  };
  stages: Array<{
    stage_name: string;
    stage_type: string;
    stage_order: number;
    description: string;
    objective: string;
    kpis: Array<{ metric: string; target: number; measurement: string }>;
    campaign_types: Array<{ type: string; description: string; estimated_cost: number; expected_results: string }>;
    channels: string[];
    content_assets: Array<{ asset_type: string; title: string; purpose: string; target_icp: string }>;
    target_icps: string[];
    linked_offers: string[];
    entry_criteria: string;
    exit_criteria: string;
    expected_volume: number;
    conversion_rate_target: number;
    budget_allocation: number;
  }>;
}

interface CMOFunnelArchitectProps {
  workspaceId: string;
  planId?: string;
  onFunnelSaved?: () => void;
}

const stageIcons: Record<string, React.ReactNode> = {
  awareness: <Megaphone className="h-5 w-5" />,
  consideration: <Target className="h-5 w-5" />,
  conversion: <ShoppingCart className="h-5 w-5" />,
  retention: <Heart className="h-5 w-5" />,
  advocacy: <Users className="h-5 w-5" />,
};

const stageColors: Record<string, string> = {
  awareness: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  consideration: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  conversion: 'bg-green-500/10 text-green-600 border-green-500/30',
  retention: 'bg-purple-500/10 text-purple-600 border-purple-500/30',
  advocacy: 'bg-pink-500/10 text-pink-600 border-pink-500/30',
};

export function CMOFunnelArchitect({ workspaceId, planId, onFunnelSaved }: CMOFunnelArchitectProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [funnelData, setFunnelData] = useState<FunnelData | null>(null);
  const [streamContent, setStreamContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [funnelType, setFunnelType] = useState<string>('marketing');

  const parseFunnelFromStream = (content: string): FunnelData | null => {
    const funnelMatch = content.match(/```json:funnel\n([\s\S]*?)\n```/);
    if (funnelMatch) {
      try {
        return JSON.parse(funnelMatch[1]);
      } catch (e) {
        console.error('Failed to parse funnel JSON:', e);
      }
    }
    return null;
  };

  const generateFunnel = async () => {
    setIsGenerating(true);
    setStreamContent('');
    setFunnelData(null);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cmo-funnel-architect`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            workspaceId,
            planId,
            funnelType,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate funnel');
      }

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let newlineIndex;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullContent += content;
              setStreamContent(fullContent);
              
              const parsedFunnel = parseFunnelFromStream(fullContent);
              if (parsedFunnel) {
                setFunnelData(parsedFunnel);
              }
            }
          } catch {
            buffer = line + '\n' + buffer;
            break;
          }
        }
      }

      const finalFunnel = parseFunnelFromStream(fullContent);
      if (finalFunnel) {
        setFunnelData(finalFunnel);
        toast.success('Funnel structure generated!');
      }

    } catch (error) {
      console.error('Funnel generation error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate funnel');
    } finally {
      setIsGenerating(false);
    }
  };

  const saveFunnel = async () => {
    if (!funnelData) return;

    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Please log in to save');
        return;
      }

      // Save funnel
      const { data: funnel, error: funnelError } = await (supabase.from('cmo_funnels') as any)
        .insert({
          workspace_id: workspaceId,
          plan_id: planId || null,
          created_by: user.id,
          funnel_name: funnelData.funnel.funnel_name,
          funnel_type: funnelData.funnel.funnel_type,
          description: funnelData.funnel.description,
          target_icp_segments: funnelData.funnel.target_icp_segments,
          target_offers: funnelData.funnel.target_offers,
          total_budget: funnelData.funnel.total_budget,
          expected_conversion_rate: funnelData.funnel.expected_conversion_rate,
          expected_revenue: funnelData.funnel.expected_revenue,
          status: 'draft',
        })
        .select()
        .single();

      if (funnelError) throw funnelError;

      // Save stages
      const stagesWithFunnelId = funnelData.stages.map(stage => ({
        funnel_id: funnel.id,
        stage_name: stage.stage_name,
        stage_type: stage.stage_type,
        stage_order: stage.stage_order,
        description: stage.description,
        objective: stage.objective,
        kpis: stage.kpis,
        campaign_types: stage.campaign_types,
        channels: stage.channels,
        content_assets: stage.content_assets,
        target_icps: stage.target_icps,
        linked_offers: stage.linked_offers,
        entry_criteria: stage.entry_criteria,
        exit_criteria: stage.exit_criteria,
        expected_volume: stage.expected_volume,
        conversion_rate_target: stage.conversion_rate_target,
        budget_allocation: stage.budget_allocation,
      }));

      const { error: stagesError } = await (supabase.from('cmo_funnel_stages') as any)
        .insert(stagesWithFunnelId);

      if (stagesError) throw stagesError;

      toast.success('Funnel saved successfully!');
      onFunnelSaved?.();
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save funnel');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Generator Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Funnel Architect
          </CardTitle>
          <CardDescription>
            Design a complete funnel structure with stages, KPIs, and campaign types.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Funnel Type</Label>
            <Select value={funnelType} onValueChange={setFunnelType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="marketing">Marketing Funnel</SelectItem>
                <SelectItem value="sales">Sales Funnel</SelectItem>
                <SelectItem value="product">Product-Led Funnel</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button 
            onClick={generateFunnel} 
            disabled={isGenerating}
            className="w-full gap-2"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Designing Funnel...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate Funnel Structure
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Funnel Visualization */}
      {funnelData && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{funnelData.funnel.funnel_name}</CardTitle>
                <CardDescription className="mt-1">
                  {funnelData.funnel.description}
                </CardDescription>
              </div>
              <Button onClick={saveFunnel} disabled={isSaving} className="gap-2">
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save Funnel
              </Button>
            </div>

            {/* Funnel Stats */}
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold">
                  ${funnelData.funnel.total_budget?.toLocaleString() || 0}
                </div>
                <div className="text-sm text-muted-foreground">Total Budget</div>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold">
                  {((funnelData.funnel.expected_conversion_rate || 0) * 100).toFixed(1)}%
                </div>
                <div className="text-sm text-muted-foreground">Expected Conversion</div>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold">
                  ${funnelData.funnel.expected_revenue?.toLocaleString() || 0}
                </div>
                <div className="text-sm text-muted-foreground">Expected Revenue</div>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {/* Funnel Stages */}
            <div className="space-y-4">
              {funnelData.stages
                .sort((a, b) => a.stage_order - b.stage_order)
                .map((stage, index) => (
                  <div key={index}>
                    {/* Stage Card */}
                    <Card className={`border-2 ${stageColors[stage.stage_type] || 'border-border'}`}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${stageColors[stage.stage_type] || 'bg-muted'}`}>
                              {stageIcons[stage.stage_type] || <Target className="h-5 w-5" />}
                            </div>
                            <div>
                              <CardTitle className="text-lg">{stage.stage_name}</CardTitle>
                              <Badge variant="outline" className="mt-1 capitalize">
                                {stage.stage_type}
                              </Badge>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold">{stage.expected_volume?.toLocaleString()}</div>
                            <div className="text-sm text-muted-foreground">Expected Volume</div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <p className="text-sm text-muted-foreground">{stage.objective}</p>

                        {/* KPIs */}
                        <div>
                          <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                            <BarChart3 className="h-4 w-4" /> KPIs
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {stage.kpis?.map((kpi, i) => (
                              <Badge key={i} variant="secondary">
                                {kpi.metric}: {kpi.target?.toLocaleString()} ({kpi.measurement})
                              </Badge>
                            ))}
                          </div>
                        </div>

                        {/* Campaign Types */}
                        <div>
                          <h4 className="font-medium text-sm mb-2">Campaign Types</h4>
                          <div className="grid gap-2">
                            {stage.campaign_types?.slice(0, 3).map((campaign, i) => (
                              <div key={i} className="text-sm p-2 bg-muted rounded">
                                <span className="font-medium">{campaign.type}</span>
                                <span className="text-muted-foreground"> - {campaign.description}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Channels & Assets */}
                        <div className="flex flex-wrap gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Channels: </span>
                            {stage.channels?.join(', ')}
                          </div>
                          <div>
                            <span className="text-muted-foreground">Budget: </span>
                            ${stage.budget_allocation?.toLocaleString()}
                          </div>
                          <div>
                            <span className="text-muted-foreground">Conv. Rate: </span>
                            {((stage.conversion_rate_target || 0) * 100).toFixed(1)}%
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Arrow between stages */}
                    {index < funnelData.stages.length - 1 && (
                      <div className="flex justify-center py-2">
                        <ArrowDown className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Streaming Content */}
      {isGenerating && streamContent && !funnelData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Designing Funnel...
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64">
              <pre className="text-sm whitespace-pre-wrap">{streamContent}</pre>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
