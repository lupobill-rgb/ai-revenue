-- ============================================
-- FULL DATA EXPORT - Lovable Cloud Database
-- Generated: 2026-01-07
-- ============================================
-- 
-- INSTRUCTIONS:
-- 1. First run docs/BACKUP_SCHEMA.sql to create tables
-- 2. Then run this file to populate data
-- 3. Note: This is a comprehensive export but some tables
--    have truncated data due to size (leads has 100k+ rows)
--
-- For COMPLETE data migration, use pg_dump or Supabase dashboard export
-- ============================================

-- Disable triggers during import for speed
SET session_replication_role = replica;

-- ============================================
-- WORKSPACES (Core tenant data)
-- ============================================
INSERT INTO workspaces (id, name, slug, owner_id, settings, demo_mode, stripe_connected, created_at, updated_at) VALUES
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'UbiGrowth OS', 'ubigrowth', '00000000-0000-0000-0000-000000000000', '{"features": ["automation", "ai", "analytics"], "tier": "enterprise"}', false, false, '2025-12-03 03:31:14.834771+00', '2025-12-03 03:31:14.834771+00'),
('245f7faf-0fab-47ea-91b2-16ef6830fb8a', 'Silk', 'silk', 'c16b947a-185e-4116-bca7-3fce3a088385', '{}', false, false, '2025-12-10 22:41:48.902519+00', '2025-12-10 22:41:48.902519+00'),
('81dc2cb8-67ae-4608-9987-37ee864c87b0', 'Brain Surgery Inc', 'brain-surgery-inc', 'd93af444-8cbd-42a1-9c93-f7806b6dfda4', '{}', false, false, '2025-12-05 16:34:36.912519+00', '2025-12-10 23:47:16.251753+00'),
('b55dec7f-a940-403e-9a7e-13b6d067f7cd', 'Sesame Street', 'sesame-street', '42e61c6e-daa1-42b5-ad08-13051fc62acf', '{}', false, false, '2025-12-11 21:57:07.199552+00', '2025-12-11 21:57:07.199552+00'),
('4d120e41-2235-4392-baad-61538e200ca7', 'PlantPR', 'plantpr', '5a45dabf-dbfe-4647-8488-7554cf1a7d28', '{}', false, false, '2025-12-17 17:38:33.507439+00', '2025-12-17 17:38:33.507439+00'),
('4161ee82-be97-4fa8-9017-5c40be3ebe19', 'First Touch Soccer', 'first-touch-soccer', '248ea2ab-9633-4deb-8b61-30d75996d2a6', '{}', false, false, '2025-12-19 22:44:56.299888+00', '2025-12-19 22:44:56.299888+00'),
('ef17dc12-9912-4aef-8add-c87fc3c40b7b', 'Test Workspace', 'test-workspace', '864212c7-14e8-4856-8f7c-72ce407a72ae', '{}', false, false, '2026-01-05 22:51:34.706211+00', '2026-01-05 22:51:34.706211+00'),
('87415775-15fc-42f9-8fe4-cd7da28f0974', 'Demo Workspace', 'demo-workspace', 'db876aac-0713-4ec9-a13f-7abe2b701d8a', '{}', false, false, '2026-01-06 14:02:24.557627+00', '2026-01-06 14:02:24.557627+00'),
('05c5ca1d-3fd6-4527-9c14-b6449acf6497', 'AutoAcquire', 'autoacquire', '00000000-0000-0000-0000-000000000001', '{}', false, false, '2025-12-26 16:20:00+00', '2025-12-26 16:20:00+00'),
('8e5cda04-2380-41f8-ade3-a04cbbec6195', 'L3 Scale Workspace', 'l3-ws-1766356410310', '248ea2ab-9633-4deb-8b61-30d75996d2a6', '{}', false, false, '2025-12-21 22:33:30.633895+00', '2025-12-21 22:33:30.633895+00')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- WORKSPACE MEMBERS
-- ============================================
INSERT INTO workspace_members (id, workspace_id, user_id, role, created_at) VALUES
('f4cd912a-afca-4ceb-8a31-360b78f85a9a', '81dc2cb8-67ae-4608-9987-37ee864c87b0', '9236ab25-dc46-4db9-b4e8-39d9cd017a85', 'admin', '2025-12-05 19:42:51.563165+00'),
('eed7fd5a-a3a2-47f0-9346-0c1e7b063bc4', '81dc2cb8-67ae-4608-9987-37ee864c87b0', 'd93af444-8cbd-42a1-9c93-f7806b6dfda4', 'admin', '2025-12-05 19:44:44.395164+00'),
('c24a627c-a519-4590-b1f8-5a5af679542a', '81dc2cb8-67ae-4608-9987-37ee864c87b0', 'df96e948-03b7-407a-a794-ce42bec084d8', 'admin', '2025-12-05 19:44:44.395164+00'),
('b9ed0d56-f8ea-4db2-ae48-902bcf08dda5', '81dc2cb8-67ae-4608-9987-37ee864c87b0', '73953c63-52cd-4402-a7c2-71f18212f0dc', 'admin', '2025-12-05 19:44:44.395164+00'),
('45ee7c4b-8396-475c-a73a-8c62add59b48', '81dc2cb8-67ae-4608-9987-37ee864c87b0', '248ea2ab-9633-4deb-8b61-30d75996d2a6', 'admin', '2025-12-05 19:44:44.395164+00'),
('625a73c2-ca9e-4dbe-9439-cb6f2a3cd44d', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '00000000-0000-0000-0000-000000000000', 'owner', '2025-12-19 22:44:56.299888+00'),
('0e239fab-2d93-4232-b193-582267c9fc97', 'b55dec7f-a940-403e-9a7e-13b6d067f7cd', '42e61c6e-daa1-42b5-ad08-13051fc62acf', 'owner', '2025-12-19 22:44:56.299888+00'),
('bcf44fbb-0cd6-4b2a-a361-ee1fd7f3f818', '245f7faf-0fab-47ea-91b2-16ef6830fb8a', 'c16b947a-185e-4116-bca7-3fce3a088385', 'owner', '2025-12-19 22:44:56.299888+00'),
('e99a7f25-f93c-4040-b740-f9302d834fb9', '4d120e41-2235-4392-baad-61538e200ca7', '5a45dabf-dbfe-4647-8488-7554cf1a7d28', 'owner', '2025-12-19 22:44:56.299888+00'),
('7363ecdb-11be-4860-9779-6a51d51f8acd', '4161ee82-be97-4fa8-9017-5c40be3ebe19', '248ea2ab-9633-4deb-8b61-30d75996d2a6', 'owner', '2025-12-19 22:44:56.299888+00'),
('fb06133e-59f0-4023-9900-f141e3bd7e30', 'ef17dc12-9912-4aef-8add-c87fc3c40b7b', '864212c7-14e8-4856-8f7c-72ce407a72ae', 'owner', '2026-01-05 22:51:34.706211+00'),
('87cdcdb4-3c14-4202-bce2-fdbb240f2344', '87415775-15fc-42f9-8fe4-cd7da28f0974', 'db876aac-0713-4ec9-a13f-7abe2b701d8a', 'owner', '2026-01-06 14:02:24.557627+00')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- CMO BRAND PROFILES
-- ============================================
INSERT INTO cmo_brand_profiles (id, workspace_id, tenant_id, brand_name, tagline, mission_statement, unique_value_proposition, industry, brand_voice, brand_tone, key_differentiators, core_values, messaging_pillars, created_at, updated_at) VALUES
('f7d516c3-ba2b-45f6-a02a-498e398e285a', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'UbiGrowth', 'Your AI Marketing Team', 'Democratize enterprise marketing capabilities for growing businesses', 'AI-powered marketing automation that thinks like a CMO', 'Marketing Technology', 'Expert yet approachable', 'Confident and data-driven', ARRAY['Full AI automation', 'Multi-tenant architecture', 'Real-time optimization'], ARRAY['Innovation', 'Simplicity', 'Results'], ARRAY['Automation', 'Intelligence', 'Growth'], '2025-12-04 03:22:01.986525+00', '2025-12-04 03:22:01.986525+00'),
('f25dd946-ae09-48ae-a813-169bc5e6f0bb', '4161ee82-be97-4fa8-9017-5c40be3ebe19', '4161ee82-be97-4fa8-9017-5c40be3ebe19', 'First Touch Coaching', 'Where Soccer Dreams Begin', 'Empowering young athletes to develop their soccer skills, confidence, and love for the game through personalized coaching and structured programs.', 'Expert youth soccer coaching with personalized attention, proven developmental curriculum, and a focus on building lifelong athletes.', 'Youth Sports / Soccer Coaching', 'Encouraging, Energetic, Supportive', 'Friendly and approachable with parents, motivating with players', ARRAY['Small group training for personalized attention', 'Age-appropriate skill development', 'Professional coaching staff', 'Flexible scheduling options'], ARRAY['Player Development', 'Fun & Engagement', 'Sportsmanship', 'Individual Growth', 'Community Building'], ARRAY[]::text[], '2025-12-06 03:03:03.685886+00', '2025-12-06 03:03:03.685886+00')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- CMO ICP SEGMENTS
-- ============================================
INSERT INTO cmo_icp_segments (id, workspace_id, tenant_id, segment_name, segment_description, is_primary, priority_score, company_size, industry_verticals, job_titles, pain_points, goals, preferred_channels, created_at, updated_at) VALUES
('0c2f4b97-11ae-4135-8fcb-e47c262b04ae', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Growth-Stage CMOs', 'Marketing leaders at Series A-C startups seeking automation', true, 90, '50-500 employees', ARRAY['SaaS', 'Fintech', 'E-commerce'], ARRAY['CMO', 'VP Marketing', 'Head of Growth'], ARRAY['Manual campaign management', 'Limited budget', 'Small team'], ARRAY['Scale marketing output', 'Improve ROI', 'Automate repetitive tasks'], ARRAY['LinkedIn', 'Email', 'Webinars'], '2025-12-04 03:22:10.239523+00', '2025-12-04 03:22:10.239523+00'),
('ffd14eae-449b-40b0-b8bf-d1ad85d5d96d', '4161ee82-be97-4fa8-9017-5c40be3ebe19', '4161ee82-be97-4fa8-9017-5c40be3ebe19', 'Camp Parents', 'Parents of kids ages 6-14 looking for summer soccer camps', true, 90, NULL, ARRAY[]::text[], ARRAY[]::text[], ARRAY['Finding quality summer activities for kids', 'Keeping kids active and engaged', 'Affordable camp options', 'Flexible scheduling around work'], ARRAY['Kids develop soccer skills', 'Children stay active during summer', 'Social development through team sports', 'Fun and safe environment'], ARRAY['email', 'sms', 'facebook'], '2025-12-06 03:03:03.685886+00', '2025-12-06 03:03:03.685886+00'),
('193a91bc-f676-4a70-b3e1-dfb6bce983c1', '4161ee82-be97-4fa8-9017-5c40be3ebe19', '4161ee82-be97-4fa8-9017-5c40be3ebe19', 'Private Lesson Seekers', 'Parents seeking personalized 1-on-1 or small group training for skill advancement', false, 75, NULL, ARRAY[]::text[], ARRAY[]::text[], ARRAY['Kid wants to improve specific skills', 'Team tryouts coming up', 'Need more personalized attention', 'Generic group sessions not challenging enough'], ARRAY['Accelerated skill development', 'Make the travel/select team', 'College soccer preparation', 'Position-specific training'], ARRAY['email', 'phone', 'referral'], '2025-12-06 03:03:03.685886+00', '2025-12-06 03:03:03.685886+00')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- CMO OFFERS
-- ============================================
INSERT INTO cmo_offers (id, workspace_id, tenant_id, offer_name, offer_type, description, features, key_benefits, target_segments, is_flagship, status, pricing_model, created_at, updated_at) VALUES
('f3c254dc-d3fc-40ec-8fe2-c0129f3ac7ea', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'AI CMO Pro', 'subscription', 'Full AI marketing automation suite with campaign orchestration', ARRAY['90-day planning', 'Funnel builder', 'Content engine', 'Analytics'], ARRAY['10x faster campaign creation', 'AI-powered optimization', 'Multi-channel automation'], ARRAY['Growth-Stage CMOs'], true, 'active', 'monthly_subscription', '2025-12-04 03:22:13.931378+00', '2025-12-04 03:22:13.931378+00')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- CMO FUNNELS
-- ============================================
INSERT INTO cmo_funnels (id, workspace_id, tenant_id, funnel_name, funnel_type, description, target_icp_segments, target_offers, total_budget, expected_conversion_rate, status, plan_id, created_at, updated_at) VALUES
('c2fdbaf1-cc2c-4f92-8a05-86ef71bd238f', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Enterprise Lead Gen Funnel', 'lead_generation', 'Multi-stage funnel targeting growth-stage CMOs', ARRAY['Growth-Stage CMOs'], ARRAY['AI CMO Pro'], 50000, 12.5, 'active', 'a517d29d-4fe5-456e-b05f-544e27032fc1', '2025-12-04 03:22:28.561422+00', '2025-12-04 03:22:28.561422+00'),
('1c77ae83-9190-4737-82d6-ef6fee5e2bde', '4161ee82-be97-4fa8-9017-5c40be3ebe19', '4161ee82-be97-4fa8-9017-5c40be3ebe19', 'Camp Registration', 'lead_nurture', 'Nurture funnel for summer camp registrations - from inquiry to enrolled', ARRAY['Camp Parents'], ARRAY[]::text[], 0, 0, 'active', NULL, '2025-12-06 03:03:03.685886+00', '2025-12-06 03:03:03.685886+00'),
('a5bc5bc3-94f7-4e98-86f6-5662caf9dc56', '4161ee82-be97-4fa8-9017-5c40be3ebe19', '4161ee82-be97-4fa8-9017-5c40be3ebe19', 'Private Lessons', 'lead_nurture', 'Conversion funnel for private lesson inquiries to booking', ARRAY['Private Lesson Seekers'], ARRAY[]::text[], 0, 0, 'active', NULL, '2025-12-06 03:03:03.685886+00', '2025-12-06 03:03:03.685886+00')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- CMO MARKETING PLANS
-- ============================================
INSERT INTO cmo_marketing_plans (id, workspace_id, tenant_id, plan_name, plan_type, status, executive_summary, start_date, end_date, primary_objectives, budget_allocation, key_metrics, month_1_plan, month_2_plan, month_3_plan, created_at, updated_at) VALUES
('a517d29d-4fe5-456e-b05f-544e27032fc1', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Q1 2025 Growth Initiative', '90-day', 'active', 'Drive 500 MQLs through multi-channel AI-powered campaigns', '2025-01-01', '2025-03-31', '[{"metric": "mqls", "objective": "Generate 500 MQLs", "target": 500}, {"metric": "conversion_rate", "objective": "Achieve 15% conversion rate", "target": 15}]'::jsonb, '{"content": 10000, "email": 15000, "events": 5000, "linkedin": 20000, "total": 50000}'::jsonb, '[{"baseline": 100, "metric": "MQLs", "target": 500}, {"baseline": 150, "metric": "CAC", "target": 100}]'::jsonb, '{"activities": ["Analytics setup", "Content creation", "Audience building"], "focus": "Foundation"}'::jsonb, '{"activities": ["Campaign activation", "A/B testing", "Optimization"], "focus": "Launch"}'::jsonb, '{"activities": ["Budget reallocation", "Winning campaign scale", "Q2 planning"], "focus": "Scale"}'::jsonb, '2025-12-04 03:22:19.940367+00', '2025-12-04 03:22:19.940367+00')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- INDUSTRY VERTICALS (Reference Data)
-- ============================================
INSERT INTO industry_verticals (id, name, aliases, created_at) VALUES
(1, 'Accounting & Finance', ARRAY['accounting', 'finance', 'financial'], '2025-12-19 22:52:05.349737+00'),
(2, 'Advertising & Marketing', ARRAY['advertising', 'marketing', 'ads', 'media buying'], '2025-12-19 22:52:05.349737+00'),
(3, 'Aerospace & Defense', ARRAY['aerospace', 'defense', 'aviation'], '2025-12-19 22:52:05.349737+00'),
(4, 'Agriculture & Farming', ARRAY['agriculture', 'farming', 'agri', 'agribusiness'], '2025-12-19 22:52:05.349737+00'),
(5, 'Automotive', ARRAY['auto', 'car', 'vehicle', 'cars'], '2025-12-19 22:52:05.349737+00'),
(6, 'Banking & Financial Services', ARRAY['banking', 'fintech', 'bank'], '2025-12-19 22:52:05.349737+00'),
(7, 'Biotechnology & Pharmaceuticals', ARRAY['biotech', 'pharma', 'pharmaceuticals'], '2025-12-19 22:52:05.349737+00'),
(8, 'Construction & Engineering', ARRAY['construction', 'engineering', 'building'], '2025-12-19 22:52:05.349737+00'),
(9, 'Consulting & Professional Services', ARRAY['consulting', 'professional services'], '2025-12-19 22:52:05.349737+00'),
(10, 'Consumer Goods & Retail', ARRAY['consumer goods', 'retail', 'cpg'], '2025-12-19 22:52:05.349737+00'),
(11, 'E-commerce', ARRAY['ecommerce', 'online retail', 'online store'], '2025-12-19 22:52:05.349737+00'),
(12, 'Education & Training', ARRAY['education', 'training', 'edtech', 'learning'], '2025-12-19 22:52:05.349737+00'),
(13, 'Energy & Utilities', ARRAY['energy', 'utilities', 'power', 'electricity'], '2025-12-19 22:52:05.349737+00'),
(14, 'Entertainment & Media', ARRAY['entertainment', 'media', 'content'], '2025-12-19 22:52:05.349737+00'),
(15, 'Environmental Services', ARRAY['environmental', 'sustainability', 'green'], '2025-12-19 22:52:05.349737+00'),
(16, 'Food & Beverage', ARRAY['food', 'beverage', 'f&b', 'restaurant'], '2025-12-19 22:52:05.349737+00'),
(17, 'Government & Public Sector', ARRAY['government', 'public sector', 'gov'], '2025-12-19 22:52:05.349737+00'),
(18, 'Healthcare & Medical', ARRAY['healthcare', 'medical', 'health', 'hospital'], '2025-12-19 22:52:05.349737+00'),
(19, 'Hospitality & Tourism', ARRAY['hospitality', 'tourism', 'hotel', 'travel'], '2025-12-19 22:52:05.349737+00'),
(20, 'Human Resources & Staffing', ARRAY['hr', 'human resources', 'staffing', 'recruiting'], '2025-12-19 22:52:05.349737+00'),
(21, 'Information Technology', ARRAY['it', 'tech', 'technology', 'software'], '2025-12-19 22:52:05.349737+00'),
(22, 'Insurance', ARRAY['insurance', 'insurtech'], '2025-12-19 22:52:05.349737+00'),
(23, 'Legal Services', ARRAY['legal', 'law', 'attorney', 'lawyer'], '2025-12-19 22:52:05.349737+00'),
(24, 'Logistics & Transportation', ARRAY['logistics', 'transportation', 'shipping'], '2025-12-19 22:52:05.349737+00'),
(25, 'Manufacturing', ARRAY['manufacturing', 'industrial', 'factory'], '2025-12-19 22:52:05.349737+00'),
(26, 'Non-Profit & NGO', ARRAY['nonprofit', 'ngo', 'charity'], '2025-12-19 22:52:05.349737+00'),
(27, 'Real Estate & Property', ARRAY['real estate', 'property', 'realty'], '2025-12-19 22:52:05.349737+00'),
(28, 'Restaurants & Food Service', ARRAY['restaurant', 'food service', 'dining'], '2025-12-19 22:52:05.349737+00'),
(29, 'SaaS & Software', ARRAY['saas', 'software', 'app'], '2025-12-19 22:52:05.349737+00'),
(30, 'Sports & Recreation', ARRAY['sports', 'recreation', 'fitness'], '2025-12-19 22:52:05.349737+00'),
(31, 'Telecommunications', ARRAY['telecom', 'telecommunications', 'telco'], '2025-12-19 22:52:05.349737+00'),
(32, 'Travel & Leisure', ARRAY['travel', 'leisure', 'vacation'], '2025-12-19 22:52:05.349737+00'),
(33, 'Other', ARRAY[]::text[], '2025-12-19 22:52:05.349737+00')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- EMAIL SEQUENCES
-- ============================================
INSERT INTO email_sequences (id, workspace_id, name, description, trigger_type, status, total_steps, enrolled_count, completed_count, created_by, created_at, updated_at) VALUES
('039d2f35-bcd2-42d5-940d-dd1e2345c21f', 'b55dec7f-a940-403e-9a7e-13b6d067f7cd', 'Nice to meet you series', 'Nice to meet you', 'new_lead', 'active', 0, 0, 0, '42e61c6e-daa1-42b5-ad08-13051fc62acf', '2025-12-11 22:13:31.974655+00', '2025-12-11 22:13:53.824033+00'),
('f868b1f6-9189-461d-99bb-167d0d2502be', 'b55dec7f-a940-403e-9a7e-13b6d067f7cd', 'Lunch series', 'time to each lunch', 'status_change', 'active', 6, 1, 0, '42e61c6e-daa1-42b5-ad08-13051fc62acf', '2025-12-19 21:55:09.800933+00', '2025-12-19 21:58:06.779269+00')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- EMAIL SEQUENCE STEPS
-- ============================================
INSERT INTO email_sequence_steps (id, sequence_id, step_order, subject, body, delay_days, created_at, updated_at) VALUES
('08a2d026-6381-430e-a369-8ffe637c772d', 'f868b1f6-9189-461d-99bb-167d0d2502be', 1, 'A Quick Hello from [Your Company Name]', E'Hi A Koelink,\n\nHope you''re having a productive week.\n\nMy name is [Your Name] from [Your Company Name]. We specialize in helping businesses like yours [mention a broad, relevant benefit based on your company''s offering, even without industry info].\n\nBest regards,\n[Your Name]', 0, '2025-12-19 21:55:36.084862+00', '2025-12-19 21:55:36.084862+00'),
('1cb51371-9316-4334-ba19-a3e284f56e5e', 'f868b1f6-9189-461d-99bb-167d0d2502be', 2, 'A Koelink, thought this might be helpful...', E'Hi A Koelink,\n\nFollowing up on my previous email. I understand you''re busy, but I wanted to share something that might be relevant.\n\nCheers,\n[Your Name]', 3, '2025-12-19 21:55:36.28632+00', '2025-12-19 21:55:36.28632+00'),
('f5dd352f-b817-44d2-8b5b-5bd03e4a63b8', 'f868b1f6-9189-461d-99bb-167d0d2502be', 3, 'Quick question for you, A Koelink', E'Hi A Koelink,\n\nJust circling back one more time.\n\nBest,\n[Your Name]', 4, '2025-12-19 21:55:36.455972+00', '2025-12-19 21:55:36.455972+00'),
('ff9c4f98-69fd-4e75-820c-b6d6b12a3fd6', 'f868b1f6-9189-461d-99bb-167d0d2502be', 4, 'Could [Your Company Name] help with [generic problem statement]?', E'Hi A Koelink,\n\nI haven''t heard back, which is completely fine!\n\nThanks,\n[Your Name]', 5, '2025-12-19 21:55:36.622623+00', '2025-12-19 21:55:36.622623+00'),
('5f1f2cb2-5219-457e-8414-4dc3412211b8', 'f868b1f6-9189-461d-99bb-167d0d2502be', 5, 'Closing the loop with you, A Koelink', E'Hi A Koelink,\n\nThis will be my last email for now.\n\nSincerely,\n[Your Name]', 7, '2025-12-19 21:55:36.867973+00', '2025-12-19 21:55:36.867973+00'),
('b3069239-c547-474e-b96a-9ae6ddf97fcc', 'f868b1f6-9189-461d-99bb-167d0d2502be', 6, 'fdsafdsa', 'fdsfdsa', 5, '2025-12-19 21:57:20.492367+00', '2025-12-19 21:57:20.492367+00')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- SEQUENCE ENROLLMENTS
-- ============================================
INSERT INTO sequence_enrollments (id, workspace_id, sequence_id, lead_id, status, current_step, next_email_at, created_at, updated_at) VALUES
('70917085-baf4-44cd-918e-d346a188c56a', 'b55dec7f-a940-403e-9a7e-13b6d067f7cd', 'f868b1f6-9189-461d-99bb-167d0d2502be', 'f3181fdb-40fa-4901-be2f-f226211332a6', 'active', 1, '2025-12-19 21:56:58.017+00', '2025-12-19 21:56:58.199465+00', '2025-12-19 21:56:58.199465+00'),
('feff4133-5695-4f8f-a038-00f53971b2ce', 'b55dec7f-a940-403e-9a7e-13b6d067f7cd', 'f868b1f6-9189-461d-99bb-167d0d2502be', 'bf4c7951-7972-459b-8a1e-63572edd28ac', 'active', 1, '2025-12-19 21:58:03.682+00', '2025-12-19 21:58:03.849883+00', '2025-12-19 21:58:03.849883+00')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- DEALS
-- ============================================
INSERT INTO deals (id, workspace_id, lead_id, name, value, stage, status, probability, expected_close_date, actual_close_date, notes, source, data_mode, created_by, created_at, updated_at) VALUES
('7a36d1ba-6d7e-45eb-9656-83563acd8c33', 'b55dec7f-a940-403e-9a7e-13b6d067f7cd', '11df5215-6e27-4f7a-a51a-9e62670415cd', 'BrightWave Subsc. Deal', 0, 'negotiation', 'open', 75, '2025-12-24', '2025-12-20', 'Some interesting notes', 'user', 'live', '42e61c6e-daa1-42b5-ad08-13051fc62acf', '2025-12-15 16:07:15.101012+00', '2025-12-23 01:24:36.793554+00'),
('b781fd66-9a28-4118-ac37-fa3d9a725407', 'b55dec7f-a940-403e-9a7e-13b6d067f7cd', 'dfa0afc5-de65-492d-a836-0abc54e3d628', 'Embrace yourself', 1000, 'qualification', 'open', 25, '2025-12-19', NULL, NULL, 'user', 'live', '42e61c6e-daa1-42b5-ad08-13051fc62acf', '2025-12-20 01:23:06.132625+00', '2025-12-23 01:24:36.793554+00'),
('3b455844-a407-4eb8-8304-6fc724ca0728', 'b55dec7f-a940-403e-9a7e-13b6d067f7cd', '8342a9b1-c370-46bc-bdd7-4b38da8468d4', 'fdsafdsa', 50000, 'closed_lost', 'lost', 10, NULL, '2025-12-20', NULL, 'user', 'live', '42e61c6e-daa1-42b5-ad08-13051fc62acf', '2025-12-20 01:24:23.028264+00', '2025-12-23 01:24:36.793554+00'),
('e696b466-d1e2-4633-b68d-ad1390177f8a', 'b55dec7f-a940-403e-9a7e-13b6d067f7cd', 'df2ba75b-e41d-45e6-97af-023d66d5b070', 'Buying Toes for necklace', 700, 'qualification', 'open', 100, '2025-12-23', '2025-12-20', 'Winner Winner Chicken Dinner', 'user', 'live', '42e61c6e-daa1-42b5-ad08-13051fc62acf', '2025-12-20 01:21:37.780519+00', '2025-12-23 02:09:20.096075+00')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- TASKS
-- ============================================
INSERT INTO tasks (id, workspace_id, lead_id, deal_id, title, description, task_type, priority, status, due_date, completed_at, assigned_to, created_by, created_at, updated_at) VALUES
('350c04ed-7777-49b3-a817-aee353a295d6', 'b55dec7f-a940-403e-9a7e-13b6d067f7cd', '85cc99ba-a8a3-4451-af15-d180d0fa8736', NULL, 'Follow up with Sarah Johnson', 'Quick scheduled follow-up', 'follow_up', 'high', 'pending', '2025-12-19 22:38:07.765+00', NULL, NULL, '42e61c6e-daa1-42b5-ad08-13051fc62acf', '2025-12-19 21:38:08.310598+00', '2025-12-19 21:38:08.310598+00'),
('920be5ec-196d-4e9f-8d5a-deb0ece829c0', 'b55dec7f-a940-403e-9a7e-13b6d067f7cd', 'df2ba75b-e41d-45e6-97af-023d66d5b070', NULL, 'fda', NULL, 'follow_up', 'medium', 'completed', NULL, '2025-12-19 21:53:56.584+00', NULL, '42e61c6e-daa1-42b5-ad08-13051fc62acf', '2025-12-19 21:53:42.296506+00', '2025-12-19 21:53:56.752364+00'),
('596f3bca-5f09-40bc-9d90-4bc8ee145fc7', 'b55dec7f-a940-403e-9a7e-13b6d067f7cd', '658c9c51-6783-4510-a3fa-c4d59401bf1f', NULL, 'eat lunch', 'you must be hungry', 'meeting', 'medium', 'completed', NULL, '2025-12-19 21:53:59.376+00', NULL, '42e61c6e-daa1-42b5-ad08-13051fc62acf', '2025-12-19 21:52:48.785322+00', '2025-12-19 21:53:59.55052+00')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- AI SETTINGS - EMAIL
-- ============================================
INSERT INTO ai_settings_email (tenant_id, email_provider, from_address, reply_to_address, sender_name, is_connected, updated_at) VALUES
('4161ee82-be97-4fa8-9017-5c40be3ebe19', 'resend', 'bill@ubigrowth.ai', 'bill@ubigrowth.com', 'Bill Lupo', true, '2026-01-06 23:53:13.147+00'),
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'resend', '', '', '', true, '2025-12-21 06:22:00.363088+00'),
('245f7faf-0fab-47ea-91b2-16ef6830fb8a', 'resend', '', '', '', true, '2025-12-21 06:22:00.363088+00'),
('4d120e41-2235-4392-baad-61538e200ca7', 'resend', 'joshua@plantpr.com', 'joshua@plantpr.com', 'Joshua Plant', true, '2025-12-21 06:22:00.363088+00'),
('b55dec7f-a940-403e-9a7e-13b6d067f7cd', 'resend', 'omid+aicmo@ubigrowth.com', 'omid+aicmoreply@ubigrowth.com', 'Omid from AI CMO', true, '2025-12-21 06:22:00.363088+00'),
('81dc2cb8-67ae-4608-9987-37ee864c87b0', 'resend', 'steve@brainsurgeryteam.com', 'sblaising@brainsurgeryinc.com', 'Brain Surgery Inc', true, '2026-01-05 14:41:01.073+00')
ON CONFLICT (tenant_id) DO NOTHING;

-- ============================================
-- AI SETTINGS - VOICE
-- ============================================
INSERT INTO ai_settings_voice (tenant_id, voice_provider, default_elevenlabs_voice_id, elevenlabs_model, is_connected, updated_at) VALUES
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'vapi', 'EXAVITQu4vr4xnSDxMaL', 'eleven_multilingual_v2', true, '2025-12-21 06:19:28.623483+00'),
('245f7faf-0fab-47ea-91b2-16ef6830fb8a', 'vapi', 'EXAVITQu4vr4xnSDxMaL', 'eleven_multilingual_v2', true, '2025-12-21 06:19:28.623483+00'),
('81dc2cb8-67ae-4608-9987-37ee864c87b0', 'vapi', 'EXAVITQu4vr4xnSDxMaL', 'eleven_multilingual_v2', true, '2025-12-21 06:19:28.623483+00'),
('b55dec7f-a940-403e-9a7e-13b6d067f7cd', 'vapi', 'EXAVITQu4vr4xnSDxMaL', 'eleven_multilingual_v2', true, '2025-12-21 06:19:28.623483+00'),
('4d120e41-2235-4392-baad-61538e200ca7', 'vapi', 'EXAVITQu4vr4xnSDxMaL', 'eleven_multilingual_v2', true, '2025-12-21 06:19:28.623483+00'),
('4161ee82-be97-4fa8-9017-5c40be3ebe19', 'vapi', 'EXAVITQu4vr4xnSDxMaL', 'eleven_multilingual_v2', true, '2026-01-05 23:10:11.356+00')
ON CONFLICT (tenant_id) DO NOTHING;

-- ============================================
-- CAMPAIGN METRICS
-- ============================================
INSERT INTO campaign_metrics (id, workspace_id, campaign_id, impressions, clicks, conversions, revenue, cost, sent_count, delivered_count, open_count, bounce_count, reply_count, engagement_rate, data_mode, created_at, updated_at) VALUES
('db42f229-7537-48bb-867c-4affc15bc846', '81dc2cb8-67ae-4608-9987-37ee864c87b0', '0316972c-408a-49d6-9aaa-22052e308b1d', 0, 0, 0, 0.00, 0.00, 0, 0, 0, 0, 0, 0.00, 'live', '2025-12-15 14:42:34.296184+00', '2025-12-15 16:35:55.64368+00'),
('b8472cc9-5787-4bb4-9efa-0c8eb0dd182a', '81dc2cb8-67ae-4608-9987-37ee864c87b0', 'ff5ce922-d384-4823-b4ca-cc6200870a89', 0, 0, 0, 0.00, 0.00, 0, 0, 0, 100, 0, 0.00, 'live', '2025-12-18 16:14:12.08075+00', '2025-12-18 16:14:12.08075+00'),
('84f78a52-c650-4b37-8661-b9bb3922242d', '81dc2cb8-67ae-4608-9987-37ee864c87b0', 'b0baf3b1-270a-401d-8eaa-646e41125312', 34595278, 3454848, 340861, 17043050.00, 1000.00, 19, 19, 2, 0, 2, 9.99, 'live', '2025-12-15 16:36:31.890716+00', '2025-12-20 06:19:12.410809+00'),
('41e402f7-3be3-4641-8b04-9fa894b85630', 'b55dec7f-a940-403e-9a7e-13b6d067f7cd', '0a851556-45cf-471c-b35d-8b0f46088dfb', 11054050, 1102669, 107605, 5380250.00, 1000.00, 7, 5, 0, 2, 0, 9.98, 'live', '2025-12-17 16:48:20.617665+00', '2025-12-20 06:19:12.535167+00'),
('04e94738-fb2c-486c-bc1b-b2c5f89b75b7', 'b55dec7f-a940-403e-9a7e-13b6d067f7cd', 'ba2e779f-4762-43e9-8b48-69ec2d1b9419', 10943731, 1091646, 106480, 5324000.00, 1000.00, 2, 0, 0, 4, 0, 9.98, 'live', '2025-12-17 16:58:52.427313+00', '2025-12-20 06:19:12.660552+00'),
('e6e8ffd0-939c-434e-9e0f-922ffecb1ec3', '4161ee82-be97-4fa8-9017-5c40be3ebe19', '3e7e98ca-43de-4708-a6b5-e69097b9d117', 0, 0, 0, 0.00, 0.00, 4, 4, 0, 0, 0, 0.00, 'live', '2026-01-06 13:30:08.722835+00', '2026-01-06 13:47:13.921185+00'),
('392d6692-fea2-4aa1-a839-f65056adf323', 'b55dec7f-a940-403e-9a7e-13b6d067f7cd', '5f010f31-c996-4932-8078-7cd10601eea0', 0, 0, 0, 0.00, 0.00, 1, 1, 0, 0, 0, 0.00, 'live', '2026-01-06 20:37:12.091331+00', '2026-01-06 20:37:12.398353+00')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- PROSPECTS (Sample)
-- ============================================
INSERT INTO prospects (id, workspace_id, tenant_id, first_name, last_name, email, company, title, industry, location, linkedin_url, persona_tag, external_id, created_at, updated_at) VALUES
('4627d7ab-714a-49a2-8bc2-611e5df78f9a', '4161ee82-be97-4fa8-9017-5c40be3ebe19', '248ea2ab-9633-4deb-8b61-30d75996d2a6', 'Jane', 'Doe', 'bill@ubigrowth.com', 'Acme SaaS', 'VP Sales', 'Software', 'Remote', 'https://www.linkedin.com/in/test-jane-doe', 'vp_sales', 'DEV-TEST-001', '2025-12-09 04:10:37.372865+00', '2025-12-09 04:10:37.372865+00'),
('35b40a25-c128-4ab5-98f5-6b69c0abadf4', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'c16b947a-185e-4116-bca7-3fce3a088385', 'Test', 'Prospect', 'founder+linkedin-test@ubigrowth.com', 'Acme SaaS', 'VP Sales', 'Software', 'Remote', 'https://www.linkedin.com/in/test-prospect', 'vp_sales', 'DEV-LI-001', '2025-12-09 18:37:16.10009+00', '2025-12-09 18:37:16.10009+00'),
('a1111111-1111-1111-1111-111111111111', '4161ee82-be97-4fa8-9017-5c40be3ebe19', '248ea2ab-9633-4deb-8b61-30d75996d2a6', 'Sarah', 'Mitchell', 'sarah.mitchell@techcorp.io', 'TechCorp Industries', 'VP of Marketing', NULL, NULL, 'https://linkedin.com/in/sarahmitchell', NULL, NULL, '2025-12-09 20:22:54.886156+00', '2025-12-09 20:25:28.588868+00'),
('a2222222-2222-2222-2222-222222222222', '4161ee82-be97-4fa8-9017-5c40be3ebe19', '248ea2ab-9633-4deb-8b61-30d75996d2a6', 'James', 'Chen', 'james.chen@innovateinc.com', 'Innovate Inc', 'Director of Growth', NULL, NULL, 'https://linkedin.com/in/jameschen', NULL, NULL, '2025-12-09 20:22:54.886156+00', '2025-12-09 20:25:28.588868+00')
ON CONFLICT (id) DO NOTHING;

-- Re-enable triggers
SET session_replication_role = DEFAULT;

-- ============================================
-- NOTES ON LARGE TABLES NOT FULLY EXPORTED:
-- ============================================
-- The following tables have large datasets that exceed
-- what can be included in a static SQL file:
--
-- - leads: ~100,000+ rows
-- - assets: ~1,300+ rows
-- - channel_outbox: ~500+ rows
-- - lead_activities: ~100+ rows
-- - cmo_content_assets: ~756 rows
-- - cmo_campaigns: ~20+ rows
-- - campaigns: ~24 rows
-- - campaign_runs: ~50+ rows
--
-- For complete data migration, you have two options:
--
-- OPTION 1: CSV Export (via Supabase Dashboard)
-- - Go to Table Editor > Select table > Export as CSV
-- - Import CSV into your target database
--
-- OPTION 2: pg_dump (if you have CLI access)
-- - Use pg_dump with your connection string
-- - pg_dump -d postgresql://... > backup.sql
--
-- ============================================
