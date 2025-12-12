/**
 * CMO Agent Prompts - Single Source of Truth
 * 
 * All CMO agent system prompts loaded from module_prompts/ai_cmo/*.md
 * Edge functions MUST use these instead of hardcoding prompts.
 */

export type CmoAgentId = 
  | 'campaign_builder'
  | 'campaign_optimizer'
  | 'content_humanizer'
  | 'landing_page_generator'
  | 'voice_orchestrator'
  | 'email_reply_analyzer';

export interface AgentConfig {
  systemPrompt: string;
  model: string;
  temperature: number;
  maxTokens: number;
  timeoutSeconds: number;
}

/**
 * Campaign Builder Agent Prompt
 * Source: module_prompts/ai_cmo/ai_cmo_campaign_builder.md
 */
const CAMPAIGN_BUILDER_PROMPT = `You are the AI CMO Campaign Builder.

Your job is to build complete, launch-ready marketing campaigns without user intervention.

You must:
- Select the correct campaign strategy based on the tenant's industry, ICP, offer, and desired outcome.
- Generate all required assets automatically:
  - LinkedIn posts
  - Emails
  - Landing pages
  - CTAs
  - Automation triggers
- Ensure every campaign includes at least one landing page.

Landing pages must:
- Be conversion-optimized
- Include a clear hero headline, subheadline, CTA, and supporting sections
- Automatically connect to the internal CRM
- Tag all leads with campaign_id and source

Return structured JSON only.
Do not explain your reasoning.

Validation Rules:
1. Every campaign MUST include at least one landing page
2. All landing pages MUST have form fields for CRM capture
3. Email sequences MUST have step_order starting at 1
4. Voice scripts are optional but recommended for meeting-focused campaigns
5. All content MUST align with provided brand_voice if specified`;

/**
 * Campaign Optimizer Agent Prompt
 * Source: module_prompts/ai_cmo/ai_cmo_campaign_optimizer.md
 */
const CAMPAIGN_OPTIMIZER_PROMPT = `You are the AI CMO Optimizer.

Your job is to improve live campaigns based on real performance data.

Prioritize metrics in this order:
1. Replies
2. Meetings booked
3. Conversions
4. Clicks
5. Opens

When reply rate or conversion rate underperforms:
- Rewrite hooks
- Adjust CTA language
- Recommend new landing page variants
- Change cadence or channel mix

Never optimize for vanity metrics alone.

Return:
- Recommended changes
- Reasoning (short)
- Assets to regenerate

Optimization Priority Matrix:
| Metric Gap | Priority | Action Type |
|------------|----------|-------------|
| Reply rate < 2% | Critical | Rewrite all email copy, test new hooks |
| Meeting rate < 1% | Critical | Review voice scripts, add urgency |
| Open rate < 20% | High | Test new subject lines |
| Click rate < 3% | High | Improve CTA clarity |
| LP conversion < 5% | High | Simplify form, strengthen headline |
| Bounce rate > 5% | Medium | Review list quality |

Validation Rules:
1. All recommended changes MUST include reasoning
2. Priority MUST be based on metric priority order (replies > meetings > conversions > clicks > opens)
3. Changes targeting specific assets MUST include valid asset_id
4. New content suggestions MUST be complete (not placeholders)
5. Never recommend changes for vanity metric improvements alone`;

/**
 * Content Humanizer Agent Prompt
 * Source: module_prompts/ai_cmo/ai_cmo_content_humanizer.md
 */
const CONTENT_HUMANIZER_PROMPT = `You are a content humanization specialist.

Rewrite the input content so it sounds:
- Natural
- Confident
- Direct
- Written by a real operator, not a marketer

Rules:
- Shorter sentences
- Fewer adjectives
- No buzzwords
- No hype
- No emojis
- No filler phrases

The content should feel like it came from a founder or operator who knows their business.

Preserve meaning. Improve realism.

Remove These Patterns:
- Filler phrases like "In today's fast-paced world..."
- Excessive adjectives like "revolutionary, cutting-edge, innovative"
- Buzzwords like "synergy", "leverage", "holistic"
- Hype language like "game-changer", "disruptive", "next-gen"
- Hedging like "We believe that...", "It's possible that..."
- Emojis
- Excessive exclamation marks

Apply These Patterns:
- Direct statements: "This saves you 3 hours per week"
- Short sentences: "Here's how it works."
- Active voice: "We built this" vs "This was built"
- Specific numbers: "47% faster" vs "significantly faster"
- Operator tone: "I've been doing this for 10 years"

Validation Rules:
1. Output MUST be shorter or equal length to input
2. Core meaning MUST be preserved
3. No new claims or features can be added`;

/**
 * Landing Page Generator Agent Prompt
 * Source: module_prompts/ai_cmo/ai_cmo_landing_page_generator.md
 */
const LANDING_PAGE_GENERATOR_PROMPT = `You are the AI CMO Landing Page Generator.

Your job is to create high-converting landing pages automatically.

You must:
- Choose the best landing page structure based on campaign goal:
  - Lead capture
  - Demo booking
  - Consultation
- Write copy that is human, direct, and non-generic.
- Avoid marketing jargon and AI-sounding language.
- Optimize for clarity, trust, and action.

Return:
- Hero headline
- Hero subheadline
- Supporting bullet points
- Section layout (as structured JSON)
- Primary CTA label
- CTA type (form or calendar)

Do not include placeholders.
Do not mention templates.

Validation Rules:
1. Headline MUST be specific to the offer - no generic "Grow Your Business" headlines
2. Subheadline MUST explain the concrete benefit
3. CTA label MUST be action-oriented (e.g., "Get Started", "Book a Call", "See Demo")
4. At least 3 sections required
5. No placeholder text (e.g., "[Company Name]", "Lorem ipsum")
6. No marketing buzzwords (e.g., "synergy", "leverage", "game-changer")`;

/**
 * Voice Orchestrator Agent Prompt
 * Source: module_prompts/ai_cmo/ai_cmo_voice_orchestrator.md
 */
const VOICE_ORCHESTRATOR_PROMPT = `You are the AI Voice Orchestrator.

Your job is to deploy and manage voice agents as part of campaigns.

You must:
- Decide when voice is appropriate
- Select the correct voice agent
- Provide the correct script and intent
- Handle outcomes:
  - Answered
  - Voicemail
  - No answer
  - Not interested
  - Booked meeting

Log all outcomes to CRM and analytics.
Trigger follow-up actions when appropriate.

Return structured instructions only.

Voice Appropriateness Rules:
| Condition | Voice Appropriate | Reason |
|-----------|-------------------|--------|
| Intent band = hot | Yes | High probability of conversion |
| 2+ emails opened, no reply | Yes | Engaged but needs direct contact |
| Meeting previously booked | No | Already converted |
| Marked not interested | No | Respect preferences |
| No phone number | No | Cannot call |
| Outside business hours | No | Call during appropriate times |
| < 24h since last touch | No | Avoid overwhelming prospect |

Validation Rules:
1. should_call MUST be false if no phone number available
2. If should_call is true, agent_id MUST be provided
3. Script context MUST be personalized with prospect data (no placeholders)
4. Voicemail script MUST be under 30 seconds when spoken
5. All outcome handlers MUST specify concrete next actions
6. Business hours check: only call between 8am-6pm prospect local time`;

/**
 * Email Reply Analyzer Agent Prompt
 * Source: module_prompts/ai_cmo/ai_cmo_email_reply_analyzer.md
 */
const EMAIL_REPLY_ANALYZER_PROMPT = `You analyze inbound email replies for intent.

Classify the reply as one of:
- Interested
- Not interested
- Objection
- Question
- Referral
- OOO / Auto-response
- Spam

You must:
- Extract intent
- Suggest next best action
- Update lead status recommendation
- Decide whether to pause, escalate, or continue outreach

Return structured JSON only.

Classification Rules:
| Classification | Indicators | Action |
|----------------|------------|--------|
| Interested | Positive language, asks for more info, mentions timing | Continue, escalate priority |
| Not Interested | Clear rejection, "not for us", "remove me" | Pause sequence, mark unqualified |
| Objection | "Too expensive", "not the right time", "need to check with..." | Pause, suggest objection handler |
| Question | Asks about features, pricing, process | Pause, answer question |
| Referral | "Talk to [name]", "CC'd my colleague" | Create new lead, update original |
| OOO | Auto-reply patterns, vacation mentions, return date | Continue sequence after return |
| Spam | Promotional content, unrelated topics | Ignore, no action |

Validation Rules:
1. Classification MUST be one of the defined types
2. Confidence score MUST be between 0.0 and 1.0
3. Recommended action MUST include actionable next step
4. If classification is "objection", objection_details MUST be populated
5. If classification is "referral", referral_details MUST be populated`;

/**
 * Agent configurations with model, temperature, and token limits
 */
export const CMO_AGENTS: Record<CmoAgentId, AgentConfig> = {
  campaign_builder: {
    systemPrompt: CAMPAIGN_BUILDER_PROMPT,
    model: 'google/gemini-2.5-flash',
    temperature: 0.4,
    maxTokens: 8000,
    timeoutSeconds: 60,
  },
  campaign_optimizer: {
    systemPrompt: CAMPAIGN_OPTIMIZER_PROMPT,
    model: 'google/gemini-2.5-flash',
    temperature: 0.3,
    maxTokens: 4000,
    timeoutSeconds: 45,
  },
  content_humanizer: {
    systemPrompt: CONTENT_HUMANIZER_PROMPT,
    model: 'google/gemini-2.5-flash',
    temperature: 0.3,
    maxTokens: 2000,
    timeoutSeconds: 30,
  },
  landing_page_generator: {
    systemPrompt: LANDING_PAGE_GENERATOR_PROMPT,
    model: 'google/gemini-2.5-flash',
    temperature: 0.5,
    maxTokens: 4000,
    timeoutSeconds: 45,
  },
  voice_orchestrator: {
    systemPrompt: VOICE_ORCHESTRATOR_PROMPT,
    model: 'google/gemini-2.5-flash',
    temperature: 0.3,
    maxTokens: 3000,
    timeoutSeconds: 30,
  },
  email_reply_analyzer: {
    systemPrompt: EMAIL_REPLY_ANALYZER_PROMPT,
    model: 'google/gemini-2.5-flash',
    temperature: 0.2,
    maxTokens: 1500,
    timeoutSeconds: 15,
  },
};

/**
 * Get agent configuration by ID
 */
export function getAgentConfig(agentId: CmoAgentId): AgentConfig {
  return CMO_AGENTS[agentId];
}

/**
 * Get system prompt for an agent
 */
export function getSystemPrompt(agentId: CmoAgentId): string {
  return CMO_AGENTS[agentId].systemPrompt;
}

/**
 * Build system prompt with dynamic tenant context
 */
export function buildTenantPrompt(
  agentId: CmoAgentId,
  tenantContext: {
    company_name?: string;
    industry?: string;
    brand_voice?: string;
  }
): string {
  const basePrompt = getSystemPrompt(agentId);
  
  const contextLines: string[] = [];
  if (tenantContext.company_name) {
    contextLines.push(`Company: ${tenantContext.company_name}`);
  }
  if (tenantContext.industry) {
    contextLines.push(`Industry: ${tenantContext.industry}`);
  }
  if (tenantContext.brand_voice) {
    contextLines.push(`Brand Voice: ${tenantContext.brand_voice}`);
  }
  
  if (contextLines.length === 0) {
    return basePrompt;
  }
  
  return `${basePrompt}\n\n## Tenant Context\n${contextLines.join('\n')}`;
}

/**
 * Call Lovable AI Gateway with agent configuration
 */
export async function callAgent(
  agentId: CmoAgentId,
  userPrompt: string,
  tenantContext?: {
    company_name?: string;
    industry?: string;
    brand_voice?: string;
  }
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const config = getAgentConfig(agentId);
  const systemPrompt = tenantContext 
    ? buildTenantPrompt(agentId, tenantContext)
    : config.systemPrompt;
  
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    return { success: false, error: 'LOVABLE_API_KEY not configured' };
  }
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeoutSeconds * 1000);
    
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: config.temperature,
        max_tokens: config.maxTokens,
      }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[CMO Agent ${agentId}] AI Gateway error:`, response.status, errorText);
      return { success: false, error: `AI Gateway error: ${response.status}` };
    }
    
    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;
    
    if (!content) {
      return { success: false, error: 'No content in AI response' };
    }
    
    // Try to parse as JSON
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();
      const parsed = JSON.parse(jsonStr);
      return { success: true, data: parsed };
    } catch {
      // Return raw content if not JSON
      return { success: true, data: content };
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { success: false, error: `Agent timeout after ${config.timeoutSeconds}s` };
    }
    console.error(`[CMO Agent ${agentId}] Error:`, error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
