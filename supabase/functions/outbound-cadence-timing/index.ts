import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Default daily limits per channel
const CHANNEL_LIMITS = {
  linkedin_connect: 20,
  linkedin_message: 50,
  email: 100,
};

// Business hours by channel (in local time)
const BUSINESS_HOURS = {
  linkedin: { start: 9, end: 17 },
  email: { start: 8, end: 18 },
};

// Optimal send windows (hours in local time)
const OPTIMAL_WINDOWS = [
  { start: 9, end: 11 },   // Morning
  { start: 14, end: 16 },  // Afternoon
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { 
      tenant_id, 
      workspace_id, 
      last_event_at,
      channel,
      delay_days,
      prospect_timezone,
      custom_limits,
    } = await req.json();

    if (!tenant_id || !workspace_id) {
      return new Response(JSON.stringify({ error: "tenant_id and workspace_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const channelType = channel || "email";
    const delayDays = delay_days || 1;
    const timezone = prospect_timezone || "America/New_York";
    
    // Get today's date in target timezone
    const now = new Date();
    const baseDate = last_event_at ? new Date(last_event_at) : now;
    
    // Add delay days
    let targetDate = new Date(baseDate);
    targetDate.setDate(targetDate.getDate() + delayDays);
    
    // Adjust for weekends
    const dayOfWeek = targetDate.getDay();
    if (dayOfWeek === 0) targetDate.setDate(targetDate.getDate() + 1); // Sunday -> Monday
    if (dayOfWeek === 6) targetDate.setDate(targetDate.getDate() + 2); // Saturday -> Monday
    
    // Avoid Monday morning (move to Tuesday if Monday)
    if (targetDate.getDay() === 1) {
      targetDate.setDate(targetDate.getDate() + 1);
    }
    
    // Pick optimal hour
    const businessHours = BUSINESS_HOURS[channelType as keyof typeof BUSINESS_HOURS] || BUSINESS_HOURS.email;
    const optimalWindow = OPTIMAL_WINDOWS[Math.random() > 0.5 ? 0 : 1];
    const targetHour = optimalWindow.start + Math.floor(Math.random() * (optimalWindow.end - optimalWindow.start));
    const targetMinute = Math.floor(Math.random() * 60); // Jitter
    
    targetDate.setHours(targetHour, targetMinute, 0, 0);
    
    // Get today's send counts for quota check
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    const { data: todaySends, error: countError } = await supabase
      .from("outbound_message_events")
      .select("id, channel")
      .eq("tenant_id", tenant_id)
      .eq("event_type", "sent")
      .gte("occurred_at", todayStart.toISOString());

    if (countError) {
      console.error("Error fetching send counts:", countError);
    }

    // Calculate remaining quota
    const sendCounts = {
      linkedin_connect: 0,
      linkedin_message: 0,
      email: 0,
    };
    
    (todaySends || []).forEach((event: any) => {
      if (event.channel === "linkedin") {
        sendCounts.linkedin_message++;
      } else if (event.channel === "email") {
        sendCounts.email++;
      }
    });

    const limits = { ...CHANNEL_LIMITS, ...custom_limits };
    const quotaRemaining = {
      linkedin_connect: limits.linkedin_connect - sendCounts.linkedin_connect,
      linkedin_message: limits.linkedin_message - sendCounts.linkedin_message,
      email: limits.email - sendCounts.email,
    };

    // Check if we're over quota - defer to next day if so
    const warnings: string[] = [];
    const relevantQuota = channelType === "linkedin" 
      ? quotaRemaining.linkedin_message 
      : quotaRemaining.email;

    if (relevantQuota <= 0) {
      targetDate.setDate(targetDate.getDate() + 1);
      // Re-adjust for weekends
      const newDayOfWeek = targetDate.getDay();
      if (newDayOfWeek === 0) targetDate.setDate(targetDate.getDate() + 1);
      if (newDayOfWeek === 6) targetDate.setDate(targetDate.getDate() + 2);
      warnings.push(`Daily ${channelType} limit reached, deferred to next business day`);
    }

    // Format reasoning
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const reasoning = `${dayNames[targetDate.getDay()]} ${targetHour}:${targetMinute.toString().padStart(2, "0")} ${timezone} - optimal B2B window${warnings.length ? `, ${warnings.join(", ")}` : ""}`;

    const result = {
      next_step_due_at: targetDate.toISOString(),
      reasoning,
      channel_quota_remaining: quotaRemaining,
      warnings,
    };

    // Log agent run
    await supabase.from("agent_runs").insert({
      tenant_id,
      workspace_id,
      agent: "cadence_timing",
      mode: "outbound",
      status: "completed",
      input: { last_event_at, channel, delay_days, prospect_timezone },
      output: result,
      completed_at: new Date().toISOString(),
    });

    return new Response(JSON.stringify({
      success: true,
      agent: "cadence_timing",
      mode: "outbound",
      data: result,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("cadence-timing error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
