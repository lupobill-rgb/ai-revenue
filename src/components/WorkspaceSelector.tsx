import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Building2, Plus, Check, ChevronDown } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface Workspace {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
}

interface WorkspaceSelectorProps {
  onWorkspaceChange?: (workspaceId: string | null) => void;
}

export default function WorkspaceSelector({ onWorkspaceChange }: WorkspaceSelectorProps) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newWorkspace, setNewWorkspace] = useState({ name: "", slug: "" });

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  const fetchWorkspaces = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("workspaces")
      .select("*")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Failed to fetch workspaces:", error);
    } else {
      setWorkspaces(data || []);
      
      // Set first workspace as current if none selected
      const savedWorkspaceId = localStorage.getItem("currentWorkspaceId");
      const savedWorkspace = data?.find(w => w.id === savedWorkspaceId);
      
      if (savedWorkspace) {
        setCurrentWorkspace(savedWorkspace);
      } else if (data && data.length > 0) {
        setCurrentWorkspace(data[0]);
        localStorage.setItem("currentWorkspaceId", data[0].id);
      }
    }
    setLoading(false);
  };

  const handleSelectWorkspace = (workspace: Workspace) => {
    setCurrentWorkspace(workspace);
    localStorage.setItem("currentWorkspaceId", workspace.id);
    onWorkspaceChange?.(workspace.id);
    toast.success(`Switched to ${workspace.name}`);
  };

  const handleCreateWorkspace = async () => {
    if (!newWorkspace.name || !newWorkspace.slug) {
      toast.error("Please fill in all fields");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("You must be logged in");
      return;
    }

    const { data, error } = await supabase
      .from("workspaces")
      .insert({
        name: newWorkspace.name,
        slug: newWorkspace.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
        owner_id: user.id,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        toast.error("A workspace with this slug already exists");
      } else {
        toast.error("Failed to create workspace");
      }
    } else {
      toast.success("Workspace created!");
      setDialogOpen(false);
      setNewWorkspace({ name: "", slug: "" });
      fetchWorkspaces();
      if (data) {
        handleSelectWorkspace(data);
      }
    }
  };

  const generateSlug = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  };

  if (loading) {
    return (
      <Button variant="outline" disabled className="w-[200px]">
        <Building2 className="h-4 w-4 mr-2" />
        Loading...
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            className="w-[200px] justify-between"
            data-workspace-selector
          >
            <span className="flex items-center">
              <Building2 className="h-4 w-4 mr-2" />
              {currentWorkspace?.name || "Select Workspace"}
            </span>
            <ChevronDown className="h-4 w-4 ml-2 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[200px]">
          {workspaces.map((workspace) => (
            <DropdownMenuItem
              key={workspace.id}
              onClick={() => handleSelectWorkspace(workspace)}
              className="flex items-center justify-between"
            >
              {workspace.name}
              {currentWorkspace?.id === workspace.id && (
                <Check className="h-4 w-4 text-primary" />
              )}
            </DropdownMenuItem>
          ))}
          {workspaces.length > 0 && <DropdownMenuSeparator />}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                <Plus className="h-4 w-4 mr-2" />
                Create Workspace
              </DropdownMenuItem>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Workspace</DialogTitle>
                <DialogDescription>
                  Create a separate workspace for a different business or team
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label>Workspace Name</Label>
                  <Input
                    value={newWorkspace.name}
                    onChange={(e) => {
                      setNewWorkspace({
                        name: e.target.value,
                        slug: generateSlug(e.target.value),
                      });
                    }}
                    placeholder="e.g., Acme Corp"
                  />
                </div>
                <div>
                  <Label>Workspace URL</Label>
                  <div className="flex items-center">
                    <span className="text-sm text-muted-foreground mr-2">ubigrowth.app/</span>
                    <Input
                      value={newWorkspace.slug}
                      onChange={(e) => setNewWorkspace({ ...newWorkspace, slug: e.target.value })}
                      placeholder="acme-corp"
                    />
                  </div>
                </div>
                <Button onClick={handleCreateWorkspace} className="w-full">
                  Create Workspace
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
