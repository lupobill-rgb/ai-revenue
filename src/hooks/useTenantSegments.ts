import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface TenantSegment {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  description: string | null;
  color: string;
  sort_order: number;
  is_active: boolean;
}

export function useTenantSegments() {
  const [segments, setSegments] = useState<TenantSegment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSegments();
  }, []);

  const fetchSegments = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("tenant_segments")
      .select("*")
      .eq("is_active", true)
      .order("sort_order");

    if (error) {
      setError(error.message);
    } else {
      setSegments(data || []);
    }
    setLoading(false);
  };

  const updateContactSegment = async (contactId: string, segmentCode: string | null) => {
    const { error } = await supabase
      .from("crm_contacts")
      .update({ segment_code: segmentCode })
      .eq("id", contactId);

    return { error };
  };

  const getSegmentByCode = (code: string | null) => {
    if (!code) return null;
    return segments.find(s => s.code === code) || null;
  };

  return {
    segments,
    loading,
    error,
    refetch: fetchSegments,
    updateContactSegment,
    getSegmentByCode
  };
}
