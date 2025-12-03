import { useState } from "react";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import ProtectedRoute from "@/components/ProtectedRoute";
import ContentCalendar from "@/components/ContentCalendar";
import AutomationDashboard from "@/components/AutomationDashboard";
import WorkspaceSelector from "@/components/WorkspaceSelector";
import { Building2 } from "lucide-react";

export default function Automation() {
  const [workspaceId, setWorkspaceId] = useState<string | null>(
    localStorage.getItem("currentWorkspaceId")
  );

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background flex flex-col">
        <NavBar />
        <main className="flex-1 container py-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold">Automation Hub</h1>
              <p className="text-muted-foreground mt-2">
                Schedule content, automate workflows, and let AI handle your daily marketing
              </p>
            </div>
            <WorkspaceSelector onWorkspaceChange={setWorkspaceId} />
          </div>

          {workspaceId ? (
            <div className="space-y-8">
              <AutomationDashboard workspaceId={workspaceId} />
              <ContentCalendar workspaceId={workspaceId} />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <Building2 className="h-16 w-16 text-muted-foreground/50 mb-4" />
              <h2 className="text-xl font-semibold mb-2">No Workspace Selected</h2>
              <p className="text-muted-foreground max-w-md">
                Select or create a workspace to view automation jobs and schedule content.
              </p>
            </div>
          )}
        </main>
        <Footer />
      </div>
    </ProtectedRoute>
  );
}
