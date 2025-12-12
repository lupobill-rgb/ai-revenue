import { useState, useEffect } from "react";
import { fetchCampaignLandingPages, regenerateLandingPage } from "@/lib/cmo/apiClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { RefreshCw, ExternalLink, Edit2, Check, X, Globe, Eye } from "lucide-react";
import type { LandingPageDraft } from "@/lib/cmo/types";

interface CampaignLandingPagesTabProps {
  campaignId: string;
  tenantId: string;
}

export default function CampaignLandingPagesTab({ campaignId, tenantId }: CampaignLandingPagesTabProps) {
  const [pages, setPages] = useState<LandingPageDraft[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    heroHeadline: string;
    heroSubheadline: string;
    primaryCtaLabel: string;
  } | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);

  useEffect(() => {
    loadPages();
  }, [campaignId, tenantId]);

  const loadPages = async () => {
    setIsLoading(true);
    try {
      const data = await fetchCampaignLandingPages(tenantId, campaignId);
      setPages(data);
    } catch (err) {
      console.error("Error fetching landing pages:", err);
      toast.error("Failed to load landing pages");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (page: LandingPageDraft) => {
    setEditingId(page.id || null);
    setEditForm({
      heroHeadline: page.heroHeadline,
      heroSubheadline: page.heroSubheadline,
      primaryCtaLabel: page.primaryCtaLabel,
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const handleSaveEdit = async (pageId: string) => {
    if (!editForm) return;
    
    setIsRegenerating(true);
    try {
      await regenerateLandingPage(tenantId, pageId, editForm);
      toast.success("Landing page updated");
      setEditingId(null);
      setEditForm(null);
      loadPages();
    } catch (err) {
      console.error("Error updating landing page:", err);
      toast.error("Failed to update landing page");
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleRebuildWithAI = async (pageId: string) => {
    setIsRegenerating(true);
    try {
      await regenerateLandingPage(tenantId, pageId, {});
      toast.success("Landing page rebuilt with AI");
      loadPages();
    } catch (err) {
      console.error("Error rebuilding landing page:", err);
      toast.error("Failed to rebuild landing page");
    } finally {
      setIsRegenerating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-64" />
        ))}
      </div>
    );
  }

  if (pages.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Globe className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-lg font-medium">No landing pages yet</p>
          <p className="text-muted-foreground mt-1">
            Landing pages will be automatically generated when the campaign is built
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {pages.map((page) => {
        const isEditing = editingId === page.id;
        
        return (
          <Card key={page.id} className="overflow-hidden">
            {/* Preview Section */}
            <div className="h-32 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border-b">
              <div className="text-center px-4">
                <p className="font-semibold text-lg line-clamp-2">
                  {isEditing ? editForm?.heroHeadline : page.heroHeadline}
                </p>
              </div>
            </div>
            
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-base">{page.internalName}</CardTitle>
                  <CardDescription className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">
                      {page.templateType}
                    </Badge>
                    <Badge 
                      variant={page.status === "published" ? "default" : "secondary"} 
                      className="text-xs"
                    >
                      {page.status}
                    </Badge>
                  </CardDescription>
                </div>
                {!isEditing && (
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(page)}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {isEditing ? (
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Headline</Label>
                    <Input
                      value={editForm?.heroHeadline || ""}
                      onChange={(e) => setEditForm((prev) => prev ? { ...prev, heroHeadline: e.target.value } : null)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Subheadline</Label>
                    <Input
                      value={editForm?.heroSubheadline || ""}
                      onChange={(e) => setEditForm((prev) => prev ? { ...prev, heroSubheadline: e.target.value } : null)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">CTA Label</Label>
                    <Input
                      value={editForm?.primaryCtaLabel || ""}
                      onChange={(e) => setEditForm((prev) => prev ? { ...prev, primaryCtaLabel: e.target.value } : null)}
                      className="mt-1"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      onClick={() => handleSaveEdit(page.id!)}
                      disabled={isRegenerating}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Save
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={handleCancelEdit}
                      disabled={isRegenerating}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {page.heroSubheadline}
                  </p>
                  
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => handleRebuildWithAI(page.id!)}
                      disabled={isRegenerating}
                    >
                      <RefreshCw className={`h-4 w-4 mr-1 ${isRegenerating ? 'animate-spin' : ''}`} />
                      Rebuild with AI
                    </Button>
                    {page.url && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => window.open(page.url, "_blank")}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Preview
                      </Button>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
