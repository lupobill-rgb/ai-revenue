import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import LiveRevenueSpinePanel from "@/components/os/LiveRevenueSpinePanel";

export default function RevenueSpinePage() {
  const [tenantId, setTenantId] = useState<string | null>(null);

  useEffect(() => {
    const fetchTenant = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

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
    <div className="max-w-4xl">
      <div className="mb-6">
        <h2 className="text-2xl font-bold font-display">Revenue Spine</h2>
        <p className="text-muted-foreground mt-1">
          Live metrics, funnel performance, and campaign health across your revenue engine
        </p>
      </div>
      <LiveRevenueSpinePanel tenantId={tenantId} />
    </div>
  );
}
