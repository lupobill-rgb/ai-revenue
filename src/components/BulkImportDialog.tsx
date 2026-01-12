import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Download, CheckCircle2, XCircle, Loader2 } from "lucide-react";

interface BulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

interface ImportResult {
  url: string;
  status: "pending" | "success" | "error";
  name?: string;
  error?: string;
}

export const BulkImportDialog = ({ open, onOpenChange, onComplete }: BulkImportDialogProps) => {
  const navigate = useNavigate();
  const [urlText, setUrlText] = useState("");
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<ImportResult[]>([]);

  const validateUrl = (url: string): boolean => {
    const trimmed = url.trim().replace(/\/+$/, ''); // Remove trailing slashes
    const lovableUrlPattern = /^https?:\/\/[a-z0-9-]+\.(lovableproject\.com|lovable\.app)(\/.*)?$/i;
    return lovableUrlPattern.test(trimmed);
  };

  const importSingleUrl = async (url: string): Promise<ImportResult> => {
    try {
      const urlMatch = url.match(/https:\/\/([a-z0-9-]+)\.(lovableproject\.com|lovable\.app)/i);
      const projectId = urlMatch ? urlMatch[1] : "Imported Project";

      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;

      const displayName = `Imported website: ${projectId}`;

      // Capture screenshot
      let screenshot = null;
      try {
        const { data: screenshotData } = await supabase.functions.invoke("capture-screenshot", {
          body: { url: url.trim() }
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
          external_project_url: url.trim(),
          preview_url: url.trim(),
          deployment_status: "staging",
          created_by: authData.user?.id ?? null,
          content: screenshot ? { screenshot } : {},
        })
        .select()
        .single();

      if (error) throw error;

      return {
        url,
        status: "success",
        name: displayName,
      };
    } catch (error) {
      return {
        url,
        status: "error",
        error: error instanceof Error ? error.message : "Failed to import",
      };
    }
  };

  const handleBulkImport = async () => {
    const urls = urlText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (urls.length === 0) {
      toast.error("Please enter at least one URL");
      return;
    }

    const invalidUrls = urls.filter((url) => !validateUrl(url));
    if (invalidUrls.length > 0) {
      toast.error(
        `Invalid URL${invalidUrls.length > 1 ? 's' : ''}: ${invalidUrls.join(', ')}`,
        { duration: 5000 }
      );
      return;
    }

    setImporting(true);
    const initialResults: ImportResult[] = urls.map((url) => ({
      url,
      status: "pending",
    }));
    setResults(initialResults);

    const importPromises = urls.map((url) => importSingleUrl(url));
    const completedResults = await Promise.all(importPromises);
    
    setResults(completedResults);
    setImporting(false);

    const successCount = completedResults.filter((r) => r.status === "success").length;
    const errorCount = completedResults.filter((r) => r.status === "error").length;

    if (successCount > 0) {
      toast.success(`Successfully imported ${successCount} website${successCount > 1 ? "s" : ""}`);
    }
    if (errorCount > 0) {
      toast.error(`Failed to import ${errorCount} website${errorCount > 1 ? "s" : ""}`);
    }

    if (onComplete) {
      onComplete();
    }
  };

  const handleClose = () => {
    setUrlText("");
    setResults([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Bulk Import Websites</DialogTitle>
          <DialogDescription>
            Paste multiple external project URLs (one per line) to import them as landing page assets
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4 flex-1 overflow-y-auto">
          <div className="space-y-2">
            <Label htmlFor="urls">External Project URLs</Label>
            <Textarea
              id="urls"
              placeholder="https://project-1.lovable.app&#10;https://project-2.lovable.app&#10;https://project-3.lovable.app"
              value={urlText}
              onChange={(e) => setUrlText(e.target.value)}
              rows={8}
              className="font-mono text-sm"
              disabled={importing}
            />
          </div>

          {results.length > 0 && (
            <div className="space-y-2 border rounded-lg p-4 max-h-64 overflow-y-auto">
              <h4 className="text-sm font-semibold mb-2">Import Results</h4>
              {results.map((result, index) => (
                <div
                  key={index}
                  className="flex items-start gap-2 text-sm p-2 rounded bg-muted/50"
                >
                  {result.status === "pending" && (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mt-0.5 flex-shrink-0" />
                  )}
                  {result.status === "success" && (
                    <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  )}
                  {result.status === "error" && (
                    <XCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{result.url}</div>
                    {result.status === "success" && result.name && (
                      <div className="text-xs text-muted-foreground">{result.name}</div>
                    )}
                    {result.status === "error" && result.error && (
                      <div className="text-xs text-destructive">{result.error}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={handleBulkImport}
              disabled={importing}
              className="flex-1"
            >
              {importing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing {results.filter((r) => r.status === "success").length} of {results.length}...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Import All Websites
                </>
              )}
            </Button>
            {!importing && results.length > 0 && (
              <Button variant="outline" onClick={handleClose}>
                Done
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
