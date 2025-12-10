import { useEffect, useState, useCallback } from "react";
import { useAuth } from "./useAuth";
import { fetchLeads, fetchLeadDetails, updateLeadStatus } from "@/lib/cmo/apiClient";
import type { LeadRow, LeadDetailsResponse, LeadStatus } from "@/lib/cmo/types";

export function useLeads() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(() => {
    if (!user?.id) return;
    setLoading(true);
    fetchLeads(user.id)
      .then(setLeads)
      .catch((err) => {
        console.error("[useLeads] Failed to fetch leads:", err);
        setLeads([]);
      })
      .finally(() => setLoading(false));
  }, [user?.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { leads, loading, refresh };
}

export function useLeadDetails(leadId: string | null) {
  const { user } = useAuth();
  const [details, setDetails] = useState<LeadDetailsResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user?.id || !leadId) {
      setDetails(null);
      return;
    }
    setLoading(true);
    fetchLeadDetails(user.id, leadId)
      .then(setDetails)
      .catch((err) => {
        console.error("[useLeadDetails] Failed to fetch lead details:", err);
        setDetails(null);
      })
      .finally(() => setLoading(false));
  }, [user?.id, leadId]);

  const changeStatus = useCallback(async (status: LeadStatus) => {
    if (!user?.id || !leadId) return;
    await updateLeadStatus(user.id, leadId, status);
    // Refresh details after status change
    const updated = await fetchLeadDetails(user.id, leadId);
    setDetails(updated);
  }, [user?.id, leadId]);

  return { details, loading, changeStatus };
}
