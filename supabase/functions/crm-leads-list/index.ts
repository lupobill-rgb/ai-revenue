// CRM Leads List API - Returns leads with total count
// Master Prompt v3: Edge function returns { leads: Lead[]; total: number }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LeadsListRequest {
  tenant_id: string;
  limit?: number;
  offset?: number;
  status_filter?: string;
  search_query?: string;
  sort_field?: 'created_at' | 'first_name' | 'company' | 'score' | 'status';
  sort_order?: 'asc' | 'desc';
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

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify user authentication
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload: LeadsListRequest = await req.json();
    const {
      tenant_id,
      limit = 1000,
      offset = 0,
      status_filter,
      search_query,
      sort_field = 'created_at',
      sort_order = 'desc',
    } = payload;

    if (!tenant_id) {
      return new Response(JSON.stringify({ error: 'tenant_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build base query
    let baseQuery = supabase
      .from('leads')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenant_id);

    // Apply status filter
    if (status_filter && status_filter !== 'all') {
      baseQuery = baseQuery.eq('status', status_filter);
    }

    // Apply search filter
    if (search_query && search_query.trim()) {
      const query = search_query.trim().toLowerCase();
      baseQuery = baseQuery.or(
        `first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%,company.ilike.%${query}%`
      );
    }

    // Apply sorting (Master Prompt v3: Sortable by created_at, name, company, score, status)
    const ascending = sort_order === 'asc';
    switch (sort_field) {
      case 'first_name':
        baseQuery = baseQuery.order('first_name', { ascending }).order('last_name', { ascending });
        break;
      case 'company':
        baseQuery = baseQuery.order('company', { ascending, nullsFirst: false });
        break;
      case 'score':
        baseQuery = baseQuery.order('score', { ascending, nullsFirst: false });
        break;
      case 'status':
        baseQuery = baseQuery.order('status', { ascending });
        break;
      case 'created_at':
      default:
        baseQuery = baseQuery.order('created_at', { ascending });
        break;
    }

    // Apply pagination
    baseQuery = baseQuery.range(offset, offset + limit - 1);

    const { data: leads, error: leadsError, count } = await baseQuery;

    if (leadsError) {
      console.error('[crm-leads-list] Error fetching leads:', leadsError);
      throw leadsError;
    }

    // Master Prompt v3 Contract: Return { leads, total }
    return new Response(
      JSON.stringify({
        leads: leads || [],
        total: count || 0,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[crm-leads-list] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

