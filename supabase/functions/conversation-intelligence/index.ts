import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ConversationRequest {
  action: "analyze_notes" | "extract_insights" | "generate_summary";
  leadId: string;
  conversationText?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, leadId, conversationText } = await req.json() as ConversationRequest;

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Fetch lead details
    const { data: lead, error: leadError } = await supabaseClient
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .single();

    if (leadError || !lead) throw new Error("Lead not found");

    // Fetch all activities with notes
    const { data: activities } = await supabaseClient
      .from("lead_activities")
      .select("*")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false });

    if (action === "analyze_notes") {
      const allNotes = [
        lead.notes || "",
        ...(activities || []).map(a => a.description || ""),
        conversationText || "",
      ].filter(Boolean).join("\n\n---\n\n");

      const prompt = `Analyze these sales conversation notes and extract intelligence.

LEAD CONTEXT:
- Name: ${lead.first_name} ${lead.last_name}
- Company: ${lead.company || "Unknown"}
- Title: ${lead.job_title || "Unknown"}
- Industry: ${lead.vertical || "Unknown"}

CONVERSATION NOTES:
${allNotes}

Provide a JSON response with:
1. sentiment: "positive" | "neutral" | "negative"
2. sentiment_score: -100 to 100
3. buying_signals: array of detected buying intent signals
4. objections: array of raised concerns/objections
5. pain_points: identified business challenges
6. decision_makers: mentioned stakeholders and their roles
7. budget_indicators: any budget/pricing discussions
8. timeline_indicators: urgency and timing mentions
9. competitors_mentioned: any competitive references
10. next_steps_discussed: agreed or suggested follow-ups
11. key_quotes: important verbatim quotes
12. relationship_strength: assessment of rapport
13. deal_stage_recommendation: suggested pipeline stage
14. follow_up_topics: topics to address in next conversation`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: "You are an expert sales conversation analyst. Extract actionable intelligence from sales conversations. Always respond with valid JSON." },
            { role: "user", content: prompt }
          ],
        }),
      });

      if (!response.ok) throw new Error("AI analysis failed");

      const aiData = await response.json();
      const analysisText = aiData.choices[0].message.content;
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      const analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

      // Log the analysis
      const { data: { user } } = await supabaseClient.auth.getUser();
      await supabaseClient.from("lead_activities").insert({
        lead_id: leadId,
        activity_type: "conversation_analyzed",
        description: `AI analyzed conversation: ${analysis.sentiment} sentiment, ${analysis.buying_signals?.length || 0} buying signals detected`,
        created_by: user?.id,
        metadata: { sentiment: analysis.sentiment, buying_signals_count: analysis.buying_signals?.length || 0 },
      });

      return new Response(
        JSON.stringify({ success: true, analysis }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "extract_insights") {
      // Analyze patterns across all activities
      const activitySummary = (activities || []).reduce((acc, a) => {
        acc[a.activity_type] = (acc[a.activity_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const prompt = `Extract strategic insights from this lead's engagement history.

LEAD PROFILE:
- Name: ${lead.first_name} ${lead.last_name}
- Company: ${lead.company || "Unknown"}
- Status: ${lead.status}
- Score: ${lead.score}/100
- Tags: ${(lead.tags || []).join(", ") || "None"}

ACTIVITY SUMMARY:
${JSON.stringify(activitySummary, null, 2)}

RECENT ACTIVITIES:
${(activities || []).slice(0, 20).map(a => `[${new Date(a.created_at).toLocaleDateString()}] ${a.activity_type}: ${a.description}`).join('\n')}

Provide a JSON response with:
1. engagement_pattern: description of how this lead engages
2. best_contact_times: inferred optimal outreach times
3. preferred_channels: most effective communication channels
4. interest_level: 1-10 with explanation
5. decision_timeline: estimated purchase timeline
6. stakeholder_mapping: identified influencers/decision makers
7. competitive_position: where we stand vs alternatives
8. value_proposition_fit: how well our solution matches needs
9. risk_assessment: likelihood of deal falling through
10. personalization_tips: specific approaches for this lead
11. conversation_starters: topics that resonate with this lead
12. success_predictors: factors indicating likely conversion`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: "You are an expert sales intelligence analyst. Extract strategic insights from lead engagement data. Always respond with valid JSON." },
            { role: "user", content: prompt }
          ],
        }),
      });

      if (!response.ok) throw new Error("AI analysis failed");

      const aiData = await response.json();
      const insightsText = aiData.choices[0].message.content;
      const jsonMatch = insightsText.match(/\{[\s\S]*\}/);
      const insights = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

      return new Response(
        JSON.stringify({ success: true, insights }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "generate_summary") {
      const prompt = `Generate an executive summary of this lead for a sales manager.

LEAD:
- Name: ${lead.first_name} ${lead.last_name}
- Company: ${lead.company || "Unknown"}
- Title: ${lead.job_title || "Unknown"}
- Industry: ${lead.vertical || "Unknown"}
- Status: ${lead.status}
- Score: ${lead.score}/100
- Source: ${lead.source}
- Created: ${new Date(lead.created_at).toLocaleDateString()}

NOTES:
${lead.notes || "No notes"}

ACTIVITY TIMELINE:
${(activities || []).slice(0, 15).map(a => `- ${a.activity_type}: ${a.description}`).join('\n')}

Provide a JSON response with:
1. executive_summary: 2-3 sentence overview
2. opportunity_assessment: deal potential evaluation
3. current_status: where we are in the sales process
4. key_interactions: most significant touchpoints
5. relationship_health: assessment of engagement quality
6. next_best_action: single most important next step
7. manager_notes: insights for sales leadership
8. deal_probability: % chance of closing`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: "You are an expert sales analyst. Generate concise executive summaries for sales leadership. Always respond with valid JSON." },
            { role: "user", content: prompt }
          ],
        }),
      });

      if (!response.ok) throw new Error("AI summary failed");

      const aiData = await response.json();
      const summaryText = aiData.choices[0].message.content;
      const jsonMatch = summaryText.match(/\{[\s\S]*\}/);
      const summary = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

      return new Response(
        JSON.stringify({ success: true, summary }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error("Invalid action");
  } catch (error) {
    console.error("Error in conversation-intelligence:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
