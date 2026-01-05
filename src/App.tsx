import { useState, useEffect, useCallback } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { WorkspaceProvider } from "./contexts/WorkspaceContext";
import { CMOProvider } from "./contexts/CMOContext";
import ErrorBoundary from "./components/ErrorBoundary";
import WelcomeModal from "./components/WelcomeModal";
import SpotlightTour from "./components/SpotlightTour";
import AIChatWidget from "./components/AIChatWidget";
import ProtectedRoute from "./components/ProtectedRoute";
import { supabase } from "./integrations/supabase/client";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import AuthCallback from "./pages/AuthCallback";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import Approvals from "./pages/Approvals";
import AssetCatalog from "./pages/AssetCatalog";
import AssetDetail from "./pages/AssetDetail";
import NewAsset from "./pages/NewAsset";
import WebsiteCatalog from "./pages/WebsiteCatalog";
import Reports from "./pages/Reports";
import CRM from "./pages/CRM";
import LeadDetail from "./pages/LeadDetail";
import Settings from "./pages/Settings";
import Video from "./pages/Video";
import Email from "./pages/Email";
import Social from "./pages/Social";
import NewCampaign from "./pages/NewCampaign";
import VoiceAgents from "./pages/VoiceAgents";
import UserManagement from "./pages/UserManagement";
import Automation from "./pages/Automation";
import OSDashboard from "./pages/OSDashboard";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";
import Privacy from "./pages/Privacy";
import MondayLeadConverter from "./pages/MondayLeadConverter";
import ForcePasswordChange from "./pages/ForcePasswordChange";
import CRODashboard from "./pages/cro/CRODashboard";
import CROForecast from "./pages/cro/CROForecast";
import CROPipeline from "./pages/cro/CROPipeline";
import CRODealDetail from "./pages/cro/CRODealDetail";
import CRORecommendations from "./pages/cro/CRORecommendations";
import OutboundDashboard from "./pages/OutboundDashboard";
import OutboundCampaignBuilder from "./pages/OutboundCampaignBuilder";
import OutboundCampaignDetail from "./pages/OutboundCampaignDetail";
import OutboundLinkedInQueue from "./pages/OutboundLinkedInQueue";
import SettingsIntegrations from "./pages/SettingsIntegrations";
import LandingPages from "./pages/LandingPages";
import LeadsPage from "./pages/cmo/LeadsPage";
import PlatformAdmin from "./pages/PlatformAdmin";
import TenantIsolationQA from "./pages/platform-admin/TenantIsolationQA";
import ExecutionCertQA from "./pages/platform-admin/ExecutionCertQA";
import SLODashboard from "./pages/platform-admin/SLODashboard";
import TenantRateLimits from "./pages/platform-admin/TenantRateLimits";
import RolloutPlan from "./pages/platform-admin/RolloutPlan";
import SystemBanner from "./components/SystemBanner";

const queryClient = new QueryClient();

// Routes where onboarding UI should not appear
const AUTH_ROUTES = ["/login", "/signup", "/change-password", "/auth/callback", "/"];

const AppContent = () => {
  const [showTour, setShowTour] = useState(false);
  const [hasCheckedOnboarding, setHasCheckedOnboarding] = useState(false);
  const [shouldShowWelcome, setShouldShowWelcome] = useState(false);
  const { user } = useAuth();
  const location = useLocation();

  const isAuthRoute = AUTH_ROUTES.includes(location.pathname);

  // Check onboarding status from database
  const checkOnboardingStatus = useCallback(async () => {
    if (!user || isAuthRoute) {
      setHasCheckedOnboarding(true);
      return;
    }

    try {
      const { data } = await supabase
        .from("user_tenants")
        .select("onboarding_completed_at")
        .eq("user_id", user.id)
        .maybeSingle();

      // Only show welcome if not completed and not shown this session
      const shownThisSession = sessionStorage.getItem("tour-shown-this-session");
      if (!data?.onboarding_completed_at && !shownThisSession) {
        setShouldShowWelcome(true);
      }
    } catch (error) {
      console.error("Error checking onboarding status:", error);
    } finally {
      setHasCheckedOnboarding(true);
    }
  }, [user, isAuthRoute]);

  useEffect(() => {
    checkOnboardingStatus();
  }, [checkOnboardingStatus]);

  const handleStartTour = () => {
    setShouldShowWelcome(false);
    setShowTour(true);
  };

  const handleTourComplete = () => {
    setShowTour(false);
  };

  // Pass tour trigger to navbar via global event
  useEffect(() => {
    const handleTriggerTour = () => {
      setShowTour(true);
    };
    window.addEventListener("trigger-product-tour", handleTriggerTour);
    return () => window.removeEventListener("trigger-product-tour", handleTriggerTour);
  }, []);

  return (
    <>
      <SystemBanner />
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/change-password" element={<ForcePasswordChange />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/approvals" element={<Approvals />} />
        <Route path="/assets" element={<AssetCatalog />} />
        <Route path="/assets/new" element={<NewAsset />} />
        <Route path="/assets/:id" element={<AssetDetail />} />
        <Route path="/websites" element={<WebsiteCatalog />} />
        <Route path="/video" element={<Video />} />
        <Route path="/email" element={<Email />} />
        <Route path="/social" element={<Social />} />
        <Route path="/new-campaign" element={<NewCampaign />} />
        <Route path="/voice-agents" element={<VoiceAgents />} />
        <Route path="/users" element={<UserManagement />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/crm" element={<CRM />} />
        <Route path="/crm/:id" element={<LeadDetail />} />
        <Route path="/crm/import/monday" element={<MondayLeadConverter />} />
        <Route path="/automation" element={<Automation />} />
        <Route path="/os" element={<OSDashboard />} />
        <Route path="/cro" element={<CRODashboard />} />
        <Route path="/cro/dashboard" element={<CRODashboard />} />
        <Route path="/cro/forecast" element={<CROForecast />} />
        <Route path="/cro/pipeline" element={<CROPipeline />} />
        <Route path="/cro/deals/:id" element={<CRODealDetail />} />
        <Route path="/cro/recommendations" element={<CRORecommendations />} />
        <Route path="/outbound" element={<OutboundDashboard />} />
        <Route path="/outbound/campaigns" element={<OutboundDashboard />} />
        <Route path="/outbound/campaigns/new" element={<OutboundCampaignBuilder />} />
        <Route path="/outbound/campaigns/:id" element={<OutboundCampaignDetail />} />
        <Route path="/outbound/linkedin-queue" element={<OutboundLinkedInQueue />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/settings/integrations" element={<SettingsIntegrations />} />
        <Route path="/landing-pages" element={<LandingPages />} />
        <Route path="/cmo/leads" element={<LeadsPage />} />

        {/* Platform admin QA routes require auth (otherwise invoke has no JWT and looks like "failed to grab") */}
        <Route
          path="/platform-admin"
          element={
            <ProtectedRoute>
              <PlatformAdmin />
            </ProtectedRoute>
          }
        />
        <Route
          path="/platform-admin/qa/tenant-isolation"
          element={
            <ProtectedRoute>
              <TenantIsolationQA />
            </ProtectedRoute>
          }
        />
        <Route
          path="/platform-admin/qa/execution-cert"
          element={
            <ProtectedRoute>
              <ExecutionCertQA />
            </ProtectedRoute>
          }
        />
        <Route
          path="/platform-admin/slo"
          element={
            <ProtectedRoute>
              <SLODashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/platform-admin/rate-limits"
          element={
            <ProtectedRoute>
              <TenantRateLimits />
            </ProtectedRoute>
          }
        />
        <Route
          path="/platform-admin/rollout"
          element={
            <ProtectedRoute>
              <RolloutPlan />
            </ProtectedRoute>
          }
        />

        <Route path="/profile" element={<Profile />} />
        <Route path="/privacy" element={<Privacy />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
      <AIChatWidget />
      {hasCheckedOnboarding && !isAuthRoute && shouldShowWelcome && (
        <WelcomeModal onStartTour={handleStartTour} />
      )}
      <SpotlightTour isOpen={showTour} onComplete={handleTourComplete} />
    </>
  );
};

const App = () => {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <WorkspaceProvider>
            <CMOProvider>
              <TooltipProvider>
                <Toaster />
                <Sonner />
                <BrowserRouter>
                  <AppContent />
                </BrowserRouter>
              </TooltipProvider>
            </CMOProvider>
          </WorkspaceProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
