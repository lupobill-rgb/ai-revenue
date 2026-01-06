import { useEffect, useState, useCallback } from "react";
import { useAuth } from "./useAuth";
import { fetchLeads, fetchLeadDetails, updateLeadStatus } from "@/lib/cmo/apiClient";
import { getTenantContextSafe } from "@/lib/tenant";
import type { LeadRow, LeadDetailsResponse, LeadStatus } from "@/lib/cmo/types";

export function useLeads() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(null);

  // Resolve tenant context on mount
  useEffect(() => {
    if (!user?.id) return;
    getTenantContextSafe().then((ctx) => {
      setTenantId(ctx.tenantId);
    });
  }, [user?.id]);

  const refresh = useCallback(() => {
    if (!tenantId) return;
    setLoading(true);
    fetchLeads(tenantId)
      .then((result) => {
        setLeads(result.leads);
        setTotalCount(result.total);
      })
      .catch((err) => {
        console.error("[useLeads] Failed to fetch leads:", err);
        setLeads([]);
        setTotalCount(0);
      })
      .finally(() => setLoading(false));
  }, [tenantId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { leads, totalCount, loading, refresh };
}

export function useLeadDetails(leadId: string | null) {
  const { user } = useAuth();
  const [details, setDetails] = useState<LeadDetailsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(null);

  // Resolve tenant context on mount
  useEffect(() => {
    if (!user?.id) return;
    getTenantContextSafe().then((ctx) => {
      setTenantId(ctx.tenantId);
    });
  }, [user?.id]);

  useEffect(() => {
    if (!tenantId || !leadId) {
      setDetails(null);
      return;
    }
    setLoading(true);
    fetchLeadDetails(tenantId, leadId)
      .then(setDetails)
      .catch((err) => {
        console.error("[useLeadDetails] Failed to fetch lead details:", err);
        setDetails(null);
      })
      .finally(() => setLoading(false));
  }, [tenantId, leadId]);

  const changeStatus = useCallback(async (status: LeadStatus) => {
    if (!tenantId || !leadId) return;
    await updateLeadStatus(tenantId, leadId, status);
    // Refresh details after status change
    const updated = await fetchLeadDetails(tenantId, leadId);
    setDetails(updated);
  }, [tenantId, leadId]);

  return { details, loading, changeStatus };
}
