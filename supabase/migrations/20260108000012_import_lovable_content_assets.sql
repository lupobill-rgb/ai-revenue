-- ============================================
-- IMPORT LOVABLE CLOUD CMO CONTENT ASSETS
-- Source: ADDITIONAL_DATA_EXPORT.sql
-- 6 sample content assets for imported campaigns
-- ============================================

-- Disable triggers during import
SET session_replication_role = replica;
-- Import CMO content assets
INSERT INTO cmo_content_assets (
  id, workspace_id, campaign_id, title, content_type, channel,
  tone, key_message, cta, supporting_points, target_icp,
  funnel_stage, status, publish_date, content_id, dependencies,
  estimated_production_time, created_at, updated_at
) VALUES
-- Asset 1: LinkedIn Post (UbiGrowth LinkedIn campaign)
(
  '77d92d2f-2af6-4698-aa58-d40380bc175d',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  '28c3efe2-1fb0-471a-abfb-9a2a4ec10fea',
  '5 Ways AI is Transforming Marketing Teams',
  'linkedin_post',
  'LinkedIn',
  'thought_leader',
  'AI automation is no longer optional for scaling marketing teams',
  'Learn how AI CMO can 10x your output',
  '[]'::jsonb,
  'Growth-Stage CMOs',
  'awareness',
  'approved',
  NULL,
  NULL,
  '[]'::jsonb,
  NULL,
  '2025-12-04 03:23:03.659563+00',
  '2025-12-04 03:23:03.659563+00'
),
-- Asset 2: Whitepaper (UbiGrowth LinkedIn campaign)
(
  '8ca5db87-7c3e-4da8-a4b6-02aa5843f4a8',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  '28c3efe2-1fb0-471a-abfb-9a2a4ec10fea',
  'The CMO Guide to AI Marketing Automation',
  'whitepaper',
  'Email',
  'authoritative',
  'Comprehensive guide to implementing AI in your marketing stack',
  'Download the free guide',
  '[]'::jsonb,
  'Growth-Stage CMOs',
  'consideration',
  'approved',
  NULL,
  NULL,
  '[]'::jsonb,
  NULL,
  '2025-12-04 03:23:03.659563+00',
  '2025-12-04 03:23:03.659563+00'
),
-- Asset 3: Interactive Tool (UbiGrowth LinkedIn campaign)
(
  'b4a1cdf5-b21a-474e-b57f-ba8698e7c5e4',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  '28c3efe2-1fb0-471a-abfb-9a2a4ec10fea',
  'AI Marketing ROI Calculator',
  'interactive',
  'Website',
  'helpful',
  'See exactly how much time and money AI can save your team',
  'Calculate your savings',
  '[]'::jsonb,
  'Growth-Stage CMOs',
  'conversion',
  'draft',
  NULL,
  NULL,
  '[]'::jsonb,
  NULL,
  '2025-12-04 03:23:03.659563+00',
  '2025-12-04 03:23:03.659563+00'
),
-- Asset 4: Email (Autopilot campaign)
(
  '9884701e-918b-44be-9a7d-5728198dc363',
  '4161ee82-be97-4fa8-9017-5c40be3ebe19',
  '31b4760f-cdaf-4e3c-b91f-6c047f7c983f',
  'Subject: Ready to automate your marketing?',
  'email',
  'email',
  NULL,
  'Hi {{first_name}}, I noticed your company is growing fast. Most marketing teams at this stage struggle with scaling their outreach without sacrificing quality. We built UbiGrowth to solve exactly this. Want to see how it works?',
  'Book a Demo',
  '[]'::jsonb,
  NULL,
  NULL,
  'draft',
  NULL,
  NULL,
  '[]'::jsonb,
  NULL,
  '2025-12-12 22:05:59.839841+00',
  '2025-12-12 22:05:59.839841+00'
),
-- Asset 5: LinkedIn Post (Autopilot campaign)
(
  '6392b675-2c50-4564-9433-e47d5debc9a0',
  '4161ee82-be97-4fa8-9017-5c40be3ebe19',
  '31b4760f-cdaf-4e3c-b91f-6c047f7c983f',
  'LinkedIn Post - Campaign Awareness',
  'social_post',
  'linkedin',
  NULL,
  'Marketing automation should feel like having an extra team member, not another tool to manage. That is exactly what we built at UbiGrowth. The AI does the work. You approve the results.',
  'Learn More',
  '[]'::jsonb,
  NULL,
  NULL,
  'draft',
  NULL,
  NULL,
  '[]'::jsonb,
  NULL,
  '2025-12-12 22:05:59.839841+00',
  '2025-12-12 22:05:59.839841+00'
),
-- Asset 6: Landing Page (Autopilot campaign)
(
  '5b33af70-df48-436b-bf38-2bcb9484cf10',
  '4161ee82-be97-4fa8-9017-5c40be3ebe19',
  '31b4760f-cdaf-4e3c-b91f-6c047f7c983f',
  'Landing Page - Lead Capture',
  'landing_page',
  'web',
  NULL,
  'Stop Managing Campaigns. Start Getting Results.',
  'Get Started Free',
  '[]'::jsonb,
  NULL,
  NULL,
  'draft',
  NULL,
  NULL,
  '[]'::jsonb,
  NULL,
  '2025-12-12 22:05:59.839841+00',
  '2025-12-12 22:05:59.839841+00'
)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  key_message = EXCLUDED.key_message,
  status = EXCLUDED.status,
  updated_at = EXCLUDED.updated_at;
-- Re-enable triggers
SET session_replication_role = DEFAULT;
-- ============================================
-- VERIFICATION
-- ============================================
-- Run these queries to verify:
-- SELECT COUNT(*) FROM cmo_content_assets WHERE campaign_id IN (
--   '28c3efe2-1fb0-471a-abfb-9a2a4ec10fea',
--   '31b4760f-cdaf-4e3c-b91f-6c047f7c983f'
-- );
-- SELECT title, content_type, channel, status FROM cmo_content_assets ORDER BY created_at DESC LIMIT 10;;
