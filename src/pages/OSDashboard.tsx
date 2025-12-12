import { useState, useEffect } from "react";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import ProtectedRoute from "@/components/ProtectedRoute";
import { supabase } from "@/integrations/supabase/client";
import TargetsGuardrailsPanel from "@/components/os/TargetsGuardrailsPanel";
import LiveRevenueSpinePanel from "@/components/os/LiveRevenueSpinePanel";
import OSActionsPanel from "@/components/os/OSActionsPanel";
import { Zap } from "lucide-react";

export default function OSDashboard() {
  const [tenantId, setTenantId] = useState<string | null>(null);

  useEffect(() => {
    const fetchTenant = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get tenant from user_tenants
      const { data: userTenant } = await supabase
        .from("user_tenants")
        .select("tenant_id")
        .eq("user_id", user.id)
        .single();

      if (userTenant) {
        setTenantId(userTenant.tenant_id);
      }
    };

    fetchTenant();
  }, []);

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background flex flex-col">
        <NavBar />
        <main className="flex-1 container py-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-primary/10 gold-glow">
                <Zap className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-bold font-display tracking-tight">
                  Revenue OS
                </h1>
                <p className="text-muted-foreground mt-1">
                  One unified system optimizing your entire revenue engine
                </p>
              </div>
            </div>
          </div>

          {/* Three Panel Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Panel 1: Targets & Guardrails */}
            <TargetsGuardrailsPanel tenantId={tenantId} />

            {/* Panel 2: Live Revenue Spine */}
            <LiveRevenueSpinePanel tenantId={tenantId} />

            {/* Panel 3: OS Actions & Experiments */}
            <OSActionsPanel tenantId={tenantId} />
          </div>
        </main>
        <Footer />
      </div>
    </ProtectedRoute>
  );
}
