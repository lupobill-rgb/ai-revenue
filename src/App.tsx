import { useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth";
import WelcomeModal from "./components/WelcomeModal";
import ProductTour from "./components/ProductTour";
import AIChatWidget from "./components/AIChatWidget";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForcePasswordChange from "./pages/ForcePasswordChange";
import NotFound from "./pages/NotFound";
import Settings from "./pages/Settings";
import SettingsIntegrations from "./pages/SettingsIntegrations";
import RevenueOSLayout from "./layouts/RevenueOSLayout";
import TargetsGuardrailsPage from "./pages/revenue-os/TargetsGuardrailsPage";
import RevenueSpinePage from "./pages/revenue-os/RevenueSpinePage";
import OSActionsPage from "./pages/revenue-os/OSActionsPage";
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
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/change-password" element={<ForcePasswordChange />} />
              
              {/* Revenue OS - the main app with 3 sections */}
              <Route path="/revenue-os" element={<RevenueOSLayout />}>
                <Route index element={<Navigate to="/revenue-os/targets" replace />} />
                <Route path="targets" element={<TargetsGuardrailsPage />} />
                <Route path="spine" element={<RevenueSpinePage />} />
                <Route path="actions" element={<OSActionsPage />} />
                <Route path="settings" element={<Settings />} />
                <Route path="integrations" element={<SettingsIntegrations />} />
              </Route>
              
              {/* Redirect old routes to Revenue OS */}
              <Route path="/dashboard" element={<Navigate to="/revenue-os/spine" replace />} />
              <Route path="/os" element={<Navigate to="/revenue-os/targets" replace />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/settings/integrations" element={<SettingsIntegrations />} />
              
              {/* Catch-all */}
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
