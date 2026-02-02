import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-secret',
};

// Internal secret for cron/orchestration calls
const INTERNAL_SECRET = Deno.env.get('INTERNAL_FUNCTION_SECRET') || 'ubigrowth-internal-2024';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify internal secret header - blocks direct frontend calls
    const internalSecret = req.headers.get('x-internal-secret');
    if (internalSecret !== INTERNAL_SECRET) {
      console.error('[email-sequence] Invalid or missing x-internal-secret header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Internal functions require secret header' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { tenantId, internal } = await req.json();

    // Double-check this is an internal call
    if (!internal) {
      return new Response(
        JSON.stringify({ error: 'This function is for internal use only' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Require tenantId for tenant isolation
    if (!tenantId) {
      return new Response(
        JSON.stringify({ error: 'tenantId is required for tenant isolation' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`[email-sequence] Processing sequences for tenant ${tenantId}...`);

    // Fetch tenant info for email sender context
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id, name, owner_id')
      .eq('id', tenantId)
      .single();

    // Fetch business profile for this tenant's owner
    let businessName = tenant?.name || 'Marketing';
    let fromEmail = 'campaigns@ubigrowth.com'; // Default fallback
    
    if (tenant?.owner_id) {
      const { data: profile } = await supabase
        .from('business_profiles')
        .select('business_name')
        .eq('user_id', tenant.owner_id)
        .maybeSingle();
      
      if (profile?.business_name) {
        businessName = profile.business_name;
      }
    }

    // Fetch email campaigns that need follow-ups - SCOPED BY TENANT
    const { data: campaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select('*, assets!inner(*), campaign_metrics(*)')
      .eq('tenant_id', tenantId)
      .eq('channel', 'email')
      .eq('status', 'active');

    if (campaignsError) {
      console.error('Error fetching campaigns:', campaignsError);
      throw campaignsError;
    }

    console.log(`Found ${campaigns?.length || 0} active email campaigns`);

    const sequenceResults = [];

    for (const campaign of campaigns || []) {
      const asset = campaign.assets;
      const metrics = campaign.campaign_metrics[0];

      if (!metrics) continue;

      // Calculate days since deployment
      const deployedDate = new Date(campaign.deployed_at);
      const now = new Date();
      const daysSinceDeployment = Math.floor((now.getTime() - deployedDate.getTime()) / (1000 * 60 * 60 * 24));

      // Sequence logic based on engagement
      const openRate = metrics.open_count / metrics.sent_count;
      const clickRate = metrics.clicks / metrics.sent_count;

      let shouldSendFollowUp = false;
      let followUpType = '';

      // Day 3: Send reminder to non-openers
      if (daysSinceDeployment === 3 && openRate < 0.3) {
        shouldSendFollowUp = true;
        followUpType = 'reminder';
      }

      // Day 7: Send value-add content to openers who didn't click
      if (daysSinceDeployment === 7 && openRate > 0.3 && clickRate < 0.1) {
        shouldSendFollowUp = true;
        followUpType = 'value_add';
      }

      // Day 14: Final touchpoint for engaged but non-converting
      if (daysSinceDeployment === 14 && clickRate > 0.1 && (metrics.conversions || 0) === 0) {
        shouldSendFollowUp = true;
        followUpType = 'final_touch';
      }

      if (!shouldSendFollowUp) continue;

      console.log(`Sending ${followUpType} follow-up for campaign ${campaign.id}`);

      // Get recipients from original campaign
      const content = asset.content || {};
      const recipients = content.recipients || [];

      // Filter recipients based on engagement
      let targetRecipients = recipients;
      
      if (followUpType === 'reminder') {
        // Target non-openers (this is simplified - in production, track per-recipient)
        targetRecipients = recipients.slice(0, Math.floor(recipients.length * (1 - openRate)));
      }

      // Generate follow-up content based on type and vertical
      const followUpContent = generateFollowUpContent(
        followUpType,
        asset.content?.vertical || '',
        content.subject_line || '',
        content.email_body || ''
      );

      let sentCount = 0;
      let failedCount = 0;

      // Send follow-up emails with dynamic sender
      for (const recipient of targetRecipients) {
        try {
          const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: `${businessName} Marketing <${fromEmail}>`,
              to: [recipient.email],
              subject: followUpContent.subject,
              html: followUpContent.body,
              tags: [
                { name: 'campaign_id', value: campaign.id },
                { name: 'sequence_type', value: followUpType },
                { name: 'tenant_id', value: tenantId },
              ],
            }),
          });

          if (response.ok) {
            sentCount++;
          } else {
            failedCount++;
          }
        } catch (error) {
          console.error(`Failed to send to ${recipient.email}:`, error);
          failedCount++;
        }
      }

      // Update campaign metrics - already scoped by campaign_id
      await supabase
        .from('campaign_metrics')
        .update({
          sent_count: metrics.sent_count + sentCount,
        })
        .eq('campaign_id', campaign.id);

      sequenceResults.push({
        campaignId: campaign.id,
        followUpType,
        sentCount,
        failedCount,
      });
    }

    console.log(`[email-sequence] Tenant ${tenantId}: processed ${sequenceResults.length} sequences`);

    return new Response(
      JSON.stringify({
        success: true,
        tenantId,
        sequencesProcessed: sequenceResults.length,
        results: sequenceResults,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in email-sequence:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function generateFollowUpContent(type: string, vertical: string, originalSubject: string, originalBody: string) {
  const verticalContext: Record<string, any> = {
    'hotels_resorts': {
      reminder: {
        subject: `⏰ Don't Miss Out: ${originalSubject}`,
        bodyIntro: 'We noticed you might have missed our previous message about enhancing your guest experience.',
      },
      value_add: {
        subject: '5 Ways to Increase Guest Satisfaction & Revenue',
        bodyIntro: 'Since you showed interest, here are proven strategies specifically for hospitality leaders.',
      },
      final_touch: {
        subject: 'Final Chance: Exclusive Offer for Hotel Managers',
        bodyIntro: 'This is your last opportunity to access our special program for resort professionals.',
      },
    },
    'multifamily_real_estate': {
      reminder: {
        subject: `Reminder: ${originalSubject}`,
        bodyIntro: 'In case you missed it - here\'s how to boost occupancy and resident retention.',
      },
      value_add: {
        subject: 'Property Management Best Practices for 2025',
        bodyIntro: 'Exclusive insights for multifamily property managers looking to maximize NOI.',
      },
      final_touch: {
        subject: 'Last Call: Transform Your Property Marketing',
        bodyIntro: 'Final opportunity to discover our proven leasing acceleration strategies.',
      },
    },
    'gyms': {
      reminder: {
        subject: `⏰ Reminder: ${originalSubject}`,
        bodyIntro: 'Don\'t let this opportunity to grow your member base slip away.',
      },
      value_add: {
        subject: 'Member Retention Strategies That Actually Work',
        bodyIntro: 'Since you\'re focused on growth, here are tactics proven in 500+ fitness facilities.',
      },
      final_touch: {
        subject: 'Final Offer: Gym Marketing Made Simple',
        bodyIntro: 'Last chance to access our automated member acquisition system.',
      },
    },
  };

  const context = verticalContext[vertical] || {
    reminder: {
      subject: `Reminder: ${originalSubject}`,
      bodyIntro: 'We wanted to follow up on our previous message.',
    },
    value_add: {
      subject: 'Additional Resources for Your Business',
      bodyIntro: 'Based on your interests, here are some valuable insights.',
    },
    final_touch: {
      subject: 'Final Opportunity',
      bodyIntro: 'This is your last chance to take advantage of this offer.',
    },
  };

  const selectedContext = context[type] || context.reminder;

  return {
    subject: selectedContext.subject,
    body: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <p>${selectedContext.bodyIntro}</p>
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;" />
        <div style="color: #666;">
          ${originalBody}
        </div>
        <div style="margin-top: 30px; padding: 20px; background: #f9f9f9; border-left: 4px solid #0066cc;">
          <p style="margin: 0; color: #333;">
            <strong>Ready to get started?</strong><br/>
            Reply to this email or schedule a quick call to discuss your specific needs.
          </p>
        </div>
      </div>
    `,
  };
}
