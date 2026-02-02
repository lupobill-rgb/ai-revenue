import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { verifyAuth, unauthorizedResponse, createServiceClient } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ScheduleConfig {
  days: {
    monday: boolean;
    tuesday: boolean;
    wednesday: boolean;
    thursday: boolean;
    friday: boolean;
    saturday: boolean;
    sunday: boolean;
  };
  timesOfDay: ("morning" | "midday" | "afternoon" | "evening")[];
  // Legacy support for single timeOfDay
  timeOfDay?: "morning" | "midday" | "afternoon" | "evening";
  timezone: string;
}

// Map timeOfDay to hour ranges
const TIME_SLOT_HOURS: Record<string, number> = {
  morning: 9,    // 9 AM
  midday: 12,    // 12 PM
  afternoon: 15, // 3 PM
  evening: 18,   // 6 PM
};

// Map day names to day index (0 = Sunday)
const DAY_INDEX: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

// Get the next N scheduled dates based on schedule config
function getNextScheduledDates(schedule: ScheduleConfig, count: number = 7): Date[] {
  const dates: Date[] = [];
  const now = new Date();
  
  // Support both timesOfDay array and legacy timeOfDay single value
  const targetTimes = schedule.timesOfDay?.length 
    ? schedule.timesOfDay 
    : (schedule.timeOfDay ? [schedule.timeOfDay] : ["midday"]);
  
  // Get enabled days
  const enabledDays: number[] = [];
  for (const [day, enabled] of Object.entries(schedule.days)) {
    if (enabled) {
      enabledDays.push(DAY_INDEX[day]);
    }
  }
  
  if (enabledDays.length === 0) {
    console.log("[schedule-outbox] No days enabled in schedule");
    return dates;
  }
  
  // Start from today
  let checkDate = new Date(now);
  checkDate.setHours(0, 0, 0, 0);
  
  let daysChecked = 0;
  const maxDaysToCheck = 30; // Look up to 30 days ahead
  
  while (dates.length < count && daysChecked < maxDaysToCheck) {
    const dayOfWeek = checkDate.getDay();
    
    if (enabledDays.includes(dayOfWeek)) {
      // Add a date for each selected time slot
      for (const timeSlot of targetTimes) {
        const targetHour = TIME_SLOT_HOURS[timeSlot] || 12;
        const slotDate = new Date(checkDate);
        slotDate.setHours(targetHour, 0, 0, 0);
        
        // Only add future times
        if (slotDate > now) {
          dates.push(new Date(slotDate));
        }
      }
    }
    
    checkDate.setDate(checkDate.getDate() + 1);
    checkDate.setHours(0, 0, 0, 0);
    daysChecked++;
    
    // Stop if we have enough dates
    if (dates.length >= count * targetTimes.length) break;
  }
  
  // Sort by date and limit
  return dates.sort((a, b) => a.getTime() - b.getTime()).slice(0, count * targetTimes.length);
}

// Generate idempotency key
async function generateIdempotencyKey(parts: string[]): Promise<string> {
  const data = parts.filter(Boolean).join("|");
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { campaignId, daysToSchedule = 7 } = await req.json();

    if (!campaignId) {
      throw new Error("Campaign ID is required");
    }

    const { user, error: authError, supabaseClient } = await verifyAuth(req);
    if (authError || !user || !supabaseClient) {
      return unauthorizedResponse(corsHeaders, authError || "Not authenticated");
    }

    const serviceClient = createServiceClient();

    // Fetch campaign with schedule and targeting
    const { data: campaign, error: campaignError } = await supabaseClient
      .from("campaigns")
      .select("*, assets(*), target_tags, target_segment_codes")
      .eq("id", campaignId)
      .single();

    if (campaignError || !campaign) {
      throw new Error("Campaign not found");
    }

    if (!campaign.schedule) {
      throw new Error("Campaign has no schedule configured");
    }

    const schedule = campaign.schedule as ScheduleConfig;
    const asset = campaign.assets;
    
    if (!asset) {
      throw new Error("Campaign asset not found");
    }

    console.log(`[schedule-outbox] Processing campaign ${campaignId} with schedule:`, schedule);

    // Get next scheduled dates
    const scheduledDates = getNextScheduledDates(schedule, daysToSchedule);
    
    if (scheduledDates.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No dates to schedule", entriesCreated: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[schedule-outbox] Scheduling for dates:`, scheduledDates.map(d => d.toISOString()));

    // Get recipients from asset content
    const assetContent = asset.content as any;
    let targetLeads = assetContent?.target_leads || [];
    
    // If no target leads in asset, fetch from tenant with campaign targeting filters
    if (targetLeads.length === 0 && campaign.tenant_id) {
      // Build query with campaign targeting filters (tags + segments)
      let leadsQuery = supabaseClient
        .from("leads")
        .select("id, first_name, last_name, email, company, tags, segment_code")
        .eq("tenant_id", campaign.tenant_id)
        .not("email", "is", null)
        .in("status", ["new", "contacted", "qualified"]);
      
      // Apply target_tags filter (AND - lead must have at least one matching tag)
      if (campaign.target_tags && Array.isArray(campaign.target_tags) && campaign.target_tags.length > 0) {
        leadsQuery = leadsQuery.overlaps("tags", campaign.target_tags);
        console.log(`[schedule-outbox] Filtering by tags: ${campaign.target_tags.join(", ")}`);
      }
      
      // Apply target_segment_codes filter (OR - lead segment must match one of the codes)
      if (campaign.target_segment_codes && Array.isArray(campaign.target_segment_codes) && campaign.target_segment_codes.length > 0) {
        leadsQuery = leadsQuery.in("segment_code", campaign.target_segment_codes);
        console.log(`[schedule-outbox] Filtering by segments: ${campaign.target_segment_codes.join(", ")}`);
      }
      
      leadsQuery = leadsQuery.limit(100);
      
      const { data: tenantLeads } = await leadsQuery;
      
      if (tenantLeads) {
        targetLeads = tenantLeads;
        console.log(`[schedule-outbox] Found ${tenantLeads.length} leads matching campaign targeting`);
      }
    }

    if (targetLeads.length === 0) {
      throw new Error("No leads found to schedule emails for");
    }

    const tenantId = campaign.tenant_id || user.id;
    let entriesCreated = 0;
    let entriesSkipped = 0;

    // For each scheduled date, create outbox entries for each recipient
    for (const scheduledDate of scheduledDates) {
      for (const lead of targetLeads) {
        if (!lead.email) continue;

        const idempotencyKey = await generateIdempotencyKey([
          campaignId,
          lead.id || lead.email,
          scheduledDate.toISOString().slice(0, 10), // Date component only
        ]);

        const { error: insertError } = await serviceClient
          .from("channel_outbox")
          .insert({
            tenant_id: tenantId,
            tenant_id: campaign.tenant_id,
            channel: campaign.channel || "email",
            provider: "resend",
            recipient_id: lead.id || null,
            recipient_email: lead.email,
            payload: {
              campaign_id: campaignId,
              asset_id: asset.id,
              subject: assetContent?.subject || asset.name,
              html_body: assetContent?.body || assetContent?.html || "",
              from_address: "onboarding@resend.dev",
              sender_name: "Marketing Team",
            },
            status: "scheduled",
            scheduled_at: scheduledDate.toISOString(),
            idempotency_key: idempotencyKey,
            skipped: false,
          });

        if (insertError) {
          if (insertError.code === "23505") {
            entriesSkipped++;
            continue;
          }
          console.error(`[schedule-outbox] Insert error:`, insertError);
        } else {
          entriesCreated++;
        }
      }
    }

    // Update campaign status to scheduled
    await supabaseClient
      .from("campaigns")
      .update({ status: "scheduled" })
      .eq("id", campaignId);

    console.log(`[schedule-outbox] Created ${entriesCreated} entries, skipped ${entriesSkipped}`);

    return new Response(
      JSON.stringify({
        success: true,
        campaignId,
        entriesCreated,
        entriesSkipped,
        scheduledDates: scheduledDates.map(d => d.toISOString()),
        message: `Scheduled ${entriesCreated} email sends across ${scheduledDates.length} days`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[schedule-outbox] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
