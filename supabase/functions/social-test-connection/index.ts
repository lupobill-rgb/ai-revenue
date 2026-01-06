import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.84.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Use anon key + user's JWT for RLS enforcement
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { platform } = await req.json();

    console.log(`[social-test-connection] User ${user.id} testing connection for platform: ${platform}`);

    // Fetch the integration for this user and platform
    // Try by user_id first, then by workspace_id (for workspace-scoped integrations)
    let integration = null;
    let fetchError = null;

    // First try by user_id
    const userResult = await supabase
      .from('social_integrations')
      .select('*')
      .eq('user_id', user.id)
      .eq('platform', platform)
      .maybeSingle();

    if (userResult.error) {
      console.error('Error fetching by user_id:', userResult.error);
    }

    integration = userResult.data;

    // If not found by user_id, try to find by workspace membership
    if (!integration) {
      // Get user's workspaces
      const { data: workspaces } = await supabase
        .from('workspaces')
        .select('id')
        .eq('owner_id', user.id);
      
      const { data: memberships } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id);

      const workspaceIds = [
        ...(workspaces?.map(w => w.id) || []),
        ...(memberships?.map(m => m.workspace_id) || [])
      ];

      if (workspaceIds.length > 0) {
        const wsResult = await supabase
          .from('social_integrations')
          .select('*')
          .in('workspace_id', workspaceIds)
          .eq('platform', platform)
          .maybeSingle();

        if (!wsResult.error) {
          integration = wsResult.data;
        }
      }
    }

    if (!integration) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No integration found for this platform. Please save your token first.' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const accessToken = integration.access_token;
    let testResult = { valid: false, message: '', accountInfo: null };

    // Test connection based on platform
    switch (platform) {
      case 'instagram':
        testResult = await testInstagram(accessToken);
        break;
      case 'linkedin':
        testResult = await testLinkedIn(accessToken);
        break;
      case 'facebook':
        testResult = await testFacebook(accessToken);
        break;
      case 'tiktok':
        testResult = await testTikTok(accessToken);
        break;
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }

    console.log(`Test result for ${platform}:`, testResult);

    // Update the integration with validation status - RLS enforced
    const { error: updateError } = await supabase
      .from('social_integrations')
      .update({
        is_active: testResult.valid,
        account_name: testResult.accountInfo || integration.account_name,
        updated_at: new Date().toISOString(),
      })
      .eq('id', integration.id);

    if (updateError) {
      console.error('Failed to update integration:', updateError);
    }

    return new Response(
      JSON.stringify({ 
        success: testResult.valid, 
        message: testResult.message,
        accountInfo: testResult.accountInfo 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in social-test-connection:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function testInstagram(accessToken: string) {
  try {
    const response = await fetch(
      `https://graph.instagram.com/me?fields=id,username,account_type&access_token=${accessToken}`
    );
    
    if (!response.ok) {
      const error = await response.json();
      return { 
        valid: false, 
        message: `Instagram API error: ${error.error?.message || 'Invalid token'}`,
        accountInfo: null 
      };
    }

    const data = await response.json();
    return { 
      valid: true, 
      message: 'Instagram connected successfully',
      accountInfo: data.username || data.id 
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { valid: false, message: `Instagram test failed: ${errorMessage}`, accountInfo: null };
  }
}

async function testLinkedIn(accessToken: string) {
  try {
    const response = await fetch('https://api.linkedin.com/v2/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0'
      }
    });

    if (!response.ok) {
      return { valid: false, message: `LinkedIn API error: ${response.statusText}`, accountInfo: null };
    }

    const data = await response.json();
    const name = `${data.localizedFirstName || ''} ${data.localizedLastName || ''}`.trim();
    return { valid: true, message: 'LinkedIn connected successfully', accountInfo: name || data.id };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { valid: false, message: `LinkedIn test failed: ${errorMessage}`, accountInfo: null };
  }
}

async function testFacebook(accessToken: string) {
  try {
    const response = await fetch(
      `https://graph.facebook.com/me?fields=id,name&access_token=${accessToken}`
    );

    if (!response.ok) {
      const error = await response.json();
      return { valid: false, message: `Facebook API error: ${error.error?.message || 'Invalid token'}`, accountInfo: null };
    }

    const data = await response.json();
    return { valid: true, message: 'Facebook connected successfully', accountInfo: data.name || data.id };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { valid: false, message: `Facebook test failed: ${errorMessage}`, accountInfo: null };
  }
}

async function testTikTok(accessToken: string) {
  try {
    const response = await fetch('https://open.tiktokapis.com/v2/user/info/', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      return { valid: false, message: `TikTok API error: ${response.statusText}`, accountInfo: null };
    }

    const data = await response.json();
    if (data.error?.code) {
      return { valid: false, message: `TikTok error: ${data.error.message}`, accountInfo: null };
    }

    const username = data.data?.user?.display_name || data.data?.user?.username;
    return { valid: true, message: 'TikTok connected successfully', accountInfo: username };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { valid: false, message: `TikTok test failed: ${errorMessage}`, accountInfo: null };
  }
}
