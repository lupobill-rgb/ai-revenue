import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    // Support leadId from body (supabase.functions.invoke) or query param
    let leadId: string | null = null;
    
    if (req.method === "POST") {
      const body = await req.json();
      leadId = body.leadId;
    } else {
      const url = new URL(req.url);
      leadId = url.searchParams.get("leadId");
    }

    if (!leadId) {
      return new Response(
        JSON.stringify({ error: "Missing lead ID" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const leadIdParam = leadId;

    // Fetch lead with contact info
    const { data: lead, error: leadError } = await supabase
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
      .eq("id", leadIdParam)
      .single();

    if (leadError || !lead) {
      console.error("[ai-cmo-lead-activities] Lead not found:", leadError);
      return new Response(
        JSON.stringify({ error: "Lead not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch campaign info if exists
    let campaign = null;
    if (lead.campaign_id) {
      const { data: campaignData } = await supabase
        .from("campaigns")
        .select("id, asset_id, assets!inner(name)")
        .eq("id", lead.campaign_id)
        .single();

      if (campaignData) {
        campaign = {
          id: campaignData.id,
          name: (campaignData as any).assets?.name || null,
        };
      }
    }

    // Fetch all activities for this lead
    const { data: activities, error: activitiesError } = await supabase
      .from("crm_activities")
      .select("id, activity_type, created_at, meta")
      .eq("lead_id", leadIdParam)
      .order("created_at", { ascending: false });

    if (activitiesError) {
      console.error("[ai-cmo-lead-activities] Failed to fetch activities:", activitiesError);
    }

    // Build response
    const contact = lead.crm_contacts as any;
    const response = {
      lead: {
        id: lead.id,
        status: lead.status,
        score: lead.score || 0,
        source: lead.source,
        notes: lead.notes,
        createdAt: lead.created_at,
      },
      contact: {
        id: contact?.id || lead.contact_id,
        firstName: contact?.first_name || null,
        lastName: contact?.last_name || null,
        email: contact?.email || "",
        phone: contact?.phone || null,
        companyName: contact?.company || null,
        roleTitle: contact?.job_title || null,
        status: contact?.status || null,
        lifecycleStage: contact?.lifecycle_stage || null,
        segmentCode: contact?.segment_code || null,
      },
      campaign,
      activities: (activities || []).map((act: any) => ({
        id: act.id,
        type: act.activity_type,
        createdAt: act.created_at,
        meta: act.meta || {},
      })),
    };

    console.log(`[ai-cmo-lead-activities] Returning lead ${leadIdParam} with ${response.activities.length} activities`);

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[ai-cmo-lead-activities] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
