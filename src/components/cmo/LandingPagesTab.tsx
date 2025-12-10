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
  ChevronRight,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface LandingPageData {
  id: string;
  title: string;
  campaign_id: string | null;
  campaign_name?: string;
  status: string;
  created_at: string;
  variant?: {
    id: string;
    headline: string;
    subject_line: string;
    body_content: string;
    cta_text: string;
    metadata: any;
  };
}

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

function LandingPagesTab() {
  const { tenantId, workspaceId, isLoading: contextLoading } = useCMOContext();
  const queryClient = useQueryClient();
  const [selectedPage, setSelectedPage] = useState<ParsedLandingPage | null>(null);
  const [editedPage, setEditedPage] = useState<ParsedLandingPage | null>(null);
  const [saving, setSaving] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);

  // Fetch agent-created landing pages
  const { data: landingPages, isLoading } = useQuery({
    queryKey: ['landing-pages', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      
      // Fetch landing page assets with their variants
      const { data: assets, error } = await supabase
        .from('cmo_content_assets')
        .select(`
          id,
          title,
          campaign_id,
          status,
          created_at,
          key_message,
          cta,
          supporting_points
        `)
        .eq('tenant_id', tenantId)
        .eq('content_type', 'landing_page')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch variants for each asset
      const assetIds = assets?.map(a => a.id) || [];
      const { data: variants } = await supabase
        .from('cmo_content_variants')
        .select('*')
        .in('asset_id', assetIds);

      // Fetch campaign names
      const campaignIds = [...new Set(assets?.filter(a => a.campaign_id).map(a => a.campaign_id))] as string[];
      const { data: campaigns } = await supabase
        .from('cmo_campaigns')
        .select('id, campaign_name')
        .in('id', campaignIds);

      const campaignMap = new Map(campaigns?.map(c => [c.id, c.campaign_name]));

      // Parse landing pages
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

  // Select first page by default
  useEffect(() => {
    if (landingPages?.length && !selectedPage) {
      setSelectedPage(landingPages[0]);
      setEditedPage(landingPages[0]);
    }
  }, [landingPages, selectedPage]);

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

  const handleSectionChange = (idx: number, field: string, value: string) => {
    if (!editedPage) return;
    const sections = [...editedPage.sections];
    sections[idx] = { ...sections[idx], [field]: value };
    setEditedPage({ ...editedPage, sections });
  };

  const handleSave = async () => {
    if (!editedPage || !tenantId) return;
    setSaving(true);

    try {
      // Update asset
      await supabase
        .from('cmo_content_assets')
        .update({
          title: editedPage.internalName,
          key_message: editedPage.heroHeadline,
          cta: editedPage.primaryCtaLabel,
          supporting_points: editedPage.heroSupportingPoints,
        })
        .eq('id', editedPage.assetId);

      // Update variant if exists
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

      // Update editedPage with AI-enhanced content
      if (data) {
        setEditedPage({
          ...editedPage,
          heroHeadline: data.heroHeadline || editedPage.heroHeadline,
          heroSubheadline: data.heroSubheadline || editedPage.heroSubheadline,
          heroSupportingPoints: data.heroSupportingPoints || editedPage.heroSupportingPoints,
          sections: data.sections || editedPage.sections,
          primaryCtaLabel: data.primaryCtaLabel || editedPage.primaryCtaLabel,
        });
        toast.success('AI rebuilt the landing page based on your brand profile');
      }
    } catch (error) {
      console.error('Rebuild error:', error);
      toast.error('Failed to rebuild with AI');
    } finally {
      setRebuilding(false);
    }
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
            Landing pages are automatically created when you build campaigns with Autopilot.
            Create your first campaign to get started.
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

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full">
      {/* Sidebar - Landing Pages List */}
      <aside className="w-full lg:w-72 shrink-0 space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Layout className="h-4 w-4" />
              Your Landing Pages
            </CardTitle>
            <CardDescription className="text-xs">
              Created by AI Campaign Builder
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[400px]">
              <div className="p-2 space-y-1">
                {landingPages.map((page) => (
                  <button
                    key={page.id}
                    onClick={() => handleSelectPage(page)}
                    className={`w-full text-left p-3 rounded-md transition-colors ${
                      selectedPage?.id === page.id
                        ? "bg-primary/10 border border-primary/20"
                        : "hover:bg-muted"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm truncate">
                        {page.internalName}
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge
                        variant={page.status === 'published' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {page.status}
                      </Badge>
                      {page.autoWired && (
                        <Badge variant="outline" className="text-xs">
                          <Check className="h-3 w-3 mr-1" />
                          Auto-wired
                        </Badge>
                      )}
                    </div>
                    {page.campaignName && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        Campaign: {page.campaignName}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </aside>

      {/* Editor Panel */}
      {editedPage && (
        <Card className="flex-1">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">{editedPage.internalName}</CardTitle>
              <CardDescription>
                Edit key content • Toggle sections • Rebuild with AI
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleRebuildWithAI}
                variant="outline"
                disabled={rebuilding}
              >
                {rebuilding ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Rebuild with AI
              </Button>
              <Button onClick={handleSave} variant="secondary" disabled={saving}>
                Save Changes
              </Button>
              <Button onClick={handlePublish} disabled={saving}>
                <Globe className="h-4 w-4 mr-2" />
                Publish
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[calc(100vh-350px)]">
              <div className="space-y-6 pr-4">
                {/* Hero Section */}
                <div className="space-y-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Hero Section
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Headline
                      </label>
                      <Input
                        value={editedPage.heroHeadline}
                        onChange={(e) => handleFieldChange('heroHeadline', e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Subheadline
                      </label>
                      <Textarea
                        value={editedPage.heroSubheadline}
                        onChange={(e) => handleFieldChange('heroSubheadline', e.target.value)}
                        rows={2}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        CTA Button Text
                      </label>
                      <Input
                        value={editedPage.primaryCtaLabel}
                        onChange={(e) => handleFieldChange('primaryCtaLabel', e.target.value)}
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Sections with Toggles */}
                <div className="space-y-4">
                  <h3 className="font-semibold">Page Sections</h3>
                  {editedPage.sections.map((section, idx) => (
                    <Card key={idx} className={!section.enabled ? "opacity-50" : ""}>
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            {section.enabled ? (
                              <Eye className="h-4 w-4 text-primary" />
                            ) : (
                              <EyeOff className="h-4 w-4 text-muted-foreground" />
                            )}
                            <Badge variant="outline">{section.type}</Badge>
                          </div>
                          <Switch
                            checked={section.enabled}
                            onCheckedChange={(checked) => handleSectionToggle(idx, checked)}
                          />
                        </div>
                        <div className="space-y-3">
                          <Input
                            value={section.heading}
                            onChange={(e) => handleSectionChange(idx, 'heading', e.target.value)}
                            placeholder="Section heading"
                            disabled={!section.enabled}
                          />
                          <Textarea
                            value={section.body}
                            onChange={(e) => handleSectionChange(idx, 'body', e.target.value)}
                            placeholder="Section content"
                            rows={2}
                            disabled={!section.enabled}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <Separator />

                {/* Auto-wiring Info */}
                {editedPage.autoWired && (
                  <Card className="bg-primary/5 border-primary/20">
                    <CardContent className="pt-4">
                      <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                        <Check className="h-4 w-4 text-primary" />
                        Automatic Integrations
                      </h4>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        <li>• Form submissions → CRM lead capture</li>
                        <li>• UTM parameters auto-injected</li>
                        <li>• Campaign tracking enabled</li>
                        <li>• Automation triggers configured</li>
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Live Preview */}
      {editedPage && (
        <Card className="w-full lg:w-96 shrink-0">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Live Preview</CardTitle>
              {editedPage.status === 'published' && editedPage.publishedUrl && (
                <a
                  href={editedPage.publishedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  View Live
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[calc(100vh-350px)]">
              <LandingPreview page={editedPage} />
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function LandingPreview({ page }: { page: ParsedLandingPage }) {
  return (
    <div className="p-4 space-y-6 text-sm">
      {/* Hero */}
      <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg p-4 space-y-3">
        <h1 className="text-lg font-bold leading-tight">{page.heroHeadline}</h1>
        <p className="text-muted-foreground text-sm">{page.heroSubheadline}</p>
        {page.heroSupportingPoints.length > 0 && (
          <ul className="space-y-1">
            {page.heroSupportingPoints.map((p, i) => (
              <li key={i} className="flex items-start gap-2 text-xs">
                <span className="text-primary">✓</span>
                {p}
              </li>
            ))}
          </ul>
        )}
        <Button size="sm" className="w-full">
          {page.primaryCtaLabel}
        </Button>
      </div>

      {/* Enabled Sections */}
      {page.sections
        .filter(s => s.enabled)
        .map((section, idx) => (
          <div key={idx} className="space-y-2 p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">{section.type}</Badge>
            </div>
            <h3 className="font-semibold text-sm">{section.heading}</h3>
            {section.body && (
              <p className="text-muted-foreground text-xs">{section.body}</p>
            )}
            {section.bullets?.length > 0 && (
              <ul className="space-y-1">
                {section.bullets.map((b, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
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
        <div className="p-4 bg-muted/50 rounded-lg space-y-3">
          <h4 className="font-semibold text-sm">Lead Capture Form</h4>
          {page.formFields.map((field, idx) => (
            <div key={idx}>
              <label className="text-xs text-muted-foreground">
                {field.label} {field.required && '*'}
              </label>
              <Input
                type={field.type}
                placeholder={field.label}
                className="mt-1"
                disabled
              />
            </div>
          ))}
          <Button size="sm" className="w-full" disabled>
            {page.primaryCtaLabel}
          </Button>
        </div>
      )}
    </div>
  );
}

export default LandingPagesTab;
