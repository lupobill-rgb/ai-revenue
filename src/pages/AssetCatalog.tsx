import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Plus, Video, Mail, Phone, Layout, Search, Download, FolderDown, Sparkles, Database } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import ProtectedRoute from "@/components/ProtectedRoute";
import { QuickImportDialog } from "@/components/QuickImportDialog";
import { BulkImportDialog } from "@/components/BulkImportDialog";
import { getAssetPlaceholder } from "@/lib/placeholders";
import { SAMPLE_ASSETS } from "@/lib/sampleData";

const AssetCatalog = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [assets, setAssets] = useState<any[]>([]);
  const [filteredAssets, setFilteredAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [bulkImportDialogOpen, setBulkImportDialogOpen] = useState(false);
  const [generatingImages, setGeneratingImages] = useState(false);
  const [showSampleData, setShowSampleData] = useState(true);

  useEffect(() => {
    fetchAssets();
  }, []);

  useEffect(() => {
    filterAssets();
  }, [searchQuery, typeFilter, statusFilter, assets, showSampleData]);

  const fetchAssets = async () => {
    try {
      const { data, error } = await supabase
        .from("assets")
        .select("*, segments(name)")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAssets(data || []);
    } catch (error) {
      console.error("Error fetching assets:", error);
    } finally {
      setLoading(false);
    }
  };

  const filterAssets = () => {
    // Combine real assets with sample data if enabled
    const baseAssets = showSampleData && assets.length === 0 ? SAMPLE_ASSETS : assets;
    let filtered = [...baseAssets];

    if (searchQuery) {
      filtered = filtered.filter((asset) =>
        asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        asset.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (typeFilter !== "all") {
      filtered = filtered.filter((asset) => asset.type === typeFilter);
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((asset) => asset.status === statusFilter);
    }

    setFilteredAssets(filtered);
  };

  const getAssetIcon = (type: string) => {
    switch (type) {
      case "video":
        return <Video className="h-6 w-6" />;
      case "email":
        return <Mail className="h-6 w-6" />;
      case "voice":
        return <Phone className="h-6 w-6" />;
      case "landing_page":
        return <Layout className="h-6 w-6" />;
      case "website":
        return <Layout className="h-6 w-6" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      draft: "bg-muted text-muted-foreground",
      review: "bg-yellow-500/10 text-yellow-500 border border-yellow-500/20",
      approved: "bg-blue-500/10 text-blue-500 border border-blue-500/20",
      live: "bg-primary/10 text-primary border border-primary/20",
    };
    return colors[status as keyof typeof colors] || colors.draft;
  };

  const handleGenerateMissingImages = async () => {
    setGeneratingImages(true);
    try {
      toast({
        title: "Generating Images",
        description: "AI is creating preview images for assets without visuals. This may take a few minutes...",
      });

      const { data, error } = await supabase.functions.invoke('generate-missing-images');

      if (error) throw error;

      if (data.success) {
        toast({
          title: "Images Generated!",
          description: `Successfully created ${data.successCount} images. ${data.failCount > 0 ? `${data.failCount} failed.` : ''}`,
        });
        // Refresh the assets list
        await fetchAssets();
      } else {
        throw new Error(data.error || 'Failed to generate images');
      }
    } catch (error) {
      console.error("Error generating images:", error);
      toast({
        variant: "destructive",
        title: "Generation Failed",
        description: error instanceof Error ? error.message : "Failed to generate images",
      });
    } finally {
      setGeneratingImages(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="flex min-h-screen flex-col bg-background">
        <NavBar />
        <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-4xl font-bold text-foreground">Asset Catalog</h1>
              <p className="mt-2 text-muted-foreground">
                Browse and manage all marketing assets
              </p>
            </div>
            <div className="flex items-center gap-3 bg-muted/50 px-4 py-2 rounded-lg border border-border">
              <Database className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="sample-data-assets" className="text-sm font-medium cursor-pointer">
                Demo Data
              </Label>
              <Switch
                id="sample-data-assets"
                checked={showSampleData}
                onCheckedChange={setShowSampleData}
              />
            </div>
          </div>

          {showSampleData && assets.length === 0 && (
            <div className="mb-6 p-3 bg-primary/10 border border-primary/20 rounded-lg text-sm text-primary flex items-center gap-2">
              <Database className="h-4 w-4" />
              Showing sample demo data. Toggle off to view real data only.
            </div>
          )}

          <div className="flex flex-wrap gap-2 mb-6">
            <Button
              onClick={handleGenerateMissingImages}
              disabled={generatingImages}
              variant="outline"
              className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
            >
              <Sparkles className={`mr-2 h-4 w-4 ${generatingImages ? 'animate-spin' : ''}`} />
              {generatingImages ? 'Generating...' : 'Generate Images'}
            </Button>
              <Button
                onClick={() => setImportDialogOpen(true)}
                variant="outline"
                className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
              >
                <Download className="mr-2 h-4 w-4" />
                Import Website
              </Button>
              <Button
                onClick={() => setBulkImportDialogOpen(true)}
                variant="outline"
                className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
              >
                <FolderDown className="mr-2 h-4 w-4" />
                Bulk Import
              </Button>
            <Button
              onClick={() => navigate("/assets/new")}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="mr-2 h-4 w-4" />
              New Asset
            </Button>
          </div>

          {/* Filters */}
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search assets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-background border-input"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="bg-background border-input">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="video">Video</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="voice">Voice</SelectItem>
                <SelectItem value="landing_page">Landing Page</SelectItem>
                <SelectItem value="website">Website</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="bg-background border-input">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="review">In Review</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="live">Live</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Asset Grid */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            </div>
          ) : filteredAssets.length === 0 ? (
            <Card className="border-border bg-card">
              <CardContent className="py-12 text-center">
                <Layout className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-medium text-foreground">No assets found</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {searchQuery || typeFilter !== "all" || statusFilter !== "all"
                    ? "Try adjusting your filters"
                    : "Get started by creating your first asset"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredAssets.map((asset, index) => (
                <Card
                  key={asset.id}
                  className="group cursor-pointer overflow-hidden border-border bg-card transition-all hover:shadow-lg hover:scale-[1.02] animate-fade-in"
                  style={{ animationDelay: `${index * 0.05}s` }}
                  onClick={() => navigate(`/assets/${asset.id}`)}
                >
                  <CardContent className="p-0">
                    {/* Preview for landing_page and website types */}
                    {(asset.type === 'landing_page' || asset.type === 'website') ? (
                      <>
                        <div className="relative aspect-video bg-muted overflow-hidden">
                          {asset.content?.screenshot ? (
                            <img 
                              src={asset.content.screenshot} 
                              alt={asset.name}
                              className="w-full h-full object-cover"
                            />
                          ) : asset.content?.hero_image_url ? (
                            <img 
                              src={asset.content.hero_image_url} 
                              alt={asset.name}
                              className="w-full h-full object-cover"
                            />
                          ) : asset.preview_url || asset.external_project_url ? (
                            <iframe
                              src={asset.preview_url || asset.external_project_url}
                              className="w-full h-full pointer-events-none"
                              title={asset.name}
                              loading="lazy"
                              sandbox="allow-same-origin allow-scripts"
                            />
                          ) : (
                            <img 
                              src={getAssetPlaceholder(asset.type)} 
                              alt={asset.name}
                              className="w-full h-full object-cover"
                            />
                          )}
                          <span
                            className={`absolute top-3 right-3 rounded-full px-2 py-1 text-xs font-medium capitalize ${getStatusBadge(
                              asset.status
                            )}`}
                          >
                            {asset.status}
                          </span>
                        </div>
                        <div className="p-4">
                          <h3 className="mb-2 text-lg font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                            {asset.name}
                          </h3>
                          {asset.description && (
                            <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">
                              {asset.description}
                            </p>
                          )}
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span className="capitalize">{asset.type.replace("_", " ")}</span>
                            {asset.segments && (
                              <span className="rounded-full bg-secondary px-2 py-1">
                                {asset.segments.name}
                              </span>
                            )}
                          </div>
                        </div>
                      </>
                    ) : (
                      /* Preview card for other asset types (video, email, voice) */
                      <>
                        <div className="relative aspect-video bg-muted overflow-hidden">
                          {asset.preview_url ? (
                            asset.type === "video" ? (
                              <video
                                src={asset.preview_url}
                                className="w-full h-full object-cover"
                                controls={false}
                                muted
                                loop
                                playsInline
                              />
                            ) : (
                              <img 
                                src={asset.preview_url} 
                                alt={asset.name}
                                className="w-full h-full object-cover"
                              />
                            )
                          ) : asset.type === "email" ? (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
                              <Mail className="w-16 h-16 text-primary/40" />
                            </div>
                          ) : (
                            <img 
                              src={getAssetPlaceholder(asset.type)} 
                              alt={asset.name}
                              className="w-full h-full object-cover"
                            />
                          )}
                          <span
                            className={`absolute top-3 right-3 rounded-full px-2 py-1 text-xs font-medium capitalize ${getStatusBadge(
                              asset.status
                            )}`}
                          >
                            {asset.status}
                          </span>
                        </div>
                        <div className="p-4">
                          <h3 className="mb-2 text-lg font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                            {asset.name}
                          </h3>
                          {asset.description && (
                            <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">
                              {asset.description}
                            </p>
                          )}
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span className="capitalize">{asset.type.replace("_", " ")}</span>
                            {asset.segments && (
                              <span className="rounded-full bg-secondary px-2 py-1">
                                {asset.segments.name}
                              </span>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </main>
        <Footer />
        <QuickImportDialog open={importDialogOpen} onOpenChange={setImportDialogOpen} />
        <BulkImportDialog 
          open={bulkImportDialogOpen} 
          onOpenChange={setBulkImportDialogOpen}
          onComplete={fetchAssets}
        />
      </div>
    </ProtectedRoute>
  );
};

export default AssetCatalog;
