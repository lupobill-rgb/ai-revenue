import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Download } from "lucide-react";

interface QuickImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const QuickImportDialog = ({ open, onOpenChange }: QuickImportDialogProps) => {
  const navigate = useNavigate();
  const [projectUrl, setProjectUrl] = useState("");
  const [importing, setImporting] = useState(false);

  const handleImport = async () => {
    if (!projectUrl.trim()) {
      toast.error("Please enter a project URL");
      return;
    }

    const externalUrlPattern = /^https:\/\/[a-z0-9-]+\.[a-z0-9.-]+(\/.*)?$/i;
    if (!externalUrlPattern.test(projectUrl.trim())) {
      toast.error("Please enter a valid external project URL");
      return;
    }

    setImporting(true);

    try {
      const urlMatch = projectUrl.match(/https:\/\/([a-z0-9-]+)\.[a-z0-9.-]+/i);
      const projectId = urlMatch ? urlMatch[1] : "Imported Project";

      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;

      const displayName = `Imported website: ${projectId}`;

      // Capture screenshot
      let screenshot = null;
      try {
        const { data: screenshotData } = await supabase.functions.invoke("capture-screenshot", {
          body: { url: projectUrl.trim() }
        });
        if (screenshotData?.screenshot) {
          screenshot = screenshotData.screenshot;
        }
      } catch (error) {
        console.error("Screenshot capture failed:", error);
        // Continue without screenshot
      }

      const { data: asset, error } = await supabase
        .from("assets")
        .insert({
          type: "landing_page",
          status: "draft",
          name: displayName,
          description: "Imported from external project",
          external_project_url: projectUrl.trim(),
          preview_url: projectUrl.trim(),
          deployment_status: "staging",
          created_by: authData.user?.id ?? null,
          content: screenshot ? { screenshot } : {},
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("Website imported successfully!");
      onOpenChange(false);
      navigate(`/assets/${asset.id}`);
    } catch (error) {
      console.error("Import error:", error);
      toast.error("Failed to import website");
    } finally {
      setImporting(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import Website</DialogTitle>
          <DialogDescription>
            Paste your external project URL to import it as a landing page asset
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="project-url">External Project URL</Label>
            <Input
              id="project-url"
              placeholder="https://your-project.example.com"
              value={projectUrl}
              onChange={(e) => setProjectUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !importing) {
                  handleImport();
                }
              }}
            />
          </div>
          <Button
            onClick={handleImport}
            disabled={importing}
            className="w-full"
          >
            {importing ? (
              <>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                Importing...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Import Website
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
