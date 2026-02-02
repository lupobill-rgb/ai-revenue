import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SummaryInput {
  tenant_id: string;
  week_start?: string;
  week_end?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const input: SummaryInput = await req.json();
    
    if (!input.tenant_id) {
      return new Response(JSON.stringify({ error: 'tenant_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Calculate week dates if not provided
    const now = new Date();
    const weekStart = input.week_start || new Date(now.setDate(now.getDate() - now.getDay())).toISOString().split('T')[0];
    const weekEnd = input.week_end || new Date(new Date(weekStart).setDate(new Date(weekStart).getDate() + 6)).toISOString().split('T')[0];

    // Fetch metrics for the week
    const { data: metrics, error: metricsError } = await supabase
      .from('cmo_metrics_snapshots')
      .select('*')
      .eq('tenant_id', input.tenant_id)
      .gte('snapshot_date', weekStart)
      .lte('snapshot_date', weekEnd);

    if (metricsError) {
      console.error('Error fetching metrics:', metricsError);
    }

    // Fetch campaigns for context
    const { data: campaigns, error: campaignsError } = await supabase
      .from('cmo_campaigns')
      .select('*')
      .eq('tenant_id', input.tenant_id)
      .eq('status', 'active');

    if (campaignsError) {
      console.error('Error fetching campaigns:', campaignsError);
    }

    // Fetch content assets
    const { data: content, error: contentError } = await supabase
      .from('cmo_content_assets')
      .select('*')
      .eq('tenant_id', input.tenant_id)
      .gte('created_at', weekStart);

    if (contentError) {
      console.error('Error fetching content:', contentError);
    }

    // Aggregate metrics
    const metricsSummary = {
      total_impressions: (metrics || []).reduce((sum, m) => sum + (m.impressions || 0), 0),
      total_clicks: (metrics || []).reduce((sum, m) => sum + (m.clicks || 0), 0),
      total_conversions: (metrics || []).reduce((sum, m) => sum + (m.conversions || 0), 0),
      total_cost: (metrics || []).reduce((sum, m) => sum + parseFloat(m.cost || '0'), 0),
      total_revenue: (metrics || []).reduce((sum, m) => sum + parseFloat(m.revenue || '0'), 0),
      avg_engagement_rate: (metrics || []).length > 0 
        ? (metrics || []).reduce((sum, m) => sum + parseFloat(m.engagement_rate || '0'), 0) / metrics!.length 
        : 0
    };

    let aiSummary = null;

    // Generate AI summary if API key available
    if (LOVABLE_API_KEY) {
      try {
        const prompt = `Analyze this week's marketing performance and provide a concise executive summary:

Metrics:
- Impressions: ${metricsSummary.total_impressions}
- Clicks: ${metricsSummary.total_clicks}
- Conversions: ${metricsSummary.total_conversions}
- Cost: $${metricsSummary.total_cost.toFixed(2)}
- Revenue: $${metricsSummary.total_revenue.toFixed(2)}
- Avg Engagement Rate: ${(metricsSummary.avg_engagement_rate * 100).toFixed(2)}%

Active Campaigns: ${(campaigns || []).length}
New Content Pieces: ${(content || []).length}

Provide:
1. Executive summary (2-3 sentences)
2. Key wins (3 bullet points)
3. Challenges (2-3 bullet points)
4. Recommendations for next week (3 bullet points)

Return as JSON with keys: executive_summary, key_wins, challenges, recommendations`;

        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              { role: 'system', content: 'You are a marketing analytics expert. Provide actionable insights.' },
              { role: 'user', content: prompt }
            ],
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const content = aiData.choices?.[0]?.message?.content;
          if (content) {
            try {
              const jsonMatch = content.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                aiSummary = JSON.parse(jsonMatch[0]);
              }
            } catch (parseError) {
              console.error('Error parsing AI response:', parseError);
            }
          }
        }
      } catch (aiError) {
        console.error('AI summary generation error:', aiError);
      }
    }

    // Insert weekly summary
    const { data: summary, error: summaryError } = await supabase
      .from('cmo_weekly_summaries')
      .insert({
        tenant_id: input.tenant_id,
        tenant_id: input.tenant_id,
        week_start: weekStart,
        week_end: weekEnd,
        executive_summary: aiSummary?.executive_summary || `Week of ${weekStart}: ${metricsSummary.total_impressions} impressions, ${metricsSummary.total_conversions} conversions`,
        key_wins: aiSummary?.key_wins || [],
        challenges: aiSummary?.challenges || [],
        metrics_summary: metricsSummary,
        top_performing_content: [],
        recommendations: aiSummary?.recommendations || [],
        next_week_priorities: []
      })
      .select()
      .single();

    if (summaryError) {
      console.error('Error creating summary:', summaryError);
      return new Response(JSON.stringify({ error: summaryError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Log agent run
    await supabase.from('agent_runs').insert({
      tenant_id: input.tenant_id,
      tenant_id: input.tenant_id,
      agent: 'cmo-summarize-weekly',
      mode: 'summarize',
      input: input,
      output: summary,
      status: 'completed'
    });

    console.log('Weekly summary created:', summary.id);

    return new Response(JSON.stringify({ success: true, summary }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('cmo-summarize-weekly error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
