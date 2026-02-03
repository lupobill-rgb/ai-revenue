import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import ProtectedRoute from "@/components/ProtectedRoute";
import { ExternalProjectImport } from "@/components/ExternalProjectImport";
import { z } from "zod";

const assetSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  description: z.string().max(1000).optional(),
  type: z.enum(["video", "email", "voice", "landing_page"]),
  fal_id: z.string().max(500).optional(),
  preview_url: z.string().url("Must be a valid URL").max(1000).optional().or(z.literal("")),
});

const NewAsset = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [segments, setSegments] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<string>("video");
  const [falId, setFalId] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [segmentId, setSegmentId] = useState<string>("");
  const [vertical, setVertical] = useState<string>("");
  const [goal, setGoal] = useState("");
  const [generatingContent, setGeneratingContent] = useState(false);
  const [externalProjectUrl, setExternalProjectUrl] = useState("");
  const [customDomain, setCustomDomain] = useState("");
  const [projectImported, setProjectImported] = useState(false);

  useEffect(() => {
    fetchSegments();
  }, []);

  const fetchSegments = async () => {
    const { data } = await supabase.from("segments").select("*").order("name");
    setSegments(data || []);
  };

  const handleGenerateContent = async () => {
    if (!vertical) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select a vertical first",
      });
      return;
    }

    setGeneratingContent(true);
    try {
      const { data, error } = await supabase.functions.invoke("content-generate", {
        body: {
          vertical,
          contentType: type === "email" ? "email" : type === "landing_page" ? "landing_page" : "social",
          assetGoal: goal,
          tone: "professional"
        },
      });

      if (error) throw error;

      if (data.content) {
        setDescription(data.content);
        if (data.subjectLine) {
          setName(data.subjectLine);
        }
        toast({
          title: "Content Generated",
          description: "AI-generated content has been added",
        });
      }
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate content",
      });
    } finally {
      setGeneratingContent(false);
    }
  };

  const handleCreate = async () => {
    setErrors({});

    const result = assetSchema.safeParse({
      name,
      description,
      type,
      fal_id: falId,
      preview_url: previewUrl,
    });

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from("assets")
        .insert([{
          name: result.data.name,
          description: result.data.description,
          type: result.data.type,
          fal_id: result.data.fal_id,
          preview_url: result.data.preview_url || null,
          segment_id: segmentId || null,
          goal: goal || null,
          channel: vertical || null,
          status: "draft",
          created_by: user?.id,
          external_project_url: externalProjectUrl || null,
          custom_domain: customDomain || null,
          deployment_status: externalProjectUrl ? "staging" : null,
        }])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Created",
        description: "Asset created successfully",
      });
      navigate(`/assets/${data.id}`);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create asset",
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="flex min-h-screen flex-col bg-background">
        <NavBar />
        <main className="flex-1 mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
          <Button
            variant="ghost"
            onClick={() => navigate("/assets")}
            className="mb-6 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Assets
          </Button>

          <Card className="border-border bg-card animate-fade-in">
            <CardHeader>
              <CardTitle className="text-foreground">Create New Asset</CardTitle>
              <CardDescription>Add a new marketing asset to your catalog</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={vertical ? `${vertical} Campaign Asset` : "Campaign Asset Name"}
                  className="bg-background border-input"
                />
                {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={vertical ? `Marketing content for ${vertical} audience` : "Describe your marketing content"}
                  rows={4}
                  className="bg-background border-input"
                />
                {errors.description && <p className="text-sm text-destructive">{errors.description}</p>}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="type">Type *</Label>
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger className="bg-background border-input">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="video">Video</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="voice">Voice</SelectItem>
                      <SelectItem value="landing_page">Landing Page</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.type && <p className="text-sm text-destructive">{errors.type}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="vertical">Vertical *</Label>
                  <Select value={vertical} onValueChange={setVertical}>
                    <SelectTrigger className="bg-background border-input">
                      <SelectValue placeholder="Select vertical" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Biotechnology & Pharmaceuticals">Biotechnology & Pharmaceuticals</SelectItem>
                      <SelectItem value="Healthcare & Medical">Healthcare & Medical</SelectItem>
                      <SelectItem value="Technology & SaaS">Technology & SaaS</SelectItem>
                      <SelectItem value="Financial Services">Financial Services</SelectItem>
                      <SelectItem value="Professional Services">Professional Services</SelectItem>
                      <SelectItem value="Manufacturing">Manufacturing</SelectItem>
                      <SelectItem value="Retail & E-commerce">Retail & E-commerce</SelectItem>
                      <SelectItem value="Real Estate">Real Estate</SelectItem>
                      <SelectItem value="Education & Training">Education & Training</SelectItem>
                      <SelectItem value="Hospitality & Travel">Hospitality & Travel</SelectItem>
                      <SelectItem value="Media & Entertainment">Media & Entertainment</SelectItem>
                      <SelectItem value="Non-Profit">Non-Profit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="segment">Segment</Label>
                <Select value={segmentId} onValueChange={setSegmentId}>
                  <SelectTrigger className="bg-background border-input">
                    <SelectValue placeholder="Select segment (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {segments.map((seg) => (
                      <SelectItem key={seg.id} value={seg.id}>
                        {seg.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="goal">Campaign Goal (Optional)</Label>
                <Input
                  id="goal"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder={
                    vertical === "Biotechnology & Pharmaceuticals" ? "Generate qualified leads, increase market awareness" :
                    vertical === "Healthcare & Medical" ? "Drive patient appointments, promote services" :
                    vertical === "Technology & SaaS" ? "Generate demos, increase trial signups" :
                    vertical === "Financial Services" ? "Book consultations, generate qualified leads" :
                    vertical === "Professional Services" ? "Schedule discovery calls, increase inquiries" :
                    vertical === "Manufacturing" ? "Generate RFQs, increase sales pipeline" :
                    vertical === "Retail & E-commerce" ? "Drive sales, increase conversions" :
                    vertical === "Real Estate" ? "Generate property inquiries, schedule viewings" :
                    vertical === "Education & Training" ? "Drive enrollments, increase course signups" :
                    vertical === "Hospitality & Travel" ? "Increase bookings, drive reservations" :
                    vertical === "Media & Entertainment" ? "Grow audience, increase engagement" :
                    vertical === "Non-Profit" ? "Increase donations, grow supporter base" :
                    "Define your campaign goal"
                  }
                  className="bg-background border-input"
                />
              </div>

              {(type === "landing_page" || type === "video") && !projectImported && (
                <ExternalProjectImport
                  onProjectDataExtracted={(data) => {
                    setExternalProjectUrl(data.previewUrl);
                    setPreviewUrl(data.previewUrl);
                    setCustomDomain(data.customDomain || "");
                    if (!name) setName(data.name);
                    setProjectImported(true);
                    toast({
                      title: "Project Data Imported",
                      description: "External project has been linked to this asset",
                    });
                  }}
                />
              )}

              {(type === "landing_page" || type === "video") && projectImported && (
                <Card className="border-primary/20 bg-primary/5">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-foreground">✓ External Project Imported</p>
                        <p className="text-xs text-muted-foreground">URL: {externalProjectUrl}</p>
                        {customDomain && (
                          <p className="text-xs text-muted-foreground">Domain: {customDomain}</p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setProjectImported(false);
                          setExternalProjectUrl("");
                          setCustomDomain("");
                          setPreviewUrl("");
                        }}
                      >
                        Change
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-foreground mb-1">AI Content Generation</h3>
                    <p className="text-xs text-muted-foreground">
                      Generate vertical-specific content using AI. Select a vertical and type above, then click to generate.
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={handleGenerateContent}
                    disabled={generatingContent || !vertical}
                    variant="outline"
                    size="sm"
                  >
                    {generatingContent ? "Generating..." : "Generate Content"}
                  </Button>
                </div>
              </div>

              <div className="space-y-4 rounded-lg border border-border bg-secondary/20 p-4">
                <h3 className="text-sm font-medium text-foreground">Integration IDs (Optional)</h3>

                <div className="space-y-2">
                  <Label htmlFor="fal_id">fal.ai Video ID</Label>
                  <Input
                    id="fal_id"
                    value={falId}
                    onChange={(e) => setFalId(e.target.value)}
                    placeholder="Enter fal.ai video ID"
                    className="bg-background border-input"
                  />
                </div>


                <div className="space-y-2">
                  <Label htmlFor="preview_url">Preview URL</Label>
                  <Input
                    id="preview_url"
                    value={previewUrl}
                    onChange={(e) => setPreviewUrl(e.target.value)}
                    placeholder="https://..."
                    className="bg-background border-input"
                  />
                  {errors.preview_url && <p className="text-sm text-destructive">{errors.preview_url}</p>}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  onClick={handleCreate}
                  disabled={creating}
                  className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {creating ? "Creating..." : "Create Asset"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate("/assets")}
                  disabled={creating}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
            </Card>
          </main>
          <Footer />
        </div>
      </ProtectedRoute>
    );
  };
  
  export default NewAsset;
