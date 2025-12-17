import { CMOProvider } from "@/contexts/CMOContext";
import LandingPagesTab from "@/components/cmo/LandingPagesTab";
import NavBar from "@/components/NavBar";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

export default function LandingPages() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/login");
    }
  }, [user, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <CMOProvider>
      <div className="min-h-screen flex flex-col bg-background">
        <NavBar />
        <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">Landing Pages</h1>
            <p className="text-muted-foreground">
              Create and manage AI-powered landing pages
            </p>
          </div>
          <LandingPagesTab />
        </main>
      </div>
    </CMOProvider>
  );
}
