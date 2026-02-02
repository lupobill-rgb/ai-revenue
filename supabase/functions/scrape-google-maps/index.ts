import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { verifyAuth, unauthorizedResponse } from "../_shared/auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Extract owner/contact name from website content using Firecrawl HTTP API
async function extractOwnerFromWebsite(websiteUrl: string, apiKey: string): Promise<{ firstName: string; lastName: string; jobTitle: string; email?: string; phone?: string } | null> {
  if (!apiKey || !websiteUrl) return null;

  try {
    console.log(`Scraping website for owner info: ${websiteUrl}`);
    
    // Use Firecrawl REST API directly instead of SDK
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: websiteUrl,
        formats: ['extract'],
        extract: {
          prompt: 'Extract the business owner, founder, CEO, or primary contact person information. Look for names in About Us, Team, Contact, or Leadership sections.',
          schema: {
            type: 'object',
            properties: {
              owner_name: { type: 'string', description: 'Full name of owner, founder, CEO, or primary contact' },
              job_title: { type: 'string', description: 'Job title or role (e.g., Owner, Founder, CEO, Manager)' },
              email: { type: 'string', description: 'Contact email if found' },
              phone: { type: 'string', description: 'Contact phone if found' }
            }
          }
        },
        onlyMainContent: true,
        timeout: 30000,
      }),
    });

    if (!response.ok) {
      console.warn(`Firecrawl API error: ${response.status}`);
      return null;
    }

    const result = await response.json();
    const data = result?.data?.extract;
    
    if (data?.owner_name) {
      const nameParts = data.owner_name.trim().split(' ');
      const firstName = nameParts[0] || 'Business';
      const lastName = nameParts.slice(1).join(' ') || 'Owner';
      
      console.log(`Found owner: ${firstName} ${lastName} (${data.job_title || 'Owner'})`);
      
      return {
        firstName,
        lastName,
        jobTitle: data.job_title || 'Owner / Manager',
        email: data.email || undefined,
        phone: data.phone || undefined
      };
    }
  } catch (error) {
    console.warn('Failed to extract owner from website:', error);
  }
  
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { location, businessType, radius = 5000, maxResults = 20, tenantId } = await req.json();

    if (!location || !businessType) {
      return new Response(
        JSON.stringify({ error: 'Location and business type are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!tenantId) {
      return new Response(
        JSON.stringify({ error: 'Tenant ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const GOOGLE_API_KEY = Deno.env.get('GOOGLE_PLACES_API_KEY');
    if (!GOOGLE_API_KEY) {
      throw new Error('Google Places API key not configured');
    }

    console.log(`Searching for ${businessType} near ${location}`);

    // Map business types to our 8 verticals
    const verticalMapping: Record<string, string> = {
      'hotel': 'hotels_resorts',
      'lodging': 'hotels_resorts',
      'resort': 'hotels_resorts',
      'apartment_complex': 'multifamily_real_estate',
      'real_estate_agency': 'multifamily_real_estate',
      'country_club': 'pickleball_country_clubs',
      'sports_club': 'pickleball_country_clubs',
      'night_club': 'entertainment_venues',
      'bar': 'entertainment_venues',
      'event_venue': 'entertainment_venues',
      'physiotherapist': 'physical_therapy',
      'physical_therapy': 'physical_therapy',
      'office_space_rental_agency': 'corporate_coworking',
      'coworking_space': 'corporate_coworking',
      'school': 'education',
      'university': 'education',
      'college': 'education',
      'gym': 'gyms',
      'fitness_center': 'gyms',
    };

    const vertical = verticalMapping[businessType.toLowerCase()] || '';

    // Step 1: Find Place from query (Text Search)
    const textSearchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(businessType + ' in ' + location)}&radius=${radius}&key=${GOOGLE_API_KEY}`;
    
    const textSearchResponse = await fetch(textSearchUrl);
    const textSearchData = await textSearchResponse.json();

    if (textSearchData.status !== 'OK' && textSearchData.status !== 'ZERO_RESULTS') {
      console.error('Google Places API error:', textSearchData);
      
      // Enhanced error messages based on Google's error codes
      let errorMessage = `Google Places API error: ${textSearchData.status}`;
      let errorDetails = '';
      
      if (textSearchData.error_message) {
        errorDetails = textSearchData.error_message;
      }
      
      switch (textSearchData.status) {
        case 'REQUEST_DENIED':
          errorMessage = '❌ Google Places API Access Denied';
          errorDetails = errorDetails || 'Your API key is not authorized to use the Places API.';
          
          if (errorDetails.includes('billing') || errorDetails.includes('Billing')) {
            errorDetails = '💳 Billing Issue: You must enable billing on your Google Cloud Project.\n\n' +
              'Steps to fix:\n' +
              '1. Go to https://console.cloud.google.com/billing\n' +
              '2. Enable billing for your project\n' +
              '3. Wait 2-3 minutes for changes to propagate\n' +
              '4. Try again\n\n' +
              'Original error: ' + errorDetails;
          } else if (errorDetails.includes('API key') || errorDetails.includes('restrict')) {
            errorDetails = '🔑 API Key Issue: Your API key may have restrictions that prevent it from working.\n\n' +
              'Steps to fix:\n' +
              '1. Go to https://console.cloud.google.com/apis/credentials\n' +
              '2. Find your API key and click "Edit"\n' +
              '3. Under "API restrictions", select "Don\'t restrict key" (or add Places API)\n' +
              '4. Under "Application restrictions", select "None"\n' +
              '5. Save and wait 2-3 minutes\n' +
              '6. Try again\n\n' +
              'Original error: ' + errorDetails;
          }
          break;
          
        case 'INVALID_REQUEST':
          errorMessage = '⚠️ Invalid Request';
          errorDetails = errorDetails || 'The request is missing required parameters or has invalid values.';
          break;
          
        case 'OVER_QUERY_LIMIT':
          errorMessage = '📊 Query Limit Exceeded';
          errorDetails = errorDetails || 'You have exceeded your daily quota or per-second rate limit.';
          break;
          
        case 'UNKNOWN_ERROR':
          errorMessage = '❓ Unknown Error';
          errorDetails = errorDetails || 'A server error occurred. Please try again.';
          break;
          
        default:
          errorDetails = errorDetails || 'An unexpected error occurred.';
      }
      
      return new Response(
        JSON.stringify({ 
          error: errorMessage,
          details: errorDetails,
          status: textSearchData.status
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!textSearchData.results || textSearchData.results.length === 0) {
      return new Response(
        JSON.stringify({ success: true, leadsImported: 0, message: 'No businesses found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${textSearchData.results.length} businesses`);

    // Limit results
    const places = textSearchData.results.slice(0, maxResults);

    // Step 2: Get detailed information for each place
    // Verify auth using shared helper
    const { user, error: authError, supabaseClient } = await verifyAuth(req);
    if (authError || !user || !supabaseClient) {
      return unauthorizedResponse(corsHeaders, authError || "Not authenticated");
    }

    // Get Firecrawl API key for owner extraction (optional)
    const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');
    if (FIRECRAWL_API_KEY) {
      console.log('Firecrawl API key found - owner extraction enabled');
    } else {
      console.log('Firecrawl API key not found - owner extraction disabled');
    }

    let importedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    for (const place of places) {
      try {
        // Get place details with extended fields
        const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,formatted_address,formatted_phone_number,website,rating,user_ratings_total,opening_hours,editorial_summary&key=${GOOGLE_API_KEY}`;
        
        const detailsResponse = await fetch(detailsUrl);
        const detailsData = await detailsResponse.json();

        if (detailsData.status !== 'OK') {
          console.warn(`Failed to get details for ${place.name}:`, detailsData.status);
          continue;
        }

        const details = detailsData.result;

        // Try to extract owner info from website (only if Firecrawl is configured)
        let ownerInfo: { firstName: string; lastName: string; jobTitle: string; email?: string; phone?: string } | null = null;
        
        if (details.website && FIRECRAWL_API_KEY) {
          ownerInfo = await extractOwnerFromWebsite(details.website, FIRECRAWL_API_KEY);
        }

        // Extract email from website if available (basic extraction) or use scraped email
        let email = ownerInfo?.email || '';
        if (!email && details.website) {
          const domain = details.website.replace(/^https?:\/\//, '').split('/')[0];
          email = `info@${domain}`; // Educated guess
        }

        // Use scraped phone if Google didn't provide one
        const phone = details.formatted_phone_number || ownerInfo?.phone || null;

        // Calculate lead score based on rating and reviews
        let score = 40; // Base score
        
        if (details.rating >= 4.5) score += 20;
        else if (details.rating >= 4.0) score += 15;
        else if (details.rating >= 3.5) score += 10;

        if (details.user_ratings_total > 100) score += 15;
        else if (details.user_ratings_total > 50) score += 10;

        if (details.website) score += 10;
        if (phone) score += 10;
        
        // Bonus score if we found actual owner name
        if (ownerInfo?.firstName && ownerInfo.firstName !== 'Business') {
          score += 10;
        }
        
        score = Math.min(score, 100);

        // Parse address for company name
        const company = details.name || place.name;
        
        // Check if lead already exists by company name or phone
        const { data: existingLead } = await supabaseClient
          .from('leads')
          .select('id')
          .or(`company.eq.${company}${phone ? `,phone.eq.${phone}` : ''}`)
          .limit(1)
          .single();

        if (existingLead) {
          console.log(`Lead already exists: ${company}`);
          skippedCount++;
          continue;
        }

        // Use extracted owner name or default to "Business Owner"
        const firstName = ownerInfo?.firstName || 'Business';
        const lastName = ownerInfo?.lastName || 'Owner';
        const jobTitle = ownerInfo?.jobTitle || 'Owner / Manager';

        // Create lead with owner info when available
        const leadData = {
          first_name: firstName,
          last_name: lastName,
          email: email || `contact@${company.toLowerCase().replace(/\s+/g, '')}.com`,
          phone: phone,
          company: company,
          job_title: jobTitle,
          source: 'google_maps_scraper',
          status: 'new',
          score: score,
          vertical: vertical || null,
          notes: `Found via Google Maps scraper. Rating: ${details.rating || 'N/A'} (${details.user_ratings_total || 0} reviews)${ownerInfo ? '. Owner info extracted from website.' : ''}`,
          custom_fields: {
            google_place_id: place.place_id,
            address: details.formatted_address,
            website: details.website || null,
            rating: details.rating || null,
            total_reviews: details.user_ratings_total || 0,
            business_type: businessType,
            owner_extracted: ownerInfo ? true : false,
          },
          created_by: user.id,
          tenant_id: tenantId,
        };

        const { data: newLead, error: insertError } = await supabaseClient
          .from('leads')
          .insert(leadData)
          .select()
          .single();

        if (insertError) {
          console.error(`Error inserting lead for ${company}:`, insertError);
          errors.push(`${company}: ${insertError.message}`);
          continue;
        }

        // Log activity
        await supabaseClient.from('lead_activities').insert({
          lead_id: newLead.id,
          activity_type: 'note',
          description: `Lead imported from Google Maps scraper`,
          metadata: {
            source: 'google_maps',
            business_type: businessType,
            location: location,
            rating: details.rating,
            total_reviews: details.user_ratings_total,
          },
          created_by: user.id,
          tenant_id: tenantId,
        });

        importedCount++;
        console.log(`Imported: ${company} (Score: ${score})`);
      } catch (error) {
        console.error('Error processing place:', error);
        errors.push(`${place.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        leadsImported: importedCount,
        leadsSkipped: skippedCount,
        errors: errors.length > 0 ? errors : undefined,
        message: `Successfully imported ${importedCount} leads, skipped ${skippedCount} duplicates`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in scrape-google-maps:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
