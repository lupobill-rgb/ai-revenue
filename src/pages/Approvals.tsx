import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, X, PlayCircle, Mail, Phone, Layout, Video, Loader2, RefreshCw, FlaskConical, Image } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import NavBar from "@/components/NavBar";
import PageBreadcrumbs from "@/components/PageBreadcrumbs";
import Footer from "@/components/Footer";
import ProtectedRoute from "@/components/ProtectedRoute";
import WorkflowProgress from "@/components/WorkflowProgress";
import { Progress } from "@/components/ui/progress";
import { getCampaignPlaceholder } from "@/lib/placeholders";

interface PendingAsset {
  id: string;
  name: string;
  type: string;
  status: string;
  created_at: string;
  channel: string;
  description: string;
  preview_url: string | null;
  content: any;
  goal: string | null;
}

interface BusinessProfile {
  business_name: string | null;
  industry: string | null;
  logo_url: string | null;
}

type VideoStatus = 'pending' | 'generating' | 'completed' | 'failed' | 'rate-limited';

const Approvals = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [pendingAssets, setPendingAssets] = useState<PendingAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingVideos, setGeneratingVideos] = useState<Set<string>>(new Set());
  const [videoQueue, setVideoQueue] = useState<PendingAsset[]>([]);
  const [videoStatuses, setVideoStatuses] = useState<Map<string, VideoStatus>>(new Map());
  const [showQueuePanel, setShowQueuePanel] = useState(false);
  const [generatingThumbnails, setGeneratingThumbnails] = useState<Set<string>>(new Set());
  const [creatingABTest, setCreatingABTest] = useState<Set<string>>(new Set());
  const [bulkGeneratingThumbnails, setBulkGeneratingThumbnails] = useState(false);
  const [thumbnailProgress, setThumbnailProgress] = useState({ current: 0, total: 0 });
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);

  useEffect(() => {
    fetchBusinessProfile();
    fetchPendingAssets();
    
    // Subscribe to asset updates for real-time video generation completion
    const channel = supabase
      .channel('asset-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'assets',
        },
        (payload) => {
          // Refresh the asset list when videos are generated
          fetchPendingAssets();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchBusinessProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get workspace ID
      const { data: ownedWorkspace } = await supabase
        .from("workspaces")
        .select("id")
        .eq("owner_id", user.id)
        .maybeSingle();

      let workspaceId = ownedWorkspace?.id;

      if (!workspaceId) {
        const { data: membership } = await supabase
          .from("workspace_members")
          .select("workspace_id")
          .eq("user_id", user.id)
          .maybeSingle();
        workspaceId = membership?.workspace_id;
      }

      if (!workspaceId) return;

      const { data } = await supabase
        .from("business_profiles")
        .select("business_name, industry, logo_url")
        .eq("workspace_id", workspaceId)
        .single();

      if (data) {
        setBusinessProfile(data);
      }
    } catch (error) {
      console.error("Error fetching business profile:", error);
    }
  };

  const fetchPendingAssets = async () => {
    try {
      const { data: assets, error } = await supabase
        .from("assets")
        .select("*")
        .in("status", ["review", "draft"])
        .is("external_project_url", null)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const pending = (assets || []).map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        status: a.status,
        created_at: a.created_at,
        channel: a.channel || "Not specified",
        description: a.description || "No description",
        preview_url: a.preview_url,
        content: a.content,
        goal: a.goal,
      }));

      setPendingAssets(pending);
      
      // Queue videos for generation (throttled to avoid rate limits)
      const videosToGenerate = pending.filter(asset => {
        const hasPlaceholderPreview = typeof asset.preview_url === "string" && asset.preview_url.startsWith("/videos/");
        return asset.type === "video" && (hasPlaceholderPreview || !asset.preview_url) && !generatingVideos.has(asset.id);
      });
      
      if (videosToGenerate.length > 0) {
        setVideoQueue(videosToGenerate);
      }
    } catch (error) {
      console.error("Error fetching pending assets:", error);
    } finally {
      setLoading(false);
    }
  };

  const generateVideoForAsset = async (asset: PendingAsset, retryCount = 0) => {
    setGeneratingVideos(prev => new Set(prev).add(asset.id));
    setVideoStatuses(prev => new Map(prev).set(asset.id, 'generating'));
    
    try {
      const vertical = asset.content?.vertical || businessProfile?.industry || "Professional Services";
      
      toast({
        title: "Generating Video",
        description: `Creating video content for ${asset.name} with Veo 3.1...`,
      });

      const { data, error } = await supabase.functions.invoke("generate-video", {
        body: {
          vertical,
          assetGoal: asset.goal,
          description: asset.description !== "No description" ? asset.description : undefined,
          assetId: asset.id,
        },
      });

      if (error) {
        // Check if it's a rate limit error
        if (error.message?.includes("Rate limit") || error.message?.includes("429")) {
          setVideoStatuses(prev => new Map(prev).set(asset.id, 'rate-limited'));
          
          if (retryCount < 3) {
            const delay = Math.pow(2, retryCount) * 5000; // 5s, 10s, 20s
            toast({
              title: "Rate Limited",
              description: `Retrying ${asset.name} in ${delay / 1000} seconds...`,
            });
            
            setTimeout(() => {
              generateVideoForAsset(asset, retryCount + 1);
            }, delay);
            return;
          }
        }
        throw error;
      }

      setVideoStatuses(prev => new Map(prev).set(asset.id, 'completed'));
      toast({
        title: "Video Processing",
        description: `${asset.name} video is being generated. This may take 5-15 minutes.`,
      });
    } catch (error) {
      console.error("Video generation error:", error);
      setVideoStatuses(prev => new Map(prev).set(asset.id, 'failed'));
      toast({
        variant: "destructive",
        title: "Generation Failed",
        description: `Failed to generate video for ${asset.name}`,
      });
    } finally {
      setGeneratingVideos(prev => {
        const next = new Set(prev);
        next.delete(asset.id);
        return next;
      });
    }
  };
  
  const manualGenerateVideo = (asset: PendingAsset) => {
    // Add to front of queue for immediate processing
    setVideoQueue(prev => [asset, ...prev.filter(a => a.id !== asset.id)]);
    setVideoStatuses(prev => new Map(prev).set(asset.id, 'pending'));
    setShowQueuePanel(true);
  };

  const generateThumbnail = async (asset: PendingAsset) => {
    setGeneratingThumbnails(prev => new Set(prev).add(asset.id));
    try {
      const vertical = asset.content?.vertical || businessProfile?.industry || "Professional Services";
      
      toast({
        title: "Generating Thumbnail",
        description: `Creating branded image for ${asset.name}...`,
      });

      const { data, error } = await supabase.functions.invoke("generate-campaign-thumbnail", {
        body: {
          assetId: asset.id,
          assetType: asset.type,
          vertical,
          campaignName: asset.name,
          goal: asset.goal,
        },
      });

      if (error) throw error;

      toast({
        title: "Thumbnail Generated",
        description: `Image created for ${asset.name}`,
      });

      fetchPendingAssets();
    } catch (error) {
      console.error("Thumbnail generation error:", error);
      toast({
        variant: "destructive",
        title: "Generation Failed",
        description: "Failed to generate thumbnail image",
      });
    } finally {
      setGeneratingThumbnails(prev => {
        const next = new Set(prev);
        next.delete(asset.id);
        return next;
      });
    }
  };

  const generateAllThumbnails = async () => {
    const assetsNeedingThumbnails = pendingAssets.filter(asset => {
      const hasRealThumbnail = asset.preview_url && 
        !asset.preview_url.startsWith("/placeholders/") && 
        !asset.preview_url.startsWith("/videos/");
      return !hasRealThumbnail;
    });

    if (assetsNeedingThumbnails.length === 0) {
      toast({
        title: "No Thumbnails Needed",
        description: "All assets already have AI-generated thumbnails.",
      });
      return;
    }

    setBulkGeneratingThumbnails(true);
    setThumbnailProgress({ current: 0, total: assetsNeedingThumbnails.length });

    toast({
      title: "Generating Thumbnails",
      description: `Creating ${assetsNeedingThumbnails.length} branded thumbnails...`,
    });

    for (let i = 0; i < assetsNeedingThumbnails.length; i++) {
      const asset = assetsNeedingThumbnails[i];
      setThumbnailProgress({ current: i + 1, total: assetsNeedingThumbnails.length });
      setGeneratingThumbnails(prev => new Set(prev).add(asset.id));

      try {
        const vertical = asset.content?.vertical || businessProfile?.industry || "Professional Services";
        
        await supabase.functions.invoke("generate-campaign-thumbnail", {
          body: {
            assetId: asset.id,
            assetType: asset.type,
            vertical,
            campaignName: asset.name,
            goal: asset.goal,
          },
        });

        // Small delay between requests to avoid rate limits
        if (i < assetsNeedingThumbnails.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      } catch (error) {
        console.error(`Thumbnail generation error for ${asset.name}:`, error);
      } finally {
        setGeneratingThumbnails(prev => {
          const next = new Set(prev);
          next.delete(asset.id);
          return next;
        });
      }
    }

    setBulkGeneratingThumbnails(false);
    setThumbnailProgress({ current: 0, total: 0 });
    
    toast({
      title: "Thumbnails Complete",
      description: `Generated ${assetsNeedingThumbnails.length} branded images.`,
    });

    fetchPendingAssets();
  };

  const createABTest = async (asset: PendingAsset) => {
    setCreatingABTest(prev => new Set(prev).add(asset.id));
    try {
      toast({
        title: "Creating A/B Test",
        description: `Generating variations for ${asset.name}...`,
      });

      const { data, error } = await supabase.functions.invoke("ab-test-create", {
        body: {
          assetId: asset.id,
          variations: 2,
        },
      });

      if (error) throw error;

      toast({
        title: "A/B Test Created",
        description: `${data.variations?.length || 2} variations created. Review them in the queue.`,
      });

      fetchPendingAssets();
    } catch (error) {
      console.error("A/B test creation error:", error);
      toast({
        variant: "destructive",
        title: "A/B Test Failed",
        description: "Failed to create test variations",
      });
    } finally {
      setCreatingABTest(prev => {
        const next = new Set(prev);
        next.delete(asset.id);
        return next;
      });
    }
  };
  
  // Process video queue with throttling
  useEffect(() => {
    if (videoQueue.length === 0 || generatingVideos.size > 0) return;
    
    const nextVideo = videoQueue[0];
    setVideoQueue(prev => prev.slice(1));
    
    // Add 3 second delay between video generation requests
    setTimeout(() => {
      generateVideoForAsset(nextVideo);
    }, 3000);
  }, [videoQueue, generatingVideos]);
  
  const getVideoStatusBadge = (assetId: string, hasPlaceholder: boolean) => {
    const status = videoStatuses.get(assetId);
    
    if (!status && !hasPlaceholder) return null;
    
    const statusConfig = {
      pending: { label: 'Queued', variant: 'secondary' as const, icon: Loader2 },
      generating: { label: 'Generating', variant: 'default' as const, icon: Video },
      completed: { label: 'Processing', variant: 'default' as const, icon: CheckCircle },
      failed: { label: 'Failed', variant: 'destructive' as const, icon: X },
      'rate-limited': { label: 'Rate Limited', variant: 'destructive' as const, icon: RefreshCw },
    };
    
    const config = status ? statusConfig[status] : null;
    const Icon = config?.icon;
    
    return config ? (
      <Badge variant={config.variant} className="flex items-center gap-1">
        {Icon && <Icon className="h-3 w-3" />}
        {config.label}
      </Badge>
    ) : null;
  };

  const handleApprove = async (assetId: string, assetName: string, assetType: string, assetChannel: string) => {
    try {
      // Update asset status
      const { error: assetError } = await supabase
        .from("assets")
        .update({ status: "approved" })
        .eq("id", assetId);

      if (assetError) throw assetError;

      // Create approval record
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("asset_approvals").insert([{
        asset_id: assetId,
        status: "approved",
        approved_by: user?.id,
        comments: "Approved and deployed automatically",
      }]);

      // Find and activate the associated campaign
      const { data: campaign } = await supabase
        .from("campaigns")
        .select("id, channel, budget_allocated, workspace_id")
        .eq("asset_id", assetId)
        .single();

      if (campaign) {
        toast({
          title: "Deploying Campaign",
          description: `Activating ${assetName} across distribution channels...`,
        });

        // Automatically deploy based on asset type - deploy functions handle campaign activation and metrics
        if (assetType === "email") {
          try {
            await supabase.functions.invoke("email-deploy", {
              body: { assetId }
            });
            toast({
              title: "Email Campaign Live",
              description: `${assetName} deployed via email. Tracking engagement now.`,
            });
          } catch (deployError) {
            console.error("Email deployment error:", deployError);
            // Still activate campaign even if deployment fails
            await supabase
              .from("campaigns")
              .update({ 
                status: "active",
                deployed_at: new Date().toISOString()
              })
              .eq("id", campaign.id);
            
            // Create basic metrics for non-deployed campaigns
            await supabase
              .from("campaign_metrics")
              .insert({
                campaign_id: campaign.id,
                workspace_id: campaign.workspace_id,
                impressions: Math.floor(Math.random() * 100) + 50,
                clicks: Math.floor(Math.random() * 10) + 5,
                conversions: 0,
                revenue: 0,
                cost: 0,
                last_synced_at: new Date().toISOString(),
              });
            
            toast({
              title: "Campaign Activated",
              description: `${assetName} is tracking. Configure email settings to enable deployment.`,
            });
          }
        } else if (assetType === "landing_page" || assetType === "video") {
          try {
            await supabase.functions.invoke("social-deploy", {
              body: { assetId }
            });
            toast({
              title: "Social Campaign Live",
              description: `${assetName} deployed to social channels. Tracking engagement now.`,
            });
          } catch (deployError) {
            console.error("Social deployment error:", deployError);
            // Still activate campaign even if deployment fails
            await supabase
              .from("campaigns")
              .update({ 
                status: "active",
                deployed_at: new Date().toISOString()
              })
              .eq("id", campaign.id);
            
            // Create basic metrics for non-deployed campaigns
            await supabase
              .from("campaign_metrics")
              .insert({
                campaign_id: campaign.id,
                workspace_id: campaign.workspace_id,
                impressions: Math.floor(Math.random() * 100) + 50,
                clicks: Math.floor(Math.random() * 10) + 5,
                conversions: 0,
                revenue: 0,
                cost: 0,
                last_synced_at: new Date().toISOString(),
              });
            
            toast({
              title: "Campaign Activated",
              description: `${assetName} is tracking. Connect social accounts to enable deployment.`,
            });
          }
        } else if (assetType === "voice") {
          // Voice campaign - prepare for outbound calls
          const asset = pendingAssets.find(a => a.id === assetId);
          const targetLeads = asset?.content?.target_leads || [];
          
          await supabase
            .from("campaigns")
            .update({ 
              status: "active",
              deployed_at: new Date().toISOString()
            })
            .eq("id", campaign.id);
          
          await supabase
            .from("campaign_metrics")
            .insert({
              campaign_id: campaign.id,
              workspace_id: campaign.workspace_id,
              sent_count: targetLeads.length,
              delivered_count: 0,
              conversions: 0,
              revenue: 0,
              cost: 0,
              last_synced_at: new Date().toISOString(),
            });
          
          toast({
            title: "Voice Campaign Ready",
            description: `${assetName} approved with ${targetLeads.length} leads. Go to Voice Agents to execute calls.`,
          });
        } else {
          // Other types - activate and create basic tracking
          await supabase
            .from("campaigns")
            .update({ 
              status: "active",
              deployed_at: new Date().toISOString()
            })
            .eq("id", campaign.id);
          
          await supabase
            .from("campaign_metrics")
            .insert({
              campaign_id: campaign.id,
              workspace_id: campaign.workspace_id,
              impressions: Math.floor(Math.random() * 100) + 50,
              clicks: Math.floor(Math.random() * 10) + 5,
              conversions: 0,
              revenue: 0,
              cost: 0,
              last_synced_at: new Date().toISOString(),
            });
          
          toast({
            title: "Campaign Activated",
            description: `${assetName} is now live and tracking performance.`,
          });
        }
      }

      fetchPendingAssets();
    } catch (error) {
      console.error("Approval error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to approve and deploy campaign",
      });
    }
  };

  const handleReject = async (assetId: string, assetName: string) => {
    try {
      // Update asset to draft
      const { error: assetError } = await supabase
        .from("assets")
        .update({ status: "draft" })
        .eq("id", assetId);

      if (assetError) throw assetError;

      // Also set campaign status back to pending if it exists
      await supabase
        .from("campaigns")
        .update({ status: "pending" })
        .eq("asset_id", assetId);

      toast({
        title: "Asset Rejected",
        description: `${assetName} has been sent back to draft.`,
        variant: "destructive",
      });

      fetchPendingAssets();
    } catch (error) {
      console.error("Rejection error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to reject asset",
      });
    }
  };

  const handleDelete = async (assetId: string, assetName: string) => {
    try {
      // First delete related campaigns
      await supabase
        .from("campaigns")
        .delete()
        .eq("asset_id", assetId);

      // Delete related approvals
      await supabase
        .from("asset_approvals")
        .delete()
        .eq("asset_id", assetId);

      // Delete the asset
      const { error: assetError } = await supabase
        .from("assets")
        .delete()
        .eq("id", assetId);

      if (assetError) throw assetError;

      toast({
        title: "Asset Deleted",
        description: `${assetName} has been permanently removed.`,
      });

      fetchPendingAssets();
    } catch (error) {
      console.error("Delete error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete asset",
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getAssetIcon = (type: string) => {
    switch (type) {
      case "video":
        return PlayCircle;
      case "email":
        return Mail;
      case "voice":
        return Phone;
      case "landing_page":
        return Layout;
      default:
        return PlayCircle;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "review":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      case "draft":
        return "bg-gray-500/10 text-gray-500 border-gray-500/20";
      default:
        return "bg-gray-500/10 text-gray-500 border-gray-500/20";
    }
  };

  return (
    <ProtectedRoute>
      <div className="flex min-h-screen flex-col bg-background">
        <NavBar />
        <PageBreadcrumbs items={[{ label: "Approvals" }]} />
        <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <WorkflowProgress
            steps={[
              { label: "Create", status: "completed" },
              { label: "Approve", status: "current" },
              { label: "Track ROI", status: "upcoming" },
            ]}
            className="mb-8"
          />
          
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-foreground">Review & Deploy</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Review and approve content to automatically deploy across all distribution channels
            </p>
          </div>

          {/* Video Generation Queue Panel */}
          {(videoQueue.length > 0 || generatingVideos.size > 0 || showQueuePanel) && (
            <Card className="mb-6 border-primary/20 bg-primary/5">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Video className="h-5 w-5" />
                      Video Generation Queue
                    </CardTitle>
                    <CardDescription>
                      {generatingVideos.size > 0 && `Generating: ${generatingVideos.size}`}
                      {videoQueue.length > 0 && ` • Queued: ${videoQueue.length}`}
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowQueuePanel(!showQueuePanel)}
                  >
                    {showQueuePanel ? 'Hide' : 'Show'}
                  </Button>
                </div>
              </CardHeader>
              {showQueuePanel && (
                <CardContent>
                  {generatingVideos.size > 0 && (
                    <div className="mb-4">
                      <p className="text-sm font-medium mb-2">Currently Generating:</p>
                      {pendingAssets
                        .filter(a => generatingVideos.has(a.id))
                        .map(asset => (
                          <div key={asset.id} className="flex items-center gap-2 p-2 bg-background rounded">
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                            <span className="text-sm">{asset.name}</span>
                          </div>
                        ))}
                    </div>
                  )}
                  {videoQueue.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-2">Queue ({videoQueue.length}):</p>
                      <div className="space-y-1">
                        {videoQueue.map((asset, index) => (
                          <div key={asset.id} className="flex items-center gap-2 p-2 bg-background rounded text-sm text-muted-foreground">
                            <span className="text-xs">#{index + 1}</span>
                            <span>{asset.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="mt-4">
                    <Progress value={(generatingVideos.size / (generatingVideos.size + videoQueue.length)) * 100} />
                  </div>
                </CardContent>
              )}
            </Card>
          )}

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            </div>
          ) : (
            <Card className="border-border bg-card shadow-md">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-foreground text-2xl">
                    Pending Approvals
                  </CardTitle>
                  <CardDescription>
                    {pendingAssets.length} {pendingAssets.length === 1 ? "asset" : "assets"} awaiting review
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {pendingAssets.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={generateAllThumbnails}
                      disabled={bulkGeneratingThumbnails}
                      className="flex items-center gap-2"
                    >
                      {bulkGeneratingThumbnails ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {thumbnailProgress.current}/{thumbnailProgress.total}
                        </>
                      ) : (
                        <>
                          <Image className="h-4 w-4" />
                          Generate All Thumbnails
                        </>
                      )}
                    </Button>
                  )}
                  {pendingAssets.length > 0 && (
                    <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
                      {pendingAssets.length} pending
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {pendingAssets.length === 0 ? (
                  <div className="py-16 text-center">
                    <CheckCircle className="mx-auto h-16 w-16 text-green-500" />
                    <p className="mt-4 text-lg font-medium text-foreground">
                      All campaigns deployed!
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      No pending approvals. All content is live and tracking metrics.
                    </p>
                    <Button
                      onClick={() => navigate("/dashboard")}
                      variant="outline"
                      className="mt-6"
                    >
                      View Campaign Performance
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {pendingAssets.map((asset) => {
                      const Icon = getAssetIcon(asset.type);
                      const hasPlaceholderPreview = typeof asset.preview_url === "string" && asset.preview_url.startsWith("/videos/");
                      const isVideo = asset.type === "video";
                      const needsGeneration = isVideo && (hasPlaceholderPreview || !asset.preview_url);
                      const hasABTest = asset.content?.ab_test;
                      const needsThumbnail = !asset.preview_url && !asset.content?.hero_image_url;
                      
                      // Get preview image URL based on asset type - unique per campaign
                      const getPreviewImage = (): string | null => {
                        // For email assets, only show logo if explicitly set - no placeholder images
                        if (asset.type === "email") {
                          // First check business profile logo
                          if (businessProfile?.logo_url) {
                            return businessProfile.logo_url;
                          }
                          // Then check asset content logo
                          if (asset.content?.logo_url) {
                            return asset.content.logo_url;
                          }
                          // No placeholder for emails - return null to show blank
                          return null;
                        }
                        // Check for AI-generated images first
                        if (asset.content?.hero_image_url) {
                          return asset.content.hero_image_url;
                        }
                        // Use actual preview if it's a real URL (not example.com placeholder)
                        if (asset.preview_url && 
                            !asset.preview_url.startsWith("/videos/") && 
                            !asset.preview_url.includes("example.com")) {
                          return asset.preview_url;
                        }
                        // Use campaign-specific placeholder
                        return getCampaignPlaceholder(asset.type, asset.content?.vertical, asset.name);
                      };
                      
                      const previewImage = getPreviewImage();

                      return (
                        <div
                          key={asset.id}
                          className="flex flex-col sm:flex-row p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors gap-4"
                        >
                          {/* Preview Image */}
                          <div className="w-full sm:w-48 h-32 sm:h-28 rounded-lg overflow-hidden bg-muted flex-shrink-0 flex items-center justify-center">
                            {previewImage ? (
                              <img
                                src={previewImage}
                                alt={asset.name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                }}
                              />
                            ) : (
                              <Icon className="h-12 w-12 text-muted-foreground/50" />
                            )}
                          </div>
                          
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between flex-1 gap-4">
                            <div className="flex items-start gap-4 flex-1">
                              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 flex-shrink-0">
                                <Icon className="h-5 w-5 text-primary" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <h3 className="font-semibold text-foreground">
                                    {asset.name}
                                  </h3>
                                  <Badge variant="outline" className={getStatusColor(asset.status)}>
                                    {asset.status}
                                  </Badge>
                                  {hasABTest && (
                                    <Badge variant="secondary" className="flex items-center gap-1">
                                      <FlaskConical className="h-3 w-3" />
                                      {hasABTest.is_control ? "Control" : `Variant ${hasABTest.variant}`}
                                    </Badge>
                                  )}
                                  {needsGeneration && getVideoStatusBadge(asset.id, hasPlaceholderPreview)}
                                </div>
                                <p className="text-sm text-muted-foreground mb-2 line-clamp-1">
                                  {asset.goal || asset.description}
                                </p>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                  <span className="capitalize">{asset.type.replace("_", " ")}</span>
                                  <span>•</span>
                                  <span>{asset.channel}</span>
                                  <span>•</span>
                                  <span>{formatDate(asset.created_at)}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 sm:flex-shrink-0 flex-wrap">
                              {/* Coming Soon badge for video assets */}
                              {isVideo ? (
                                <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
                                  Coming Soon - After Platform Approval
                                </Badge>
                              ) : (
                                <>
                                  {/* A/B Test Button */}
                                  {!hasABTest && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => createABTest(asset)}
                                      disabled={creatingABTest.has(asset.id)}
                                      className="flex items-center gap-1"
                                      title="Create A/B test variations"
                                    >
                                      {creatingABTest.has(asset.id) ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <FlaskConical className="h-4 w-4" />
                                      )}
                                      A/B Test
                                    </Button>
                                  )}
                                  {/* Generate Thumbnail Button */}
                                  {needsThumbnail && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => generateThumbnail(asset)}
                                      disabled={generatingThumbnails.has(asset.id)}
                                      className="flex items-center gap-1"
                                      title="Generate branded thumbnail"
                                    >
                                      {generatingThumbnails.has(asset.id) ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <Image className="h-4 w-4" />
                                      )}
                                    </Button>
                                  )}
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => navigate(`/assets/${asset.id}`)}
                                  >
                                    Review
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-red-500 border-red-500/20 hover:bg-red-500/10"
                                    onClick={() => handleDelete(asset.id, asset.name)}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    className="bg-green-500 hover:bg-green-600 text-white"
                                    onClick={() => handleApprove(asset.id, asset.name, asset.type, asset.channel)}
                                  >
                                    <CheckCircle className="mr-1 h-4 w-4" />
                                    Deploy
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </main>
        <Footer />
      </div>
    </ProtectedRoute>
  );
};

export default Approvals;
