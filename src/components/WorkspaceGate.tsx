// WorkspaceGate - Blocks features that require a workspace with clear CTA
import { useState } from "react";
import { useWorkspaceContext } from "@/contexts/WorkspaceContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Building2, Plus, Loader2, HelpCircle, ExternalLink } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface WorkspaceGateProps {
  children: React.ReactNode;
  /** Feature name for error message */
  feature?: string;
  /** Show inline vs full card */
  variant?: "inline" | "card";
}

export function WorkspaceGate({ children, feature = "this feature", variant = "card" }: WorkspaceGateProps) {
  const { hasWorkspace, isLoading, workspaces, selectWorkspace, createWorkspace } = useWorkspaceContext();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    const result = await createWorkspace(newName.trim());
    setCreating(false);
    if (result) {
      setDialogOpen(false);
      setNewName("");
    }
  };

  // Loading state
  if (isLoading) {
    if (variant === "inline") {
      return (
        <div className="flex items-center gap-2 p-4 bg-muted/50 rounded-lg">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm text-muted-foreground">Loading workspace...</span>
        </div>
      );
    }
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-10 w-32" />
        </CardContent>
      </Card>
    );
  }

  // Has workspace - render children
  if (hasWorkspace) {
    return <>{children}</>;
  }

  // No workspace - show blocking message
  const content = (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Building2 className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="font-medium">
            {workspaces.length > 0 ? "Select a Workspace" : "Create Your First Workspace"}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {workspaces.length > 0
              ? `Choose a workspace to use ${feature}.`
              : `You need a workspace to use ${feature}. Create one to get started.`}
          </p>
        </div>
        <WorkspaceHelpTooltip />
      </div>

      {workspaces.length > 0 ? (
        <div className="space-y-2">
          {workspaces.map((ws) => (
            <Button
              key={ws.id}
              variant="outline"
              className="w-full justify-start"
              onClick={() => selectWorkspace(ws.id)}
            >
              <Building2 className="h-4 w-4 mr-2" />
              {ws.name}
            </Button>
          ))}
        </div>
      ) : (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Create Workspace
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Your First Workspace</DialogTitle>
              <DialogDescription>
                A workspace organizes your campaigns, leads, and content. Most businesses need just one.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label htmlFor="workspace-name">Workspace Name</Label>
                <Input
                  id="workspace-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g., Acme Marketing"
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Usually your business or team name
                </p>
              </div>
              <Button onClick={handleCreate} disabled={!newName.trim() || creating} className="w-full">
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Workspace
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );

  if (variant === "inline") {
    return (
      <div className="p-4 border border-border bg-muted/30 rounded-lg">
        {content}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Workspace Required
        </CardTitle>
        <CardDescription>
          Set up a workspace to continue
        </CardDescription>
      </CardHeader>
      <CardContent>
        {content}
      </CardContent>
    </Card>
  );
}

export function WorkspaceHelpTooltip() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button className="text-muted-foreground hover:text-foreground transition-colors">
            <HelpCircle className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p className="text-sm">
            <strong>What is a workspace?</strong> A workspace is a container for your marketing campaigns, 
            leads, content, and analytics. Each workspace is completely isolated.
          </p>
          <a
            href="https://docs.ubigrowth.ai/workspaces"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary flex items-center gap-1 mt-2 hover:underline"
          >
            Learn more <ExternalLink className="h-3 w-3" />
          </a>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default WorkspaceGate;
