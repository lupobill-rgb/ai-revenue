# AI CMO Campaign Optimizer Agent

**Purpose:** Continuously improve campaigns based on real performance data.

---

## System Prompt

You are the AI CMO Optimizer.

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

---

## Input Schema

```json
{
  "tenant_id": "uuid",
  "campaign_id": "uuid",
  "campaign_goal": "leads | meetings | revenue | engagement",
  "current_assets": {
    "emails": [
      {
        "id": "uuid",
        "step_order": "number",
        "subject": "string",
        "body": "string",
        "cta": "string"
      }
    ],
    "landing_pages": [
      {
        "id": "uuid",
        "headline": "string",
        "subheadline": "string",
        "cta_text": "string"
      }
    ],
    "voice_scripts": [
      {
        "id": "uuid",
        "script_type": "string",
        "content": "string"
      }
    ]
  },
  "performance_metrics": {
    "period_days": "number",
    "email_metrics": {
      "sent": "number",
      "delivered": "number",
      "opens": "number",
      "clicks": "number",
      "replies": "number",
      "bounces": "number"
    },
    "landing_page_metrics": {
      "visits": "number",
      "form_submissions": "number",
      "conversion_rate": "number"
    },
    "voice_metrics": {
      "calls_attempted": "number",
      "calls_answered": "number",
      "meetings_booked": "number"
    },
    "overall": {
      "total_leads": "number",
      "qualified_leads": "number",
      "meetings_booked": "number",
      "conversions": "number"
    }
  },
  "industry_benchmarks": {
    "email_open_rate": "number",
    "email_reply_rate": "number",
    "landing_page_conversion_rate": "number"
  }
}
```

---

## Output Schema

```json
{
  "analysis_summary": "string - brief overview of campaign health",
  "performance_score": 0-100,
  "underperforming_areas": [
    {
      "area": "email_opens | email_replies | landing_page_conversion | voice_connection | meetings",
      "current_value": "number",
      "benchmark": "number",
      "gap_percentage": "number"
    }
  ],
  "recommended_changes": [
    {
      "change_id": "string",
      "change_type": "update_email | update_landing_page | update_voice_script | adjust_cadence | change_channel_mix | kill_variant",
      "target_asset_id": "uuid | null",
      "priority": "high | medium | low",
      "expected_impact": "string - predicted improvement",
      "reasoning": "string - short explanation",
      "new_content": {
        "subject": "string - if email",
        "body": "string - if email/script",
        "headline": "string - if landing page",
        "cta": "string - if applicable"
      }
    }
  ],
  "assets_to_regenerate": [
    {
      "asset_type": "email | landing_page | voice_script",
      "asset_id": "uuid",
      "regeneration_prompt": "string - specific instructions for regeneration"
    }
  ],
  "cadence_adjustments": {
    "should_adjust": true/false,
    "current_delay_days": "number",
    "recommended_delay_days": "number",
    "reason": "string"
  },
  "channel_mix_adjustments": {
    "should_adjust": true/false,
    "recommendations": [
      {
        "channel": "email | linkedin | voice | sms",
        "current_weight": "number (percentage)",
        "recommended_weight": "number (percentage)",
        "reason": "string"
      }
    ]
  },
  "next_review_date": "ISO date string"
}
```

---

## Optimization Priority Matrix

| Metric Gap | Priority | Action Type |
|------------|----------|-------------|
| Reply rate < 2% | Critical | Rewrite all email copy, test new hooks |
| Meeting rate < 1% | Critical | Review voice scripts, add urgency |
| Open rate < 20% | High | Test new subject lines |
| Click rate < 3% | High | Improve CTA clarity |
| LP conversion < 5% | High | Simplify form, strengthen headline |
| Bounce rate > 5% | Medium | Review list quality |

---

## Validation Rules

1. All recommended changes MUST include reasoning
2. Priority MUST be based on metric priority order (replies > meetings > conversions > clicks > opens)
3. Changes targeting specific assets MUST include valid asset_id
4. New content suggestions MUST be complete (not placeholders)
5. Performance score calculation: weighted average of metric performance vs benchmarks
6. Never recommend changes for vanity metric improvements alone

---

## Agent Configuration

| Parameter | Value |
|-----------|-------|
| Model | google/gemini-2.5-flash |
| Temperature | 0.3 |
| Max Tokens | 4000 |
| Timeout | 45s |
