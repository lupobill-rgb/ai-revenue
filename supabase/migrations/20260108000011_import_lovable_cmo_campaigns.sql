-- ============================================
-- IMPORT LOVABLE CLOUD CMO CAMPAIGNS (Sample)
-- Source: ADDITIONAL_DATA_EXPORT.sql
-- 5 sample campaigns (schema-adjusted for Phase 3)
-- ============================================

-- Disable triggers during import
SET session_replication_role = replica;
-- Import CMO campaigns (adjusted for Phase 3 schema)
INSERT INTO cmo_campaigns (
  id, workspace_id, campaign_name, campaign_type, objective, 
  description, target_icp, target_offer, target_segment_codes, 
  funnel_stage, start_date, end_date, budget_allocation, 
  status, primary_kpi, secondary_kpis, success_criteria,
  created_at, updated_at
) VALUES
-- Campaign 1: LinkedIn Thought Leadership (UbiGrowth)
(
  '28c3efe2-1fb0-471a-abfb-9a2a4ec10fea',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'LinkedIn Thought Leadership',
  'awareness',
  'Establish UbiGrowth as AI marketing authority',
  'Series of thought leadership posts and sponsored content targeting CMOs',
  'Growth-Stage CMOs',
  'AI CMO Pro',
  ARRAY[]::text[],
  'awareness',
  '2025-01-01',
  '2025-01-31',
  15000,
  'active',
  '{"metric": "engagement_rate", "target": 3.5}'::jsonb,
  '[{"metric": "impressions", "target": 50000}, {"metric": "followers", "target": 500}]'::jsonb,
  NULL,
  '2025-12-04 03:22:42.476959+00',
  '2025-12-04 03:22:42.476959+00'
),
-- Campaign 2: Camp Interest Nurture (First Touch Soccer)
(
  '8161df2a-cb5e-4415-81c7-e3d999a90f79',
  '4161ee82-be97-4fa8-9017-5c40be3ebe19',
  'Camp Interest Nurture',
  'email_nurture',
  'Convert camp inquiries into registrations through targeted email/SMS nurture sequence',
  'AI CMO Driven: Automated nurture campaign targeting parents who expressed interest in summer camps but haven''t registered. Includes early bird discounts, camp highlights, and testimonials from past campers.',
  'Camp Parents',
  NULL,
  ARRAY[]::text[],
  'consideration',
  '2025-12-06',
  '2026-03-06',
  0,
  'draft',
  '{}'::jsonb,
  '[]'::jsonb,
  NULL,
  '2025-12-06 03:03:03.685886+00',
  '2025-12-06 03:03:03.685886+00'
),
-- Campaign 3: Private Lesson Follow-up (First Touch Soccer)
(
  '1938621e-54de-45d8-be63-3ad571848e9c',
  '4161ee82-be97-4fa8-9017-5c40be3ebe19',
  'Private Lesson Follow-up',
  'email_nurture',
  'Convert private lesson inquiries into bookings with personalized follow-up',
  'AI CMO Driven: Automated follow-up sequence for parents who inquired about private lessons. Includes coach introductions, skill assessment offers, and scheduling convenience messaging.',
  'Private Lesson Seekers',
  NULL,
  ARRAY[]::text[],
  'conversion',
  '2025-12-06',
  '2026-02-04',
  0,
  'draft',
  '{}'::jsonb,
  '[]'::jsonb,
  NULL,
  '2025-12-06 03:03:03.685886+00',
  '2025-12-06 03:03:03.685886+00'
),
-- Campaign 4: AI CMO Test - Autopilot Enabled (First Touch Soccer)
(
  '31b4760f-cdaf-4e3c-b91f-6c047f7c983f',
  '4161ee82-be97-4fa8-9017-5c40be3ebe19',
  'AI CMO Test - Autopilot Enabled',
  'autopilot',
  'Generate leads through automated multi-channel outreach',
  'Test campaign for verifying the autopilot optimization loop',
  'B2B SaaS companies, 50-500 employees, seeking marketing automation',
  'UbiGrowth AI CMO - Autonomous marketing campaign management',
  ARRAY[]::text[],
  NULL,
  NULL,
  NULL,
  0,
  'active',
  '{}'::jsonb,
  '[]'::jsonb,
  'leads',
  '2025-12-12 22:05:43.862294+00',
  '2025-12-12 22:05:43.862294+00'
),
-- Campaign 5: Test Paid Ads Campaign (UbiGrowth)
(
  '11111111-2222-3333-4444-555555555555',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'Test Paid Ads Campaign',
  'paid_media',
  NULL,
  NULL,
  NULL,
  NULL,
  ARRAY[]::text[],
  NULL,
  NULL,
  NULL,
  0,
  'active',
  '{}'::jsonb,
  '[]'::jsonb,
  NULL,
  '2025-12-13 16:07:53.145089+00',
  '2025-12-13 16:07:53.145089+00'
)
ON CONFLICT (id) DO UPDATE SET
  campaign_name = EXCLUDED.campaign_name,
  description = EXCLUDED.description,
  status = EXCLUDED.status,
  updated_at = EXCLUDED.updated_at;
-- Re-enable triggers
SET session_replication_role = DEFAULT;
-- ============================================
-- VERIFICATION
-- ============================================
-- Run these queries to verify:
-- SELECT COUNT(*) FROM cmo_campaigns WHERE campaign_type IN ('awareness', 'email_nurture', 'autopilot', 'paid_media');
-- SELECT campaign_name, workspace_id, status FROM cmo_campaigns WHERE id IN (
--   '28c3efe2-1fb0-471a-abfb-9a2a4ec10fea',
--   '8161df2a-cb5e-4415-81c7-e3d999a90f79',
--   '1938621e-54de-45d8-be63-3ad571848e9c',
--   '31b4760f-cdaf-4e3c-b91f-6c047f7c983f',
--   '11111111-2222-3333-4444-555555555555'
-- );;
