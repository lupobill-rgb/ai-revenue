import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, CheckCircle, Save, Send, Sparkles, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import NavBar from "@/components/NavBar";
import PageBreadcrumbs from "@/components/PageBreadcrumbs";
import Footer from "@/components/Footer";
import ProtectedRoute from "@/components/ProtectedRoute";
import AssetPreview from "@/components/AssetPreview";
import AIAssistant from "@/components/AIAssistant";
import { MultiSegmentSelector } from "@/components/MultiSegmentSelector";
import { z } from "zod";

const assetSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  channel: z.string().max(100).optional(),
  goal: z.string().max(1000).optional(),
  preview_url: z.string().url("Must be a valid URL").max(1000).optional().or(z.literal("")),
  external_id: z.string().max(500).optional(),
});

const AssetDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [asset, setAsset] = useState<any>(null);
  const [segments, setSegments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [generatingVideo, setGeneratingVideo] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  // Form fields
  const [name, setName] = useState("");
  const [segmentIds, setSegmentIds] = useState<string[]>([]);
  const [channel, setChannel] = useState("");
  const [goal, setGoal] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [externalId, setExternalId] = useState("");
  const [status, setStatus] = useState<"draft" | "review" | "approved" | "live">("draft");
  const [content, setContent] = useState<any>({});
  const [externalProjectUrl, setExternalProjectUrl] = useState("");
  const [customDomain, setCustomDomain] = useState("");
  const [deploymentStatus, setDeploymentStatus] = useState("staging");

  useEffect(() => {
    if (id) {
      fetchAsset();
      fetchSegments();
    }
  }, [id]);

  // Auto-refresh preview when user returns to the tab (for external projects)
  useEffect(() => {
    if (!externalProjectUrl) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Refresh the preview by re-fetching asset data
        fetchAsset();
        toast({
          title: "Preview Refreshed",
          description: "Showing latest version of your website",
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [externalProjectUrl]);

  // Set up Realtime listener for video generation updates
  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel('asset-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'assets',
          filter: `id=eq.${id}`
        },
        (payload) => {
          console.log('Asset updated via Realtime:', payload);
          const newData = payload.new as any;
          
          // Update preview URL if it changed
          if (newData.preview_url && newData.preview_url !== previewUrl) {
            setPreviewUrl(newData.preview_url);
            
            // Show toast if video just completed (URL changed from image to video)
            if (newData.preview_url.includes('.mp4') && !previewUrl.includes('.mp4')) {
              toast({
                title: "Video Ready! 🎉",
                description: "AI-generated video is now available for preview",
                duration: 5000,
              });
            }
          }
          
          // Update other fields if needed
          if (newData.external_id) setExternalId(newData.external_id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, previewUrl]); // Re-subscribe if id or previewUrl changes

  const fetchAsset = async () => {
    try {
      // Fetch asset directly from database
      const { data, error } = await supabase
        .from("assets")
        .select("*, segments(id, name)")
        .eq("id", id)
        .maybeSingle();

      if (error) {
        console.error("Database error:", error);
        throw error;
      }

      if (!data) {
        toast({
          variant: "destructive",
          title: "Asset Not Found",
          description: "This asset does not exist or you don't have permission to view it.",
        });
        setLoading(false);
        return;
      }

      setAsset(data);
      setName(data.name);
      setSegmentIds(data.segment_ids || (data.segment_id ? [data.segment_id] : []));
      setChannel(data.channel || "");
      setGoal(data.goal || "");
      setPreviewUrl(data.preview_url || "");
      setExternalId(data.external_id || "");
      setStatus(data.status);
      setContent(data.content || {});
      setExternalProjectUrl(data.external_project_url || "");
      setCustomDomain(data.custom_domain || "");
      setDeploymentStatus(data.deployment_status || "staging");
      setLastRefreshedAt(new Date());
    } catch (error: any) {
      console.error("Error fetching asset:", error);
      toast({
        variant: "destructive",
        title: "Error Loading Asset",
        description: error.message || "Failed to load asset. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchSegments = async () => {
    const { data } = await supabase.from("segments").select("*").order("name");
    setSegments(data || []);
  };

  const handleSave = async () => {
    setErrors({});

    const result = assetSchema.safeParse({
      name,
      channel,
      goal,
      preview_url: previewUrl,
      external_id: externalId,
    });

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("assets")
        .update({
          name: result.data.name,
          channel: result.data.channel,
          goal: result.data.goal,
          preview_url: result.data.preview_url || null,
          external_id: result.data.external_id,
          segment_ids: segmentIds.length > 0 ? segmentIds : [],
          segment_id: segmentIds.length > 0 ? segmentIds[0] : null,
          status,
          content,
          external_project_url: externalProjectUrl || null,
          custom_domain: customDomain || null,
          deployment_status: deploymentStatus,
        })
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Changes saved",
        description: "Asset updated successfully",
      });
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 3000);
      fetchAsset();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save changes",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndPublish = async () => {
    setErrors({});

    const result = assetSchema.safeParse({
      name,
      channel,
      goal,
      preview_url: previewUrl,
      external_id: externalId,
    });

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("assets")
        .update({
          name: result.data.name,
          channel: result.data.channel,
          goal: result.data.goal,
          preview_url: result.data.preview_url || null,
          external_id: result.data.external_id,
          segment_ids: segmentIds.length > 0 ? segmentIds : [],
          segment_id: segmentIds.length > 0 ? segmentIds[0] : null,
          status,
          content,
          external_project_url: externalProjectUrl || null,
          custom_domain: customDomain || null,
          deployment_status: 'live',
        })
        .eq("id", id);

      if (error) throw error;

      setDeploymentStatus('live');
      toast({
        title: "Published to Live",
        description: "Content saved and published successfully",
      });
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 3000);
      fetchAsset();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to publish changes",
      });
    } finally {
      setSaving(false);
    }
  }

  const handleApprove = async () => {
    try {
      const { error } = await supabase
        .from("assets")
        .update({ status: 'approved' })
        .eq("id", id);

      if (error) throw error;

      const { data: { user } } = await supabase.auth.getUser();
      await supabase
        .from("asset_approvals")
        .insert([{
          asset_id: id,
          status: 'approved',
          approved_by: user?.id,
          comments: 'Approved via Asset Detail page'
        }]);

      toast({
        title: "Asset approved",
        description: "This asset has been approved successfully",
      });
      
      setShowApproveDialog(false);
      fetchAsset();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to approve asset",
      });
    }
  };

  const handleDeployEmail = async () => {
    setDeploying(true);
    try {
      const { data, error } = await supabase.functions.invoke('email-deploy', {
        body: { assetId: id }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: `Email campaign deployed! ${data.sentCount} emails sent.`,
      });

      // Refresh asset to show updated status
      await fetchAsset();
    } catch (error) {
      console.error("Error deploying email:", error);
      toast({
        variant: "destructive",
        title: "Deployment Failed",
        description: error instanceof Error ? error.message : "Failed to deploy email campaign",
      });
    } finally {
      setDeploying(false);
    }
  };

  const handleDeploySocial = async () => {
    setDeploying(true);
    try {
      const { data, error } = await supabase.functions.invoke('social-deploy', {
        body: { assetId: id }
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "Success",
          description: data.message,
        });

        // Show detailed results
        if (data.results && data.results.length > 0) {
          const failedPlatforms = data.results.filter((r: any) => !r.success);
          if (failedPlatforms.length > 0) {
            console.warn('Failed platforms:', failedPlatforms);
          }
        }

        // Refresh asset to show updated status
        await fetchAsset();
      } else {
        throw new Error(data.error || 'Deployment failed');
      }
    } catch (error) {
      console.error("Error deploying to social:", error);
      toast({
        variant: "destructive",
        title: "Deployment Failed",
        description: error instanceof Error ? error.message : "Failed to deploy to social media",
      });
    } finally {
      setDeploying(false);
    }
  };

  const updateContent = (key: string, value: string) => {
    setContent((prev: any) => ({ ...prev, [key]: value }));
  };

  const handleEditInLovable = () => {
    if (!externalProjectUrl) return;

    // Extract project ID from URL (supports both lovableproject.com and lovable.app)
    const match = externalProjectUrl.match(/https:\/\/([a-z0-9-]+)\.(lovableproject\.com|lovable\.app)/i);
    if (!match) {
      toast({
        variant: "destructive",
        title: "Invalid URL",
        description: "Could not extract project ID from the URL",
      });
      return;
    }

    const projectId = match[1];
    const editorUrl = `https://lovable.dev/projects/${projectId}`;
    
    // Open in new tab
    window.open(editorUrl, '_blank', 'noopener,noreferrer');
    
    toast({
      title: "Opening Lovable Editor",
      description: "Edit your website and return here to see the updated preview",
      duration: 5000,
    });
  };

  const handleGenerateContent = async () => {
    if (!channel) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please select a vertical/channel first",
      });
      return;
    }

    setGenerating(true);
    try {
      // Fetch business profile to pass to content generation
      const { data: { user } } = await supabase.auth.getUser();
      let businessProfile = null;
      
      if (user) {
        const { data: profile } = await supabase
          .from('business_profiles')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();
        businessProfile = profile;
      }
      
      const { data, error } = await supabase.functions.invoke('content-generate', {
        body: {
          vertical: channel,
          contentType: asset.type === 'voice' ? 'voice' : asset.type === 'video' ? 'video' : asset.type === 'landing_page' ? 'landing_page' : asset.type === 'email' ? 'email' : 'social',
          assetGoal: goal || undefined,
          tone: businessProfile?.content_tone || 'professional',
          businessProfile
        }
      });

      if (error) throw error;

      if (data.success) {
        // Populate content fields based on asset type
        if (asset.type === 'email') {
          setContent({
            subject: data.subjectLine || 'Exclusive Offer - Limited Time',
            body: data.content
          });
        } else if (asset.type === 'landing_page') {
          // Parse the generated content for landing page sections
          const lines = data.content.split('\n').filter((l: string) => l.trim());
          const headline = lines.find((l: string) => l.length > 10 && l.length < 100) || lines[0] || 'Transform Your Experience Today';
          const subheadline = lines.find((l: string) => l.length > 50 && l !== headline) || 'Discover excellence with our premium offerings';
          
          setContent({
            hero_headline: headline,
            subheadline: subheadline,
            primary_cta_label: channel === 'Hotels & Resorts' ? 'Book Now' :
                               channel === 'Gyms' ? 'Join Now' :
                               channel === 'Education' ? 'Enroll Today' :
                               'Get Started'
          });
        } else if (asset.type === 'video') {
          setContent({
            description: data.content,
            cta_label: channel === 'Hotels & Resorts' ? 'Book Your Stay' :
                       channel === 'Entertainment Venues' ? 'Get Tickets' :
                       'Learn More'
          });
        } else if (asset.type === 'voice') {
          // Split content into sections for voice scripts
          const paragraphs = data.content.split('\n\n').filter((p: string) => p.trim());
          setContent({
            opening_script: paragraphs[0] || '',
            pitch_script: paragraphs[1] || paragraphs[0] || '',
            objection_handling: paragraphs[2] || '',
            full_script: data.content
          });
        }

        toast({
          title: "Content Generated",
          description: "AI-generated content has been added to the fields",
        });
      } else {
        throw new Error(data.error || 'Generation failed');
      }
    } catch (error) {
      console.error("Error generating content:", error);
      
      let errorMessage = "Failed to generate content";
      if (error instanceof Error) {
        if (error.message.includes('429') || error.message.includes('rate limit')) {
          errorMessage = "Rate limit exceeded. Please try again in a moment.";
        } else if (error.message.includes('402') || error.message.includes('payment')) {
          errorMessage = "AI credits depleted. Please add credits to your workspace.";
        } else {
          errorMessage = error.message;
        }
      }
      
      toast({
        variant: "destructive",
        title: "Generation Failed",
        description: errorMessage,
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!channel) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please select a vertical/channel first",
      });
      return;
    }

    setGeneratingImage(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-hero-image', {
        body: {
          vertical: channel,
          assetGoal: goal || undefined
        }
      });

      if (error) throw error;

      if (data.success && data.imageUrl) {
        // Update preview_url with the generated image
        setPreviewUrl(data.imageUrl);
        
        // Also store in content for landing pages
        if (asset.type === 'landing_page') {
          setContent((prev: any) => ({ 
            ...prev, 
            hero_image_url: data.imageUrl 
          }));
        }

        toast({
          title: "Image Generated",
          description: "AI-generated hero image has been added",
        });
      } else {
        throw new Error(data.error || 'Image generation failed');
      }
    } catch (error) {
      console.error("Error generating image:", error);
      
      let errorMessage = "Failed to generate image";
      if (error instanceof Error) {
        if (error.message.includes('429') || error.message.includes('rate limit')) {
          errorMessage = "Rate limit exceeded. Please try again in a moment.";
        } else if (error.message.includes('402') || error.message.includes('payment')) {
          errorMessage = "AI credits depleted. Please add credits to your workspace.";
        } else {
          errorMessage = error.message;
        }
      }
      
      toast({
        variant: "destructive",
        title: "Image Generation Failed",
        description: errorMessage,
      });
    } finally {
      setGeneratingImage(false);
    }
  };

  const handleGenerateVideo = async () => {
    if (!channel) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please select a vertical/channel first",
      });
      return;
    }

    setGeneratingVideo(true);
    try {
      toast({
        title: "Generating Video",
        description: "Starting Veo 3.1 video generation... This will take 5-15 minutes for high-quality 8-second videos.",
        duration: 8000,
      });

      const { data, error } = await supabase.functions.invoke('generate-video', {
        body: {
          vertical: channel,
          assetGoal: goal || undefined,
          description: content.description || undefined,
          assetId: id // Pass asset ID so edge function can update when done
        }
      });

      if (error) throw error;

      if (data.success) {
        // Update preview_url with generated image immediately
        if (data.imageUrl) {
          setPreviewUrl(data.imageUrl);
        }
        
        if (data.processing) {
          // Video is processing in background with Veo 3.1 - realtime will notify when ready
          toast({
            title: "Video Processing with Veo 3.1",
            description: data.message || "Video is being generated with Veo 3.1 in the background. You'll be notified when it's ready.",
            duration: 10000,
          });
        } else if (data.videoUrl) {
          // Video generated immediately
          setPreviewUrl(data.videoUrl);
          
          toast({
            title: "Video Generated",
            description: "AI-generated video is ready for preview",
          });
        }
      } else {
        throw new Error(data.error || 'Video generation failed');
      }
    } catch (error) {
      console.error("Error generating video:", error);
      
      let errorMessage = "Failed to generate video";
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      toast({
        variant: "destructive",
        title: "Video Generation Failed",
        description: errorMessage,
      });
    } finally {
      setGeneratingVideo(false);
    }
  };

  const renderContentFields = () => {
    switch (asset?.type) {
      case "email":
        const emailPlaceholder = channel === "Biotechnology & Pharmaceuticals" ? "Breakthrough insights: See our latest research findings" :
                                channel === "Healthcare & Medical" ? "Your health matters - Schedule your consultation today" :
                                channel === "Technology & SaaS" ? "See how our solution transforms your workflow" :
                                channel === "Financial Services" ? "Secure your financial future - Expert guidance awaits" :
                                channel === "Professional Services" ? "Elevate your business - Book a strategy session" :
                                channel === "Manufacturing" ? "Optimize your production - Request a quote today" :
                                channel === "Retail & E-commerce" ? "Exclusive offer just for you - Shop now" :
                                channel === "Real Estate" ? "Your dream property awaits - Schedule a viewing" :
                                channel === "Education & Training" ? "Transform your career - Enroll today" :
                                channel === "Hospitality & Travel" ? "Exclusive escape awaits - Book your getaway" :
                                "Compelling email subject line";
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="subject">Subject Line</Label>
              <Input
                id="subject"
                value={content.subject || ""}
                onChange={(e) => updateContent("subject", e.target.value)}
                placeholder={emailPlaceholder}
                className="bg-background border-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="body">Email Body</Label>
              <Textarea
                id="body"
                value={content.body || ""}
                onChange={(e) => updateContent("body", e.target.value)}
                placeholder="Personalized email content with clear value proposition and call-to-action"
                rows={10}
                className="bg-background border-input font-mono text-sm"
              />
            </div>
          </div>
        );
      
      case "voice":
        const voiceOpening = channel === "Biotechnology & Pharmaceuticals" ? "Thank you for your interest. I'm calling to share some exciting developments..." :
                            channel === "Healthcare & Medical" ? "I'm reaching out regarding your healthcare inquiry. We're here to help..." :
                            channel === "Technology & SaaS" ? "Following up on your interest in our solution. I'd love to show you how we can help..." :
                            channel === "Financial Services" ? "Thank you for reaching out. I'd like to discuss how we can help secure your financial goals..." :
                            channel === "Professional Services" ? "Following up on your inquiry. I'd love to discuss how we can support your business..." :
                            channel === "Manufacturing" ? "Calling about your production needs. We have solutions that can help..." :
                            channel === "Retail & E-commerce" ? "Thank you for your interest. I have some great options to share with you..." :
                            channel === "Real Estate" ? "Following up on your property inquiry. I have some perfect options for you..." :
                            channel === "Education & Training" ? "Thank you for your interest in our programs. Let me share how we can help you succeed..." :
                            channel === "Hospitality & Travel" ? "Calling about your upcoming trip. We have some special offers for you..." :
                            "Personalized opening that builds rapport";
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="opening_script">Opening Script</Label>
              <Textarea
                id="opening_script"
                value={content.opening_script || ""}
                onChange={(e) => updateContent("opening_script", e.target.value)}
                placeholder={voiceOpening}
                rows={4}
                className="bg-background border-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pitch_script">Pitch Script</Label>
              <Textarea
                id="pitch_script"
                value={content.pitch_script || ""}
                onChange={(e) => updateContent("pitch_script", e.target.value)}
                placeholder="Value proposition highlighting unique benefits, features, and outcomes specific to this vertical"
                rows={6}
                className="bg-background border-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="objection_handling">Objection Handling</Label>
              <Textarea
                id="objection_handling"
                value={content.objection_handling || ""}
                onChange={(e) => updateContent("objection_handling", e.target.value)}
                placeholder="Address pricing concerns, timing, competition comparisons with empathetic, solution-focused responses"
                rows={6}
                className="bg-background border-input"
              />
            </div>
          </div>
        );
      
      case "video":
        const videoCTA = channel === "Biotechnology & Pharmaceuticals" ? "Learn More" :
                        channel === "Healthcare & Medical" ? "Book Consultation" :
                        channel === "Technology & SaaS" ? "Start Free Trial" :
                        channel === "Financial Services" ? "Get Started" :
                        channel === "Professional Services" ? "Schedule Call" :
                        channel === "Manufacturing" ? "Request Quote" :
                        channel === "Retail & E-commerce" ? "Shop Now" :
                        channel === "Real Estate" ? "Schedule Viewing" :
                        channel === "Education & Training" ? "Enroll Now" :
                        channel === "Hospitality & Travel" ? "Book Now" :
                        "Take Action";
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="description">Video Description</Label>
              <Textarea
                id="description"
                value={content.description || ""}
                onChange={(e) => updateContent("description", e.target.value)}
                placeholder="Compelling video narrative showcasing key benefits, testimonials, and differentiators for your target audience"
                rows={6}
                className="bg-background border-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cta_label">CTA Label</Label>
              <Input
                id="cta_label"
                value={content.cta_label || ""}
                onChange={(e) => updateContent("cta_label", e.target.value)}
                placeholder={videoCTA}
                className="bg-background border-input"
              />
            </div>
          </div>
        );
      
      case "landing_page":
        const landingHeadline = channel === "Biotechnology & Pharmaceuticals" ? "Advancing Science, Improving Lives" :
                               channel === "Healthcare & Medical" ? "Your Health, Our Priority" :
                               channel === "Technology & SaaS" ? "Transform Your Business Today" :
                               channel === "Financial Services" ? "Secure Your Financial Future" :
                               channel === "Professional Services" ? "Expert Solutions for Your Success" :
                               channel === "Manufacturing" ? "Precision Engineering Excellence" :
                               channel === "Retail & E-commerce" ? "Discover What You've Been Missing" :
                               channel === "Real Estate" ? "Find Your Perfect Property" :
                               channel === "Education & Training" ? "Unlock Your Potential" :
                               channel === "Hospitality & Travel" ? "Unforgettable Experiences Await" :
                               "Compelling value proposition";
        const landingCTA = channel === "Biotechnology & Pharmaceuticals" ? "Contact Us" :
                          channel === "Healthcare & Medical" ? "Book Appointment" :
                          channel === "Technology & SaaS" ? "Start Free Trial" :
                          channel === "Financial Services" ? "Schedule Consultation" :
                          channel === "Professional Services" ? "Get Started" :
                          channel === "Manufacturing" ? "Request Quote" :
                          channel === "Retail & E-commerce" ? "Shop Now" :
                          channel === "Real Estate" ? "View Properties" :
                          channel === "Education & Training" ? "Enroll Today" :
                          channel === "Hospitality & Travel" ? "Book Now" :
                          "Get Started";
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="hero_headline">Hero Headline</Label>
              <Input
                id="hero_headline"
                value={content.hero_headline || ""}
                onChange={(e) => updateContent("hero_headline", e.target.value)}
                placeholder={landingHeadline}
                className="bg-background border-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subheadline">Subheadline</Label>
              <Input
                id="subheadline"
                value={content.subheadline || ""}
                onChange={(e) => updateContent("subheadline", e.target.value)}
                placeholder="Clear benefit statement that reinforces the headline and drives action"
                className="bg-background border-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="primary_cta_label">Primary CTA Label</Label>
              <Input
                id="primary_cta_label"
                value={content.primary_cta_label || ""}
                onChange={(e) => updateContent("primary_cta_label", e.target.value)}
                placeholder={landingCTA}
                className="bg-background border-input"
              />
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        </div>
      </ProtectedRoute>
    );
  }

  if (!asset) {
    return (
      <ProtectedRoute>
        <div className="flex min-h-screen flex-col bg-background">
          <NavBar />
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-foreground">Asset not found</h2>
              <Button onClick={() => navigate("/assets")} className="mt-4">
                Back to Assets
              </Button>
            </div>
          </div>
          <Footer />
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="flex min-h-screen flex-col bg-background">
        <NavBar />
        <PageBreadcrumbs items={[
          { label: "Assets", href: "/assets" },
          { label: asset?.name || "Asset" }
        ]} />
        <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

          <div className="mb-6">
            <h1 className="text-4xl font-bold text-foreground">{asset.name}</h1>
            <p className="mt-2 text-muted-foreground capitalize">
              {asset.type.replace("_", " ")} Asset
            </p>
          </div>

          {/* Split Layout */}
          <div className="grid gap-6 lg:grid-cols-5">
            {/* Left Pane - Preview (40% on desktop) */}
            <div className="lg:col-span-2 space-y-4">
              {/* Edit in Lovable button for external projects */}
              {externalProjectUrl && (asset.type === 'landing_page' || asset.type === 'website') && (
                <div className="rounded-lg border-2 border-primary bg-primary/10 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-foreground mb-1">
                        External Lovable Project
                      </h3>
                      <p className="text-xs text-muted-foreground mb-3">
                        This website is hosted in a separate Lovable project. Click below to edit content, then return here to see the updated preview.
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={handleEditInLovable}
                    className="w-full bg-primary hover:bg-primary/90"
                    size="lg"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4 rotate-180" />
                    Edit Website in Lovable
                  </Button>
                </div>
              )}
              
              <Card className="border-border bg-card shadow-md">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-lg">Preview</CardTitle>
                      {lastRefreshedAt && (
                        <Badge variant="secondary" className="text-xs">
                          Updated {formatDistanceToNow(lastRefreshedAt, { addSuffix: true })}
                        </Badge>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={fetchAsset}
                      disabled={loading}
                    >
                      <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                      Refresh
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <AssetPreview
                    key={JSON.stringify(content)}
                    type={asset.type}
                    previewUrl={previewUrl}
                    content={content}
                    name={asset.name}
                  />
                </CardContent>
              </Card>
            </div>

            {/* Right Pane - Edit Form (60% on desktop) */}
            <div className="lg:col-span-3">
              <Card className="border-border bg-card shadow-md">
                <CardHeader>
                  <CardTitle className="text-foreground">Edit Asset</CardTitle>
                  <CardDescription>Manage asset details and content</CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="general" className="w-full">
                    <TabsList className="grid w-full grid-cols-5 mb-6">
                      <TabsTrigger value="general">General</TabsTrigger>
                      <TabsTrigger value="settings">Settings</TabsTrigger>
                      <TabsTrigger value="content">Content</TabsTrigger>
                      <TabsTrigger value="ai-optimize">
                        <Sparkles className="h-4 w-4 mr-1" />
                        AI
                      </TabsTrigger>
                      <TabsTrigger value="actions">Actions</TabsTrigger>
                    </TabsList>

                    <TabsContent value="general" className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Name *</Label>
                        <Input
                          id="name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="bg-background border-input focus:ring-2 focus:ring-primary"
                        />
                        {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="segment">Target Segments</Label>
                        <MultiSegmentSelector
                          selectedIds={segmentIds}
                          onSelectionChange={setSegmentIds}
                          placeholder="Select target segments"
                          showLeadCounts={true}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="channel">Vertical / Industry</Label>
                        <Select value={channel} onValueChange={setChannel}>
                          <SelectTrigger className="bg-background border-input focus:ring-2 focus:ring-primary">
                            <SelectValue placeholder="Select industry vertical" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Biotechnology & Pharmaceuticals">Biotechnology & Pharmaceuticals</SelectItem>
                            <SelectItem value="Healthcare & Medical">Healthcare & Medical</SelectItem>
                            <SelectItem value="Technology & SaaS">Technology & SaaS</SelectItem>
                            <SelectItem value="Finance & Banking">Finance & Banking</SelectItem>
                            <SelectItem value="Consulting & Professional Services">Consulting & Professional Services</SelectItem>
                            <SelectItem value="Manufacturing">Manufacturing</SelectItem>
                            <SelectItem value="Education & Training">Education & Training</SelectItem>
                            <SelectItem value="Real Estate & Property">Real Estate & Property</SelectItem>
                          </SelectContent>
                        </Select>
                        {errors.channel && <p className="text-sm text-destructive">{errors.channel}</p>}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="goal">Goal</Label>
                        <Textarea
                          id="goal"
                          value={goal}
                          onChange={(e) => setGoal(e.target.value)}
                          placeholder="What is the objective of this asset?"
                          rows={4}
                          className="bg-background border-input focus:ring-2 focus:ring-primary"
                        />
                        {errors.goal && <p className="text-sm text-destructive">{errors.goal}</p>}
                      </div>
                    </TabsContent>

                    <TabsContent value="settings" className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="preview_url">Preview URL</Label>
                        <Input
                          id="preview_url"
                          value={previewUrl}
                          onChange={(e) => setPreviewUrl(e.target.value)}
                          placeholder="https://..."
                          className="bg-background border-input focus:ring-2 focus:ring-primary"
                        />
                        {errors.preview_url && <p className="text-sm text-destructive">{errors.preview_url}</p>}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="external_id">External ID</Label>
                        <Input
                          id="external_id"
                          value={externalId}
                          onChange={(e) => setExternalId(e.target.value)}
                          placeholder="fal.ai or vapi.ai ID"
                          className="bg-background border-input focus:ring-2 focus:ring-primary"
                        />
                        {errors.external_id && <p className="text-sm text-destructive">{errors.external_id}</p>}
                      </div>

                      {(asset.type === 'landing_page' || asset.type === 'website') && (
                        <>
                          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-4">
                            <h3 className="text-sm font-medium text-foreground">External Lovable Project</h3>
                            
                            <div className="space-y-2">
                              <Label htmlFor="external_project_url">Project URL</Label>
                              <Input
                                id="external_project_url"
                                value={externalProjectUrl}
                                onChange={(e) => setExternalProjectUrl(e.target.value)}
                                placeholder="https://your-project-id.lovableproject.com"
                                className="bg-background border-input"
                              />
                              <p className="text-xs text-muted-foreground">
                                The Lovable project URL for this landing page/website
                              </p>
                            </div>

                            {externalProjectUrl && (
                              <div className="pt-2">
                                <Button
                                  onClick={handleEditInLovable}
                                  variant="outline"
                                  className="w-full border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                                >
                                  <ArrowLeft className="mr-2 h-4 w-4 rotate-180" />
                                  Edit Website Content in Lovable
                                </Button>
                                <p className="text-xs text-muted-foreground mt-2">
                                  Opens the Lovable editor. Preview will auto-refresh when you return.
                                </p>
                              </div>
                            )}

                            <div className="space-y-2">
                              <Label htmlFor="custom_domain">Custom Domain</Label>
                              <Input
                                id="custom_domain"
                                value={customDomain}
                                onChange={(e) => setCustomDomain(e.target.value)}
                                placeholder="www.yourdomain.com"
                                className="bg-background border-input"
                              />
                              <p className="text-xs text-muted-foreground">
                                Domain where this will be published upon approval
                              </p>
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="deployment_status">Deployment Status</Label>
                              <Select value={deploymentStatus} onValueChange={setDeploymentStatus}>
                                <SelectTrigger className="bg-background border-input">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="staging">Staging (lovableproject.com)</SelectItem>
                                  <SelectItem value="ready">Ready to Deploy</SelectItem>
                                  <SelectItem value="active">Active (on custom domain)</SelectItem>
                                  <SelectItem value="failed">Deployment Failed</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            {customDomain && externalProjectUrl && (
                              <div className="rounded-lg border border-muted-foreground/20 bg-muted/30 p-3">
                                <p className="text-xs text-muted-foreground">
                                  <strong>Next Steps:</strong> After approval, connect {customDomain} to your Lovable project 
                                  in Project Settings → Domains. See <a href="https://docs.lovable.dev/features/custom-domain" 
                                  target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                                  custom domain docs
                                  </a> for instructions.
                                </p>
                              </div>
                            )}
                          </div>
                        </>
                      )}

                      <div className="space-y-2">
                        <Label htmlFor="status">Status</Label>
                        <Select
                          value={status} 
                          onValueChange={(value) => setStatus(value as "draft" | "review" | "approved" | "live")}
                        >
                          <SelectTrigger className="bg-background border-input">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="review">In Review</SelectItem>
                            <SelectItem value="approved">Approved</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </TabsContent>

                    <TabsContent value="content" className="space-y-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-border">
                          <div>
                            <p className="text-sm font-medium">AI Content Generation</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Generate professional content tailored to your vertical and goal
                            </p>
                          </div>
                          <Button
                            onClick={handleGenerateContent}
                            disabled={generating || !channel}
                            variant="default"
                            size="sm"
                          >
                            {generating ? "Generating..." : "Generate Content"}
                          </Button>
                        </div>
                        
                        {asset.type === 'video' && (
                          <div className="flex items-center justify-between p-4 bg-primary/10 rounded-lg border border-primary/20">
                            <div>
                              <p className="text-sm font-medium">AI Video Generation</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Generate a marketing video (30-60 seconds, please be patient)
                              </p>
                            </div>
                            <Button
                              onClick={handleGenerateVideo}
                              disabled={generatingVideo || !channel}
                              variant="default"
                              size="sm"
                            >
                              {generatingVideo ? "Generating..." : "Generate Video"}
                            </Button>
                          </div>
                        )}
                        
                        {(asset.type === 'landing_page' || asset.type === 'video') && (
                          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-border">
                            <div>
                              <p className="text-sm font-medium">AI Hero Image</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Generate a stunning hero image for your {asset.type === 'video' ? 'video thumbnail' : 'landing page'}
                              </p>
                            </div>
                            <Button
                              onClick={handleGenerateImage}
                              disabled={generatingImage || !channel}
                              variant="outline"
                              size="sm"
                            >
                              {generatingImage ? "Generating..." : "Generate Image"}
                            </Button>
                          </div>
                        )}
                      </div>
                      {renderContentFields()}
                      
                      {/* Save buttons for content changes */}
                      <div className="pt-4 border-t border-border space-y-3">
                        <Button
                          onClick={handleSave}
                          disabled={saving}
                          variant="outline"
                          className="w-full"
                        >
                          {saving ? (
                            <>
                              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <Save className="mr-2 h-4 w-4" />
                              Save Draft
                            </>
                          )}
                        </Button>
                        <Button
                          onClick={handleSaveAndPublish}
                          disabled={saving}
                          className={`w-full ${justSaved ? 'bg-green-600 hover:bg-green-700' : ''}`}
                        >
                          {justSaved ? (
                            <>
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Published Successfully
                            </>
                          ) : saving ? (
                            <>
                              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                              Publishing...
                            </>
                          ) : (
                            <>
                              <Send className="mr-2 h-4 w-4" />
                              Save & Publish Live
                            </>
                          )}
                        </Button>
                      </div>
                    </TabsContent>

                    <TabsContent value="actions" className="space-y-4">
                      <div className="rounded-lg border border-border bg-secondary/20 p-6 space-y-4">
                        <div>
                          <h3 className="text-lg font-medium text-foreground mb-2">Save Changes</h3>
                          <p className="text-sm text-muted-foreground mb-4">
                            Save all modifications to this asset.
                          </p>
                          <Button
                            onClick={handleSave}
                            disabled={saving}
                            className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                          >
                            <Save className="mr-2 h-4 w-4" />
                            {saving ? "Saving..." : "Save Changes"}
                          </Button>
                        </div>

                        {asset.status !== "approved" && (
                          <>
                            <div className="border-t border-border pt-4">
                              <h3 className="text-lg font-medium text-foreground mb-2">Approve Asset</h3>
                              <p className="text-sm text-muted-foreground mb-4">
                                Mark this asset as approved and ready for deployment.
                              </p>
                              <Button
                                onClick={() => setShowApproveDialog(true)}
                                variant="outline"
                                className="w-full border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                              >
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Approve Asset
                              </Button>
                            </div>
                          </>
                        )}

                        {asset.status === "approved" && (
                          <div className="rounded-lg bg-primary/10 border border-primary/20 p-4">
                            <div className="flex items-center gap-2">
                              <CheckCircle className="h-5 w-5 text-primary" />
                              <p className="text-sm font-medium text-primary">
                                This asset is approved
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Deploy Email Campaign Button */}
                        {asset.type === "email" && (asset.status === "approved" || asset.status === "live") && (
                          <div className="border-t border-border pt-4">
                            <h3 className="text-lg font-medium text-foreground mb-2">Deploy Email Campaign</h3>
                            <p className="text-sm text-muted-foreground mb-4">
                              Send this email campaign to the specified recipients. Make sure recipients are configured in the email content.
                            </p>
                            <Button
                              onClick={handleDeployEmail}
                              disabled={deploying}
                              className="w-full bg-green-600 text-white hover:bg-green-700"
                            >
                              <Send className="mr-2 h-4 w-4" />
                              {deploying ? "Deploying..." : "Deploy Email Campaign"}
                            </Button>
                          </div>
                        )}

                        {/* Deploy to Social Media Button */}
                        {(asset.type === "video" || asset.type === "landing_page") && (asset.status === "approved" || asset.status === "live") && (
                          <div className="border-t border-border pt-4">
                            <h3 className="text-lg font-medium text-foreground mb-2">Deploy to Social Media</h3>
                            <p className="text-sm text-muted-foreground mb-4">
                              Publish this content to all connected social media platforms (Instagram, LinkedIn, Facebook, TikTok). Make sure platforms are connected in Settings.
                            </p>
                            <Button
                              onClick={handleDeploySocial}
                              disabled={deploying}
                              className="w-full bg-blue-600 text-white hover:bg-blue-700"
                            >
                              <Send className="mr-2 h-4 w-4" />
                              {deploying ? "Deploying..." : "Deploy to Social Media"}
                            </Button>
                          </div>
                        )}
                      </div>
                  </TabsContent>

                  <TabsContent value="ai-optimize" className="space-y-6">
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-lg font-semibold mb-2">Content Optimization</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          Get AI suggestions to improve engagement and conversion
                        </p>
                        <AIAssistant
                          context="content-optimization"
                          onSuggestion={(suggestion) => {
                            // Apply suggestion based on asset type
                            if (asset?.type === 'email') {
                              const contentObj = typeof content === 'string' ? {} : content;
                              setContent({ ...contentObj, body: suggestion });
                            } else {
                              setContent(suggestion);
                            }
                          }}
                          placeholder="Ask AI to optimize your content for better performance..."
                          buttonText="Optimize Content"
                        />
                      </div>

                      {asset?.type === 'email' && (
                        <div>
                          <h3 className="text-lg font-semibold mb-2">Subject Line Optimization</h3>
                          <p className="text-sm text-muted-foreground mb-4">
                            Generate high-converting subject lines
                          </p>
                          <AIAssistant
                            context="subject-line"
                            onSuggestion={(suggestion) => {
                              const contentObj = typeof content === 'string' ? {} : content;
                              setContent({ ...contentObj, subject: suggestion });
                            }}
                            placeholder="Describe the email content and AI will suggest subject lines..."
                            buttonText="Generate Subject Lines"
                          />
                        </div>
                      )}

                      {asset?.type === 'video' && (
                        <div>
                          <h3 className="text-lg font-semibold mb-2">Script Enhancement</h3>
                          <p className="text-sm text-muted-foreground mb-4">
                            Improve your video script for maximum impact
                          </p>
                          <AIAssistant
                            context="video-script"
                            onSuggestion={(suggestion) => setContent(suggestion)}
                            placeholder="Describe improvements needed for your video script..."
                            buttonText="Enhance Script"
                          />
                        </div>
                      )}

                      <div>
                        <h3 className="text-lg font-semibold mb-2">Audience Targeting</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          Get AI recommendations for targeting the right audience
                        </p>
                        <AIAssistant
                          context="audience-targeting"
                          onSuggestion={(suggestion) => setGoal(suggestion)}
                          placeholder="Ask AI to suggest audience targeting strategies..."
                          buttonText="Get Targeting Suggestions"
                        />
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
        <Footer />

        {/* Approve Confirmation Dialog */}
        <AlertDialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Approve this asset?</AlertDialogTitle>
              <AlertDialogDescription>
                This will mark "{asset.name}" as approved. The asset will be ready for deployment.
                This action can be reversed by changing the status back to Draft or In Review.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleApprove} className="bg-primary hover:bg-primary/90">
                Approve
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </ProtectedRoute>
  );
};

export default AssetDetail;
