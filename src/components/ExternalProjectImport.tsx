import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ExternalLink, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ExternalProjectImportProps {
  onProjectDataExtracted: (data: {
    previewUrl: string;
    name: string;
    customDomain?: string;
  }) => void;
}

export const ExternalProjectImport = ({ onProjectDataExtracted }: ExternalProjectImportProps) => {
  const { toast } = useToast();
  const [projectUrl, setProjectUrl] = useState("");
  const [customDomain, setCustomDomain] = useState("");
  const [extracting, setExtracting] = useState(false);

  const handleExtract = async () => {
    if (!projectUrl) {
      toast({
        variant: "destructive",
        title: "URL Required",
        description: "Please enter an external project URL",
      });
      return;
    }

    // Validate URL format (supports lovableproject.com and lovable.app, with or without path)
    const lovableUrlPattern = /^https:\/\/[a-z0-9-]+\.(lovableproject\.com|lovable\.app)(\/.*)?$/i;
    if (!lovableUrlPattern.test(projectUrl.trim())) {
      toast({
        variant: "destructive",
        title: "Invalid URL",
        description: "Please enter a valid external project URL (e.g., https://project-id.lovable.app)",
      });
      return;
    }

    setExtracting(true);

    try {
      const urlMatch = projectUrl.match(/https:\/\/([a-z0-9-]+)\.(lovableproject\.com|lovable\.app)/i);
      const projectId = urlMatch ? urlMatch[1] : "External Project";
      
      // Fetch the page to extract title
      let projectName = projectId;
      try {
        const response = await fetch(projectUrl);
        const html = await response.text();
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch) {
          // Strip trailing " | <builder>" suffix if present
          projectName = titleMatch[1].replace(/\s+\|\s+[^|]+$/, "").trim();
        }
      } catch (e) {
        console.log("Could not fetch title, using project ID");
      }

      onProjectDataExtracted({
        previewUrl: projectUrl,
        name: projectName,
        customDomain: customDomain || undefined,
      });

      toast({
        title: "Project Imported",
        description: `${projectName} has been imported successfully`,
      });

      // Reset form
      setProjectUrl("");
      setCustomDomain("");
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Import Failed",
        description: error instanceof Error ? error.message : "Failed to import project",
      });
    } finally {
      setExtracting(false);
    }
  };

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <ExternalLink className="h-5 w-5" />
          Import from External Project
        </CardTitle>
        <CardDescription>
          Import a landing page or website built in another external project
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="projectUrl">External Project URL *</Label>
          <Input
            id="projectUrl"
            value={projectUrl}
            onChange={(e) => setProjectUrl(e.target.value)}
            placeholder="https://your-project-id.lovableproject.com"
            className="bg-background border-input"
          />
          <p className="text-xs text-muted-foreground">
            Enter the full URL of your external project (e.g., https://abc123-xyz.lovableproject.com)
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="customDomain">Custom Domain (Optional)</Label>
          <Input
            id="customDomain"
            value={customDomain}
            onChange={(e) => setCustomDomain(e.target.value)}
            placeholder="www.yourdomain.com"
            className="bg-background border-input"
          />
          <p className="text-xs text-muted-foreground">
            Enter the custom domain where this will be published upon approval
          </p>
        </div>

        <Button
          onClick={handleExtract}
          disabled={extracting || !projectUrl}
          className="w-full"
        >
          {extracting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Importing...
            </>
          ) : (
            <>
              <ExternalLink className="mr-2 h-4 w-4" />
              Import Project
            </>
          )}
        </Button>

        <div className="rounded-lg border border-muted-foreground/20 bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">
            <strong>How it works:</strong> Import your external project URL to add it to this hub for review and approval.
            Once approved, you can publish it to your custom domain directly from this hub.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
