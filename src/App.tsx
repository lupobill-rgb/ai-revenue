import { useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth";
import WelcomeModal from "./components/WelcomeModal";
import ProductTour from "./components/ProductTour";
import AIChatWidget from "./components/AIChatWidget";
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
import SystemBanner from "./components/SystemBanner";
const queryClient = new QueryClient();

const App = () => {
  const [showTour, setShowTour] = useState(false);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
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
              <Route path="/outbound/campaigns/new" element={<OutboundCampaignBuilder />} />
              <Route path="/outbound/campaigns/:id" element={<OutboundCampaignDetail />} />
              <Route path="/outbound/linkedin-queue" element={<OutboundLinkedInQueue />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/settings/integrations" element={<SettingsIntegrations />} />
              <Route path="/landing-pages" element={<LandingPages />} />
              <Route path="/cmo/leads" element={<LeadsPage />} />
              <Route path="/platform-admin" element={<PlatformAdmin />} />
              <Route path="/profile" element={<Profile />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            <AIChatWidget />
            <WelcomeModal onStartTour={() => setShowTour(true)} />
            <ProductTour forceShow={showTour} onComplete={() => setShowTour(false)} />
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
