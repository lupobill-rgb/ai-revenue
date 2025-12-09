import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CSVMapperRequest {
  csvContent: string;
  sampleRows?: number;
}

interface MappedLead {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  company?: string;
  job_title?: string;
  vertical?: string;
  source: string;
  notes?: string;
}

interface MappingResult {
  mapping: Record<string, string | null>;
  full_name_column?: string;
  confidence?: number;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim().replace(/^"|"$/g, ""));
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim().replace(/^"|"$/g, ""));
  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { csvContent, sampleRows = 5 }: CSVMapperRequest = await req.json();

    if (!csvContent) {
      return new Response(
        JSON.stringify({ error: "No CSV content provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Parse CSV
    const lines = csvContent.split(/\r?\n/).filter((line) => line.trim());
    if (lines.length < 2) {
      return new Response(
        JSON.stringify({ error: "CSV must have a header row and at least one data row" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const headers = parseCSVLine(lines[0]);
    const dataRows = lines.slice(1, Math.min(lines.length, sampleRows + 1));
    const sampleData = dataRows.map((line) => parseCSVLine(line));

    console.log("CSV headers:", headers);
    console.log("Sample rows:", sampleData.length);

    // Build prompt for AI to understand column mapping
    const prompt = `You are a data mapping expert. Analyze this CSV data and map each column to the appropriate lead field.

CSV Headers: ${JSON.stringify(headers)}

Sample data rows:
${sampleData.map((row, i) => `Row ${i + 1}: ${JSON.stringify(row)}`).join("\n")}

Target lead fields:
- first_name (required): Person's first/given name
- last_name (required): Person's last/family name  
- email (required): Email address
- phone: Phone number
- company: Company/organization name
- job_title: Job title or position
- vertical: Industry vertical or sector
- notes: Any additional notes or comments

Respond with a JSON object mapping each original header to a target field or null if no match.
Also include a "full_name_column" key if there's a combined full name column that needs splitting.

Example response:
{
  "mapping": {
    "Name": "full_name",
    "Email Address": "email",
    "Phone": "phone",
    "Organization": "company",
    "Title": "job_title",
    "Random Column": null
  },
  "full_name_column": "Name",
  "confidence": 0.95
}

Only respond with valid JSON, no explanation.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a precise data mapping assistant. Always respond with valid JSON only." },
          { role: "user", content: prompt },
        ],
        temperature: 0.1,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add funds." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errorText);
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiResult = await aiResponse.json();
    const aiContent = aiResult.choices?.[0]?.message?.content || "";
    
    console.log("AI response:", aiContent);

    // Parse AI response
    let mappingResult: MappingResult;
    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        mappingResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in AI response");
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      // Fall back to simple header matching
      mappingResult = {
        mapping: {},
        confidence: 0.5,
      };
      headers.forEach((h) => {
        const normalized = h.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (["firstname", "first", "fname"].includes(normalized)) mappingResult.mapping[h] = "first_name";
        else if (["lastname", "last", "lname"].includes(normalized)) mappingResult.mapping[h] = "last_name";
        else if (["email", "emailaddress", "mail"].includes(normalized)) mappingResult.mapping[h] = "email";
        else if (["phone", "phonenumber", "tel", "mobile"].includes(normalized)) mappingResult.mapping[h] = "phone";
        else if (["company", "organization", "org"].includes(normalized)) mappingResult.mapping[h] = "company";
        else if (["jobtitle", "title", "position", "role"].includes(normalized)) mappingResult.mapping[h] = "job_title";
        else if (["vertical", "industry", "sector"].includes(normalized)) mappingResult.mapping[h] = "vertical";
        else if (["name", "fullname"].includes(normalized)) {
          mappingResult.mapping[h] = "full_name";
          mappingResult.full_name_column = h;
        }
        else mappingResult.mapping[h] = null;
      });
    }

    // Now convert all rows using the mapping
    const allDataRows = lines.slice(1);
    const leads: MappedLead[] = [];
    const errors: string[] = [];

    for (let i = 0; i < allDataRows.length; i++) {
      const values = parseCSVLine(allDataRows[i]);
      const lead: Partial<MappedLead> = { source: "csv_import" };

      headers.forEach((header, index) => {
        const value = values[index]?.trim();
        if (!value) return;

        const targetField = mappingResult.mapping[header];
        if (!targetField) return;

        if (targetField === "full_name") {
          // Split full name
          const parts = value.split(/\s+/);
          if (!lead.first_name) lead.first_name = parts[0] || "";
          if (!lead.last_name) lead.last_name = parts.slice(1).join(" ") || parts[0] || "";
        } else if (targetField === "first_name") {
          lead.first_name = value;
        } else if (targetField === "last_name") {
          lead.last_name = value;
        } else if (targetField === "email") {
          lead.email = value;
        } else if (targetField === "phone") {
          lead.phone = value;
        } else if (targetField === "company") {
          lead.company = value;
        } else if (targetField === "job_title") {
          lead.job_title = value;
        } else if (targetField === "vertical") {
          lead.vertical = value;
        } else if (targetField === "notes") {
          lead.notes = value;
        }
      });

      // Validate required fields
      if (lead.email) {
        if (!lead.first_name) lead.first_name = lead.email.split("@")[0] || "Unknown";
        if (!lead.last_name) lead.last_name = "Contact";
        leads.push(lead as MappedLead);
      } else {
        errors.push(`Row ${i + 2}: Missing email address`);
      }
    }

    console.log(`Mapped ${leads.length} leads, ${errors.length} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        leads,
        mapping: mappingResult.mapping,
        confidence: mappingResult.confidence || 0.8,
        errors: errors.slice(0, 10), // Only return first 10 errors
        totalRows: allDataRows.length,
        validLeads: leads.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("ai-csv-mapper error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
