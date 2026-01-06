import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface LeadResponse {
  id: string;
  contactId: string;
  campaignId: string | null;
  status: string;
  score: number;
  source: string | null;
  notes: string | null;
  createdAt: string;
  contact: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    phone: string | null;
    companyName: string | null;
    roleTitle: string | null;
    status: string | null;
    lifecycleStage: string | null;
    segmentCode: string | null;
  };
  campaign: {
    name: string;
  } | null;
  lastActivity: {
    type: string;
    createdAt: string;
  } | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse query params
    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const campaignId = url.searchParams.get("campaignId");
    // Default to 10000 to fetch all leads - can be paginated in the future
    const limit = parseInt(url.searchParams.get("limit") || "10000");
    const offset = parseInt(url.searchParams.get("offset") || "0");

    // Decide which backend table to use.
    // Older CMO flows used crm_leads + crm_contacts (+ crm_activities).
    // Newer CRM imports write directly into public.leads (+ lead_activities).
    const { count: crmLeadsCount } = await supabase
      .from("crm_leads")
      .select("id", { count: "exact", head: true });

    const useCrmSchema = (crmLeadsCount ?? 0) > 0;

    // First, get total count
    let totalCount: number | null = null;
    if (useCrmSchema) {
      let countQuery = supabase
        .from("crm_leads")
        .select("id", { count: "exact", head: true });

      if (status) countQuery = countQuery.eq("status", status);
      if (campaignId) countQuery = countQuery.eq("campaign_id", campaignId);

      const { count, error: countError } = await countQuery;
      totalCount = count ?? null;
      if (countError) {
        console.error("[ai-cmo-leads] Failed to count crm_leads:", countError);
      }
    } else {
      let countQuery = supabase
        .from("leads")
        .select("id", { count: "exact", head: true });

      if (status) countQuery = countQuery.eq("status", status);
      if (campaignId) countQuery = countQuery.eq("campaign_id", campaignId);

      const { count, error: countError } = await countQuery;
      totalCount = count ?? null;
      if (countError) {
        console.error("[ai-cmo-leads] Failed to count leads:", countError);
      }
    }

    // Fetch leads
    let response: LeadResponse[] = [];

    if (useCrmSchema) {
      // Build query for leads with contact join
      let query = supabase
        .from("crm_leads")
        .select(`
          id,
          contact_id,
          campaign_id,
          status,
          score,
          source,
          notes,
          created_at,
          crm_contacts!inner (
            id,
            first_name,
            last_name,
            email,
            phone,
            company,
            job_title,
            status,
            lifecycle_stage,
            segment_code
          )
        `)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (status) query = query.eq("status", status);
      if (campaignId) query = query.eq("campaign_id", campaignId);

      const { data: leads, error: leadsError } = await query;

      if (leadsError) {
        console.error("[ai-cmo-leads] Failed to fetch crm_leads:", leadsError);
        return new Response(
          JSON.stringify({ error: "Failed to fetch leads" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get last activity for each lead
      const leadIds = leads?.map((l: any) => l.id) || [];
      let activitiesMap: Record<string, { type: string; createdAt: string }> = {};

      if (leadIds.length > 0) {
        const { data: activities } = await supabase
          .from("crm_activities")
          .select("lead_id, activity_type, created_at")
          .in("lead_id", leadIds)
          .order("created_at", { ascending: false });

        if (activities) {
          for (const act of activities as any[]) {
            if (!activitiesMap[act.lead_id]) {
              activitiesMap[act.lead_id] = {
                type: act.activity_type,
                createdAt: act.created_at,
              };
            }
          }
        }
      }

      // Get campaign names
      const campaignIds = [...new Set(leads?.map((l: any) => l.campaign_id).filter(Boolean) || [])];
      let campaignNamesMap: Record<string, string> = {};

      if (campaignIds.length > 0) {
        const { data: campaigns } = await supabase
          .from("campaigns")
          .select("id, asset_id, assets!inner(name)")
          .in("id", campaignIds);

        if (campaigns) {
          for (const c of campaigns as any[]) {
            if (c.assets?.name) {
              campaignNamesMap[c.id] = c.assets.name;
            }
          }
        }
      }

      response = (leads || []).map((lead: any) => ({
        id: lead.id,
        contactId: lead.contact_id,
        campaignId: lead.campaign_id,
        status: lead.status,
        score: lead.score || 0,
        source: lead.source,
        notes: lead.notes,
        createdAt: lead.created_at,
        contact: {
          id: lead.crm_contacts?.id || null,
          firstName: lead.crm_contacts?.first_name || null,
          lastName: lead.crm_contacts?.last_name || null,
          email: lead.crm_contacts?.email || "",
          phone: lead.crm_contacts?.phone || null,
          companyName: lead.crm_contacts?.company || null,
          roleTitle: lead.crm_contacts?.job_title || null,
          status: lead.crm_contacts?.status || null,
          lifecycleStage: lead.crm_contacts?.lifecycle_stage || null,
          segmentCode: lead.crm_contacts?.segment_code || null,
        },
        campaign: lead.campaign_id && campaignNamesMap[lead.campaign_id]
          ? { name: campaignNamesMap[lead.campaign_id] }
          : null,
        lastActivity: activitiesMap[lead.id] || null,
      }));
    } else {
      // Fallback: read directly from public.leads
      let query = supabase
        .from("leads")
        .select(`
          id,
          first_name,
          last_name,
          email,
          phone,
          company,
          job_title,
          status,
          score,
          source,
          notes,
          created_at,
          campaign_id,
          segment_code
        `)
        .eq("data_mode", "live")
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (status) query = query.eq("status", status);
      if (campaignId) query = query.eq("campaign_id", campaignId);

      const { data: leads, error: leadsError } = await query;

      if (leadsError) {
        console.error("[ai-cmo-leads] Failed to fetch leads table:", leadsError);
        return new Response(
          JSON.stringify({ error: "Failed to fetch leads" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const normalizeStatus = (s: string): string => {
        if (s === "contacted") return "working";
        if (s === "lost") return "unqualified";
        if (s === "won") return "converted";
        return s;
      };

      // Last activity from lead_activities
      const leadIds = leads?.map((l: any) => l.id) || [];
      let activitiesMap: Record<string, { type: string; createdAt: string }> = {};

      if (leadIds.length > 0) {
        const { data: activities } = await supabase
          .from("lead_activities")
          .select("lead_id, activity_type, created_at")
          .in("lead_id", leadIds)
          .order("created_at", { ascending: false });

        if (activities) {
          for (const act of activities as any[]) {
            if (!activitiesMap[act.lead_id]) {
              activitiesMap[act.lead_id] = {
                type: act.activity_type,
                createdAt: act.created_at,
              };
            }
          }
        }
      }

      // Campaign names
      const campaignIds = [...new Set(leads?.map((l: any) => l.campaign_id).filter(Boolean) || [])];
      let campaignNamesMap: Record<string, string> = {};

      if (campaignIds.length > 0) {
        const { data: campaigns } = await supabase
          .from("campaigns")
          .select("id, asset_id, assets!inner(name)")
          .in("id", campaignIds);

        if (campaigns) {
          for (const c of campaigns as any[]) {
            if (c.assets?.name) {
              campaignNamesMap[c.id] = c.assets.name;
            }
          }
        }
      }

      response = (leads || []).map((lead: any) => ({
        id: lead.id,
        contactId: lead.id,
        campaignId: lead.campaign_id,
        status: normalizeStatus(lead.status),
        score: lead.score || 0,
        source: lead.source,
        notes: lead.notes,
        createdAt: lead.created_at,
        contact: {
          id: lead.id,
          firstName: lead.first_name ?? null,
          lastName: lead.last_name ?? null,
          email: lead.email ?? "",
          phone: lead.phone ?? null,
          companyName: lead.company ?? null,
          roleTitle: lead.job_title ?? null,
          status: null,
          lifecycleStage: null,
          segmentCode: lead.segment_code ?? null,
        },
        campaign: lead.campaign_id && campaignNamesMap[lead.campaign_id]
          ? { name: campaignNamesMap[lead.campaign_id] }
          : null,
        lastActivity: activitiesMap[lead.id] || null,
      }));
    }

    console.log(`[ai-cmo-leads] Returning ${response.length} leads (total: ${totalCount ?? 'unknown'})`);

    return new Response(
      JSON.stringify({ leads: response, total: totalCount ?? response.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

    console.log(`[ai-cmo-leads] Returning ${response.length} leads (total: ${totalCount ?? 'unknown'})`);

    return new Response(
      JSON.stringify({ leads: response, total: totalCount ?? response.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[ai-cmo-leads] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
