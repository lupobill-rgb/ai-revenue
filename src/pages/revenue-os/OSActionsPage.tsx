import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import OSActionsPanel from "@/components/os/OSActionsPanel";

export default function OSActionsPage() {
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
        <h2 className="text-2xl font-bold font-display">OS Actions & Experiments</h2>
        <p className="text-muted-foreground mt-1">
          AI-generated optimization actions and experiments running across your revenue engine
        </p>
      </div>
      <OSActionsPanel tenantId={tenantId} />
    </div>
  );
}
