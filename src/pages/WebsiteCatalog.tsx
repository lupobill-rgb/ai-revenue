import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ExternalLink, Search, Globe, FolderDown, Download, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import ProtectedRoute from "@/components/ProtectedRoute";
import { QuickImportDialog } from "@/components/QuickImportDialog";
import { BulkImportDialog } from "@/components/BulkImportDialog";
import { Badge } from "@/components/ui/badge";

const WebsiteCatalog = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [websites, setWebsites] = useState<any[]>([]);
  const [filteredWebsites, setFilteredWebsites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [bulkImportDialogOpen, setBulkImportDialogOpen] = useState(false);
  const [generatingImages, setGeneratingImages] = useState(false);

  useEffect(() => {
    fetchWebsites();
  }, []);

  useEffect(() => {
    filterWebsites();
  }, [searchQuery, websites]);

  const fetchWebsites = async () => {
    try {
      const { data, error } = await supabase
        .from("assets")
        .select("*")
        .in("type", ["landing_page", "website"])
        .not("external_project_url", "is", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setWebsites(data || []);
      setFilteredWebsites(data || []);
    } catch (error) {
      console.error("Error fetching websites:", error);
    } finally {
      setLoading(false);
    }
  };

  const filterWebsites = () => {
    if (!searchQuery) {
      setFilteredWebsites(websites);
      return;
    }

    const filtered = websites.filter((site) =>
      site.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      site.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      site.external_project_url?.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredWebsites(filtered);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "live":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      case "approved":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "review":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const handleGenerateMissingImages = async () => {
    setGeneratingImages(true);
    try {
      toast({
        title: "Generating Images",
        description: "AI is creating preview images for websites without visuals...",
      });

      const { data, error } = await supabase.functions.invoke('generate-missing-images');

      if (error) throw error;

      if (data.success) {
        toast({
          title: "Images Generated!",
          description: `Successfully created ${data.successCount} images. ${data.failCount > 0 ? `${data.failCount} failed.` : ''}`,
        });
        await fetchWebsites();
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
              <h1 className="text-4xl font-bold text-foreground flex items-center gap-2">
                <Globe className="h-8 w-8" />
                Website Catalog
              </h1>
              <p className="mt-2 text-muted-foreground">
                Browse and manage imported landing pages and websites
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
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
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <FolderDown className="mr-2 h-4 w-4" />
                Bulk Import
              </Button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="mb-6">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search websites..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-background border-input"
              />
            </div>
          </div>

          {/* Website Grid */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            </div>
          ) : filteredWebsites.length === 0 ? (
            <Card className="border-border bg-card">
              <CardContent className="py-12 text-center">
                <Globe className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-medium text-foreground">
                  {searchQuery ? "No websites found" : "No websites yet"}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {searchQuery
                    ? "Try adjusting your search"
                    : "Get started by importing your first website"}
                </p>
                {!searchQuery && (
                  <Button
                    onClick={() => setImportDialogOpen(true)}
                    className="mt-4"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Import Website
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              {filteredWebsites.map((site, index) => (
                <Card
                  key={site.id}
                  className="group overflow-hidden border-border bg-card hover:shadow-xl transition-all animate-fade-in cursor-pointer"
                  style={{ animationDelay: `${index * 0.05}s` }}
                  onClick={() => navigate(`/assets/${site.id}`)}
                >
                  <CardContent className="p-0">
                    {/* Preview - Always show live iframe for external websites */}
                    <div className="relative aspect-video bg-muted overflow-hidden">
                      <iframe
                        src={site.external_project_url || site.preview_url}
                        className="w-full h-full"
                        title={site.name}
                        loading="lazy"
                        sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/assets/${site.id}`);
                          }}
                        >
                          View Details
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(site.preview_url || site.external_project_url, "_blank");
                          }}
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Open
                        </Button>
                      </div>
                    </div>

                    {/* Info */}
                    <div className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                          {site.name}
                        </h3>
                        <Badge
                          variant="outline"
                          className={`capitalize flex-shrink-0 ${getStatusColor(site.status)}`}
                        >
                          {site.status}
                        </Badge>
                      </div>

                      {site.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {site.description}
                        </p>
                      )}

                      <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                        <span>
                          {new Date(site.created_at).toLocaleDateString()}
                        </span>
                        {site.custom_domain && (
                          <span className="font-mono truncate max-w-[200px]">
                            {site.custom_domain}
                          </span>
                        )}
                      </div>
                    </div>
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
          onComplete={fetchWebsites}
        />
      </div>
    </ProtectedRoute>
  );
};

export default WebsiteCatalog;
