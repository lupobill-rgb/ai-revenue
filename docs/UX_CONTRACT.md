# UX Contract - Product Honesty Policy

## Purpose

This document defines the UX contract that ensures user interface states accurately reflect system capabilities. "Launch" means real work is happening, not a no-op.

---

## Core Principles

### 1. No Fake Launches
A campaign **CANNOT** be launched unless all required provider integrations are connected and configured.

### 2. Honest Channel States
Channels display their true capability status:
- **Active**: Provider connected, tested, working
- **Coming Soon**: No provider integration exists yet
- **Not Configured**: Provider exists but not connected

### 3. Terminal State Truth
A campaign is only marked **"Completed"** when the channel_outbox contains terminal state records (`sent`, `failed`, `skipped`), never before.

---

## Enforcement Rules

### Launch Prerequisites (Blocking)

Before any campaign can launch, the system validates:

| Channel | Required Checks |
|---------|-----------------|
| **Email** | `ai_settings_email.is_connected = true` AND `from_address` configured |
| **Voice** | `ai_settings_voice.is_connected = true` AND VAPI keys present |
| **LinkedIn** | `ai_settings_linkedin.linkedin_profile_url` not empty |
| **Social** | Provider-specific connection verified (BLOCKED until implemented) |
| **Landing Pages** | Valid asset exists with `status = 'published'` |

### Social Channel Status

Social channel is **permanently blocked** from launch until:
1. A real social provider integration (Meta, Twitter, LinkedIn API) is implemented
2. OAuth connection flow exists and works
3. At least one successful post dispatch is verified

Until then, social displays: **"Coming Soon - Integration in Development"**

### Completed Status Rules

A campaign_run status can only transition to `completed` when:

```sql
-- At least one outbox entry exists with terminal status
SELECT EXISTS (
  SELECT 1 FROM channel_outbox
  WHERE run_id = p_run_id
  AND status IN ('sent', 'failed', 'skipped')
);
```

If no terminal outbox entries exist, status remains `in_progress` or `pending`.

---

## UI Components Enforcing This Contract

### 1. CampaignLaunchPrerequisites
Location: `src/components/campaigns/CampaignLaunchPrerequisites.tsx`

Displays pass/fail checklist before launch:
- ✅ Green check: Requirement met
- ❌ Red X: Requirement not met, blocking launch

### 2. ChannelStatusBadge
Location: `src/components/campaigns/ChannelStatusBadge.tsx`

Shows honest channel states:
- **Connected** (green): Provider working
- **Not Configured** (yellow): Needs setup
- **Coming Soon** (gray): Not yet available

### 3. CampaignStatusGuard
Location: `src/hooks/useCampaignStatusGuard.ts`

Validates status transitions:
- Blocks premature "Completed" status
- Enforces terminal outbox state requirement

---

## Database Functions Enforcing This Contract

### check_campaign_launch_prerequisites(p_campaign_id, p_tenant_id)

Returns structured JSON with pass/fail for each requirement:

```json
{
  "pass": false,
  "channel": "email",
  "requirements": [
    {
      "id": "email_connected",
      "name": "Email Provider Connected",
      "pass": false,
      "message": "Please connect your email provider in Settings → Integrations"
    },
    {
      "id": "from_address",
      "name": "Sender Address Configured",
      "pass": true,
      "message": "From address: team@example.com"
    }
  ]
}
```

### validate_campaign_completion(p_run_id)

Returns `true` only if outbox has terminal states:

```sql
CREATE OR REPLACE FUNCTION validate_campaign_completion(p_run_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM channel_outbox
    WHERE run_id = p_run_id
    AND status IN ('sent', 'failed', 'skipped')
  )
$$ LANGUAGE sql STABLE;
```

### complete_campaign_run(p_run_id)

Safely transitions run to completed:
- Calls `validate_campaign_completion` first
- Fails if no terminal outbox entries
- Updates status and completed_at timestamp

---

## Channel-Specific Rules

### Email Channel
| Requirement | Source | Blocking |
|-------------|--------|----------|
| Provider connected | `ai_settings_email.is_connected` | Yes |
| From address set | `ai_settings_email.from_address` | Yes |
| Sender name set | `ai_settings_email.sender_name` | No |
| Reply-to set | `ai_settings_email.reply_to_address` | No |

### Voice Channel
| Requirement | Source | Blocking |
|-------------|--------|----------|
| VAPI connected | `ai_settings_voice.is_connected` | Yes |
| Phone number assigned | `ai_settings_voice.default_phone_number_id` | Yes |
| Assistant configured | `ai_settings_voice.default_vapi_assistant_id` | No |

### LinkedIn Channel
| Requirement | Source | Blocking |
|-------------|--------|----------|
| Profile URL set | `ai_settings_linkedin.linkedin_profile_url` | Yes |
| Daily limits configured | `ai_settings_linkedin.daily_*_limit` | No |

### Social Channel (Instagram, Facebook, Twitter)
| Requirement | Source | Blocking |
|-------------|--------|----------|
| OAuth connected | `ai_settings_social.is_connected` | Yes |
| Account verified | `ai_settings_social.account_url` | Yes |
| **CURRENT STATUS** | **COMING SOON** | **ALWAYS BLOCKED** |

### Landing Pages
| Requirement | Source | Blocking |
|-------------|--------|----------|
| Asset exists | `assets.id` for campaign | Yes |
| Asset published | `assets.status = 'approved'` | Yes |
| Deployment live | `assets.deployment_status = 'live'` | No |

---

## Go/No-Go Checklist

Before any release affecting campaign execution:

- [ ] Launch button disabled when prerequisites fail
- [ ] Social channel shows "Coming Soon" badge
- [ ] No campaign can reach "Completed" without outbox terminal states
- [ ] Settings → Integrations shows accurate connection status
- [ ] Error messages guide users to fix configuration issues
- [ ] All blocking requirements documented and enforced

---

## Audit Triggers

### campaign_status_audit_trigger

Logs all status transitions to `campaign_audit_log`:
- Captures before/after states
- Records actor (user or system)
- Timestamps all changes

### outbox_terminal_state_trigger

When outbox entries reach terminal state:
- Checks if all entries for run are terminal
- Auto-completes campaign_run if all terminal
- Prevents premature completion

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2024-12-21 | Initial contract definition |
