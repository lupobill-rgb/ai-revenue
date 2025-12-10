import { useState, useEffect } from "react";
import { useCMOContext } from "@/contexts/CMOContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Sparkles,
  Globe,
  ExternalLink,
  FileText,
  Loader2,
  Eye,
  EyeOff,
  RefreshCw,
  Check,
  Rocket,
  Layout,
  Monitor,
  X,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface ParsedLandingPage {
  id: string;
  assetId: string;
  variantId?: string;
  campaignId: string | null;
  campaignName?: string;
  status: string;
  createdAt: string;
  internalName: string;
  urlSlug: string;
  publishedUrl: string;
  templateType: string;
  heroHeadline: string;
  heroSubheadline: string;
  heroSupportingPoints: string[];
  sections: Array<{
    type: string;
    heading: string;
    body: string;
    bullets: string[];
    enabled: boolean;
  }>;
  primaryCtaLabel: string;
  primaryCtaType: 'form' | 'calendar';
  formFields: Array<{
    name: string;
    label: string;
    type: string;
    required: boolean;
  }>;
  autoWired: boolean;
}

interface Campaign {
  id: string;
  campaign_name: string;
}

function LandingPagesTab() {
  const { tenantId, isLoading: contextLoading } = useCMOContext();
  const queryClient = useQueryClient();
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("all");
  const [selectedPage, setSelectedPage] = useState<ParsedLandingPage | null>(null);
  const [editedPage, setEditedPage] = useState<ParsedLandingPage | null>(null);
  const [saving, setSaving] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);

  // Fetch campaigns for filter
  const { data: campaigns } = useQuery({
    queryKey: ['campaigns-for-landing', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase
        .from('cmo_campaigns')
        .select('id, campaign_name')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });
      return (data || []) as Campaign[];
    },
    enabled: !!tenantId,
  });

  // Fetch landing pages
  const { data: landingPages, isLoading } = useQuery({
    queryKey: ['landing-pages', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      
      const { data: assets, error } = await supabase
        .from('cmo_content_assets')
        .select(`
          id, title, campaign_id, status, created_at,
          key_message, cta, supporting_points
        `)
        .eq('tenant_id', tenantId)
        .eq('content_type', 'landing_page')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const assetIds = assets?.map(a => a.id) || [];
      const { data: variants } = await supabase
        .from('cmo_content_variants')
        .select('*')
        .in('asset_id', assetIds);

      const campaignIds = [...new Set(assets?.filter(a => a.campaign_id).map(a => a.campaign_id))] as string[];
      const { data: campaignsData } = await supabase
        .from('cmo_campaigns')
        .select('id, campaign_name')
        .in('id', campaignIds);

      const campaignMap = new Map(campaignsData?.map(c => [c.id, c.campaign_name]));

      return (assets || []).map(asset => {
        const variant = variants?.find(v => v.asset_id === asset.id);
        let bodyContent: any = {};
        try {
          bodyContent = variant?.body_content ? JSON.parse(variant.body_content) : {};
        } catch {}

        return {
          id: `${asset.id}-${variant?.id || 'default'}`,
          assetId: asset.id,
          variantId: variant?.id,
          campaignId: asset.campaign_id,
          campaignName: asset.campaign_id ? campaignMap.get(asset.campaign_id) : undefined,
          status: asset.status || 'draft',
          createdAt: asset.created_at,
          internalName: asset.title,
          urlSlug: bodyContent.url_slug || '',
          publishedUrl: bodyContent.published_url || '',
          templateType: bodyContent.template_type || 'lead_magnet',
          heroHeadline: variant?.headline || asset.key_message || '',
          heroSubheadline: variant?.subject_line || '',
          heroSupportingPoints: bodyContent.hero_supporting_points || asset.supporting_points || [],
          sections: bodyContent.sections || [],
          primaryCtaLabel: variant?.cta_text || asset.cta || 'Get Started',
          primaryCtaType: bodyContent.primary_cta_type || 'form',
          formFields: bodyContent.form_fields || [],
          autoWired: (variant?.metadata as any)?.auto_wired || false,
        } as ParsedLandingPage;
      });
    },
    enabled: !!tenantId,
  });

  // Filter pages by campaign
  const filteredPages = landingPages?.filter(page => 
    selectedCampaignId === "all" || page.campaignId === selectedCampaignId
  ) || [];

  // Auto-select first page when available
  useEffect(() => {
    if (filteredPages.length && !selectedPage) {
      setSelectedPage(filteredPages[0]);
      setEditedPage(filteredPages[0]);
    }
  }, [filteredPages, selectedPage]);

  const handleSelectPage = (page: ParsedLandingPage) => {
    setSelectedPage(page);
    setEditedPage({ ...page });
  };

  const handleFieldChange = <K extends keyof ParsedLandingPage>(
    key: K,
    value: ParsedLandingPage[K]
  ) => {
    if (!editedPage) return;
    setEditedPage({ ...editedPage, [key]: value });
  };

  const handleSectionToggle = (idx: number, enabled: boolean) => {
    if (!editedPage) return;
    const sections = [...editedPage.sections];
    sections[idx] = { ...sections[idx], enabled };
    setEditedPage({ ...editedPage, sections });
  };

  const handleSave = async () => {
    if (!editedPage || !tenantId) return;
    setSaving(true);

    try {
      await supabase
        .from('cmo_content_assets')
        .update({
          title: editedPage.internalName,
          key_message: editedPage.heroHeadline,
          cta: editedPage.primaryCtaLabel,
          supporting_points: editedPage.heroSupportingPoints,
        })
        .eq('id', editedPage.assetId);

      if (editedPage.variantId) {
        await supabase
          .from('cmo_content_variants')
          .update({
            headline: editedPage.heroHeadline,
            subject_line: editedPage.heroSubheadline,
            cta_text: editedPage.primaryCtaLabel,
            body_content: JSON.stringify({
              template_type: editedPage.templateType,
              url_slug: editedPage.urlSlug,
              published_url: editedPage.publishedUrl,
              hero_supporting_points: editedPage.heroSupportingPoints,
              sections: editedPage.sections,
              primary_cta_type: editedPage.primaryCtaType,
              form_fields: editedPage.formFields,
            }),
          })
          .eq('id', editedPage.variantId);
      }

      await queryClient.invalidateQueries({ queryKey: ['landing-pages', tenantId] });
      setSelectedPage(editedPage);
      toast.success('Landing page saved');
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save landing page');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!editedPage) return;
    setSaving(true);

    try {
      await supabase
        .from('cmo_content_assets')
        .update({ status: 'published' })
        .eq('id', editedPage.assetId);

      await queryClient.invalidateQueries({ queryKey: ['landing-pages', tenantId] });
      toast.success('Landing page published!');
      
      if (editedPage.publishedUrl) {
        window.open(editedPage.publishedUrl, '_blank');
      }
    } catch (error) {
      console.error('Publish error:', error);
      toast.error('Failed to publish landing page');
    } finally {
      setSaving(false);
    }
  };

  const handleRebuildWithAI = async () => {
    if (!editedPage || !tenantId) return;
    setRebuilding(true);

    try {
      const { data, error } = await supabase.functions.invoke('ai-cmo-landing-pages-generate', {
        body: {
          tenant_id: tenantId,
          draft: {
            internalName: editedPage.internalName,
            urlSlug: editedPage.urlSlug,
            templateType: editedPage.templateType,
            heroHeadline: editedPage.heroHeadline,
            heroSubheadline: editedPage.heroSubheadline,
            heroSupportingPoints: editedPage.heroSupportingPoints,
            sections: editedPage.sections,
            primaryCtaLabel: editedPage.primaryCtaLabel,
            primaryCtaType: editedPage.primaryCtaType,
            formFields: editedPage.formFields,
          }
        }
      });

      if (error) throw error;

      if (data) {
        setEditedPage({
          ...editedPage,
          heroHeadline: data.heroHeadline || editedPage.heroHeadline,
          heroSubheadline: data.heroSubheadline || editedPage.heroSubheadline,
          heroSupportingPoints: data.heroSupportingPoints || editedPage.heroSupportingPoints,
          sections: data.sections || editedPage.sections,
          primaryCtaLabel: data.primaryCtaLabel || editedPage.primaryCtaLabel,
        });
        toast.success('AI rebuilt the landing page');
      }
    } catch (error) {
      console.error('Rebuild error:', error);
      toast.error('Failed to rebuild with AI');
    } finally {
      setRebuilding(false);
    }
  };

  const closeEditor = () => {
    setSelectedPage(null);
    setEditedPage(null);
  };

  if (contextLoading || isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!tenantId) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FileText className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">
          Please complete onboarding to manage landing pages.
        </p>
      </div>
    );
  }

  if (!landingPages?.length) {
    return (
      <Card className="max-w-lg mx-auto">
        <CardHeader className="text-center">
          <Layout className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
          <CardTitle>No Landing Pages Yet</CardTitle>
          <CardDescription>
            Landing pages are automatically created by AI when you build campaigns with Autopilot.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <Button onClick={() => window.location.href = '/new-campaign'}>
            <Rocket className="h-4 w-4 mr-2" />
            Create Campaign with Autopilot
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Editor view when a page is selected
  if (selectedPage && editedPage) {
    return (
      <div className="flex flex-col lg:flex-row gap-6 h-full">
        {/* Desktop Preview Panel */}
        <div className="flex-1 min-w-0">
          <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" onClick={closeEditor}>
                  <X className="h-4 w-4" />
                </Button>
                <div>
                  <CardTitle className="text-base">{editedPage.internalName}</CardTitle>
                  <CardDescription className="text-xs flex items-center gap-2 mt-1">
                    <Badge variant={editedPage.status === 'published' ? 'default' : 'secondary'}>
                      {editedPage.status}
                    </Badge>
                    {editedPage.campaignName && (
                      <span>Campaign: {editedPage.campaignName}</span>
                    )}
                  </CardDescription>
                </div>
              </div>
              <div className="flex gap-2">
                {editedPage.status === 'published' && editedPage.publishedUrl && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={editedPage.publishedUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      View Live
                    </a>
                  </Button>
                )}
                <Button onClick={handlePublish} disabled={saving} size="sm">
                  <Globe className="h-4 w-4 mr-2" />
                  Publish
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              {/* Desktop Mock Frame */}
              <div className="bg-muted rounded-lg p-2">
                <div className="bg-background rounded-md border shadow-sm overflow-hidden">
                  {/* Browser Chrome */}
                  <div className="bg-muted/50 px-3 py-2 flex items-center gap-2 border-b">
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-destructive/60" />
                      <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
                    </div>
                    <div className="flex-1 mx-4">
                      <div className="bg-muted rounded px-3 py-1 text-xs text-muted-foreground font-mono">
                        {editedPage.publishedUrl || `yoursite.com/${editedPage.urlSlug || 'landing'}`}
                      </div>
                    </div>
                  </div>
                  {/* Page Content Preview */}
                  <ScrollArea className="h-[calc(100vh-380px)]">
                    <DesktopPreview page={editedPage} />
                  </ScrollArea>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Key Text Controls Panel */}
        <aside className="w-full lg:w-80 shrink-0">
          <Card className="sticky top-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Key Text Controls
              </CardTitle>
              <CardDescription className="text-xs">
                Edit the most important copy
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Headline</label>
                <Input
                  value={editedPage.heroHeadline}
                  onChange={(e) => handleFieldChange('heroHeadline', e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Subheadline</label>
                <Textarea
                  value={editedPage.heroSubheadline}
                  onChange={(e) => handleFieldChange('heroSubheadline', e.target.value)}
                  rows={2}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">CTA Button</label>
                <Input
                  value={editedPage.primaryCtaLabel}
                  onChange={(e) => handleFieldChange('primaryCtaLabel', e.target.value)}
                  className="mt-1"
                />
              </div>

              <Separator />

              {/* Section Toggles */}
              {editedPage.sections.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-2 block">
                    Sections
                  </label>
                  <div className="space-y-2">
                    {editedPage.sections.map((section, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                        <div className="flex items-center gap-2">
                          {section.enabled ? (
                            <Eye className="h-3.5 w-3.5 text-primary" />
                          ) : (
                            <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                          <span className="text-xs capitalize">{section.type.replace('_', ' ')}</span>
                        </div>
                        <Switch
                          checked={section.enabled}
                          onCheckedChange={(checked) => handleSectionToggle(idx, checked)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Separator />

              {/* Action Buttons */}
              <div className="space-y-2">
                <Button
                  onClick={handleRebuildWithAI}
                  variant="outline"
                  className="w-full"
                  disabled={rebuilding}
                >
                  {rebuilding ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Rebuild with AI
                </Button>
                <Button onClick={handleSave} className="w-full" disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Save Changes
                </Button>
              </div>

              {/* Auto-wiring Info */}
              {editedPage.autoWired && (
                <div className="p-3 bg-primary/5 border border-primary/20 rounded-md">
                  <div className="flex items-center gap-2 text-xs font-medium mb-1">
                    <Check className="h-3.5 w-3.5 text-primary" />
                    Auto-wired
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Form → CRM, UTMs, tracking enabled
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    );
  }

  // Card Grid View
  return (
    <div className="space-y-6">
      {/* Campaign Filter */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Filter by campaign" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Campaigns</SelectItem>
              {campaigns?.map(campaign => (
                <SelectItem key={campaign.id} value={campaign.id}>
                  {campaign.campaign_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">
            {filteredPages.length} landing page{filteredPages.length !== 1 ? 's' : ''}
          </span>
        </div>
        <Button variant="outline" onClick={() => window.location.href = '/new-campaign'}>
          <Rocket className="h-4 w-4 mr-2" />
          New Campaign
        </Button>
      </div>

      {/* Card Grid */}
      {filteredPages.length === 0 ? (
        <Card className="p-8 text-center">
          <Layout className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No landing pages for this campaign yet.</p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredPages.map(page => (
            <Card
              key={page.id}
              className="cursor-pointer hover:border-primary/50 transition-colors group"
              onClick={() => handleSelectPage(page)}
            >
              {/* Mini Preview */}
              <div className="aspect-[16/10] bg-muted/50 border-b overflow-hidden">
                <div className="scale-[0.35] origin-top-left w-[285%] h-[285%] pointer-events-none">
                  <MiniPreview page={page} />
                </div>
              </div>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                      {page.internalName}
                    </h3>
                    {page.campaignName && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {page.campaignName}
                      </p>
                    )}
                  </div>
                  <Badge variant={page.status === 'published' ? 'default' : 'secondary'} className="shrink-0">
                    {page.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <Monitor className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground capitalize">
                    {page.templateType.replace('_', ' ')}
                  </span>
                  {page.autoWired && (
                    <>
                      <span className="text-muted-foreground">•</span>
                      <Check className="h-3.5 w-3.5 text-primary" />
                      <span className="text-xs text-muted-foreground">Auto-wired</span>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// Mini preview for cards
function MiniPreview({ page }: { page: ParsedLandingPage }) {
  return (
    <div className="p-6 bg-background">
      <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg p-6 space-y-4">
        <h1 className="text-2xl font-bold leading-tight">{page.heroHeadline || 'Headline'}</h1>
        <p className="text-muted-foreground">{page.heroSubheadline || 'Subheadline text'}</p>
        <Button size="sm">{page.primaryCtaLabel || 'Get Started'}</Button>
      </div>
    </div>
  );
}

// Desktop preview for editor
function DesktopPreview({ page }: { page: ParsedLandingPage }) {
  return (
    <div className="p-6 space-y-8">
      {/* Hero */}
      <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl p-8 space-y-4">
        <h1 className="text-2xl font-bold leading-tight">{page.heroHeadline}</h1>
        <p className="text-muted-foreground">{page.heroSubheadline}</p>
        {page.heroSupportingPoints.length > 0 && (
          <ul className="space-y-2 pt-2">
            {page.heroSupportingPoints.map((point, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="text-primary">✓</span>
                {point}
              </li>
            ))}
          </ul>
        )}
        <Button className="mt-2">{page.primaryCtaLabel}</Button>
      </div>

      {/* Enabled Sections */}
      {page.sections
        .filter(s => s.enabled)
        .map((section, idx) => (
          <div key={idx} className="p-6 bg-muted/30 rounded-xl space-y-3">
            <Badge variant="outline" className="text-xs capitalize">
              {section.type.replace('_', ' ')}
            </Badge>
            <h3 className="font-semibold">{section.heading}</h3>
            {section.body && (
              <p className="text-muted-foreground text-sm">{section.body}</p>
            )}
            {section.bullets?.length > 0 && (
              <ul className="space-y-1.5">
                {section.bullets.map((b, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-muted-foreground">•</span>
                    {b}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}

      {/* Form Preview */}
      {page.primaryCtaType === 'form' && page.formFields.length > 0 && (
        <div className="p-6 bg-muted/50 rounded-xl space-y-4">
          <h4 className="font-semibold">Get Started</h4>
          {page.formFields.map((field, idx) => (
            <div key={idx}>
              <label className="text-sm text-muted-foreground">
                {field.label} {field.required && <span className="text-destructive">*</span>}
              </label>
              <Input type={field.type} placeholder={field.label} className="mt-1" disabled />
            </div>
          ))}
          <Button className="w-full" disabled>{page.primaryCtaLabel}</Button>
        </div>
      )}
    </div>
  );
}

export default LandingPagesTab;
