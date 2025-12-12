import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface SequenceStatus {
  isPaused: boolean;
  pausedAt: string | null;
  loading: boolean;
}

export function useLeadSequenceStatus(leadId: string | undefined): SequenceStatus & { refetch: () => void } {
  const [status, setStatus] = useState<SequenceStatus>({
    isPaused: false,
    pausedAt: null,
    loading: true,
  });

  const fetchStatus = async () => {
    if (!leadId) {
      setStatus({ isPaused: false, pausedAt: null, loading: false });
      return;
    }

    try {
      // Find sequence runs via prospect linked to this lead
      const { data, error } = await supabase
        .from("outbound_sequence_runs")
        .select(`
          id,
          status,
          updated_at,
          prospects!inner(lead_id)
        `)
        .eq("prospects.lead_id", leadId)
        .eq("status", "paused")
        .limit(1)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        console.error("Error fetching sequence status:", error);
      }

      setStatus({
        isPaused: !!data,
        pausedAt: data?.updated_at || null,
        loading: false,
      });
    } catch (error) {
      console.error("Error fetching sequence status:", error);
      setStatus({ isPaused: false, pausedAt: null, loading: false });
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [leadId]);

  return { ...status, refetch: fetchStatus };
}
