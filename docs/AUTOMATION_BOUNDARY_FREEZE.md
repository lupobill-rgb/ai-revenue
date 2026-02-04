# Automation boundary freeze (execution oracle)

`scripts/smoke-automation-functions.ts` is the **authoritative execution oracle** for campaign automation.

## Rule

- Any change to automation-related Edge Functions **must** keep this harness green.
- No merge on red: the PR gate is enforced by GitHub Actions.
- The harness exits **non-zero** if any step fails (CI-safe).

## CI gate

Workflow: `.github/workflows/automation-smoke-gate.yml`

Configure these **GitHub repo secrets**:

- `SUPABASE_URL` (e.g. `https://<project-ref>.supabase.co`)
- `SUPABASE_ANON_KEY` (the `eyJ...` anon/public JWT key)
- `SMOKE_EMAIL`
- `SMOKE_PASSWORD`
- `SMOKE_WORKSPACE_ID` (optional; recommended for stability)

Then set branch protection to require the check **Automation Smoke Harness (PR Gate)**.

## Contract (what the harness assumes)

### Headers (canonical)

- `Authorization: Bearer <access_token>`
- `x-workspace-id: <workspace_uuid>`

### Harness-called functions

- `campaign-orchestrator`
- `content-generate`
- `generate-hero-image`
- `cmo-voice-agent-builder`

Optional (disabled by default; set `ENABLE_AUTOPILOT_SMOKE=1`):

- `ai-cmo-autopilot-build`
- `ai-cmo-toggle-autopilot`

## Required Edge Function env vars (Supabase secrets)

Set these in Supabase (not in CI):

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `OPENAI_API_KEY`

Additionally required by specific functions:

- `SUPABASE_SERVICE_ROLE_KEY` (used by `generate-hero-image`, `ai-cmo-autopilot-build`, `ai-cmo-toggle-autopilot`)

