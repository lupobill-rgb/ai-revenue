// Centralized sample data for demo purposes across the platform

export const SAMPLE_LEADS = [
  { id: "sample-1", first_name: "Sarah", last_name: "Johnson", email: "sarah.johnson@luxuryresorts.com", phone: "+1-555-0101", company: "Luxury Resorts International", job_title: "VP of Marketing", status: "qualified", score: 92, source: "website", vertical: "Hotels & Resorts", created_at: "2024-11-20T10:00:00Z", tags: ["high-value", "enterprise"] },
  { id: "sample-2", first_name: "Michael", last_name: "Chen", email: "mchen@urbanproperties.com", phone: "+1-555-0102", company: "Urban Properties Group", job_title: "Marketing Director", status: "contacted", score: 78, source: "linkedin", vertical: "Multifamily Real Estate", created_at: "2024-11-22T14:30:00Z", tags: ["warm-lead"] },
  { id: "sample-3", first_name: "Emily", last_name: "Rodriguez", email: "emily@pickleballnation.com", phone: "+1-555-0103", company: "Pickleball Nation Club", job_title: "General Manager", status: "new", score: 65, source: "referral", vertical: "Pickleball Clubs & Country Clubs", created_at: "2024-11-25T09:15:00Z", tags: ["new-market"] },
  { id: "sample-4", first_name: "David", last_name: "Thompson", email: "dthompson@entertainmentplus.com", phone: "+1-555-0104", company: "Entertainment Plus Venues", job_title: "CMO", status: "qualified", score: 88, source: "email", vertical: "Entertainment Venues", created_at: "2024-11-18T16:45:00Z", tags: ["enterprise", "decision-maker"] },
  { id: "sample-5", first_name: "Jennifer", last_name: "Martinez", email: "jmartinez@healwell.com", phone: "+1-555-0105", company: "HealWell Physical Therapy", job_title: "Practice Owner", status: "converted", score: 95, source: "google_ads", vertical: "Physical Therapy", created_at: "2024-11-10T11:20:00Z", tags: ["converted", "upsell-potential"] },
  { id: "sample-6", first_name: "Robert", last_name: "Wilson", email: "rwilson@coworkspace.io", phone: "+1-555-0106", company: "CoWorkSpace Premium", job_title: "Head of Growth", status: "contacted", score: 72, source: "webinar", vertical: "Corporate Offices & Co-Working Spaces", created_at: "2024-11-23T13:00:00Z", tags: ["mid-market"] },
  { id: "sample-7", first_name: "Amanda", last_name: "Lee", email: "alee@fitnesspro.com", phone: "+1-555-0107", company: "Fitness Pro Gyms", job_title: "Regional Manager", status: "new", score: 58, source: "trade_show", vertical: "Gyms", created_at: "2024-11-28T08:30:00Z", tags: ["follow-up"] },
  { id: "sample-8", first_name: "James", last_name: "Brown", email: "jbrown@edulearn.edu", phone: "+1-555-0108", company: "EduLearn Academy", job_title: "Director of Admissions", status: "lost", score: 45, source: "cold_outreach", vertical: "Education", created_at: "2024-11-05T15:00:00Z", tags: ["lost-competitor"] },
];

export const SAMPLE_ASSETS = [
  { id: "asset-1", name: "Summer Pickleball Championship Video", description: "High-energy promotional video showcasing the annual summer championship event with pro players.", type: "video", status: "live", channel: "Pickleball Clubs & Country Clubs", created_at: "2024-11-20T10:00:00Z", preview_url: "/placeholders/pickleball-video.jpg", views: 12500 },
  { id: "asset-2", name: "Luxury Resort Welcome Email Series", description: "5-part email sequence for new resort guests with personalized recommendations.", type: "email", status: "approved", channel: "Hotels & Resorts", created_at: "2024-11-18T14:30:00Z", preview_url: "/placeholders/pickleball-email.jpg", views: 8200 },
  { id: "asset-3", name: "Urban Living Landing Page", description: "Modern landing page highlighting premium apartment amenities and virtual tours.", type: "landing_page", status: "live", channel: "Multifamily Real Estate", created_at: "2024-11-15T09:00:00Z", preview_url: "/placeholders/pickleball-landing.jpg", views: 15600 },
  { id: "asset-4", name: "Physical Therapy Consultation Voice Agent", description: "AI voice agent for scheduling initial consultations and answering FAQs.", type: "voice", status: "review", channel: "Physical Therapy", created_at: "2024-11-22T16:45:00Z", preview_url: null, views: 340 },
  { id: "asset-5", name: "Entertainment Venue Social Campaign", description: "Multi-platform social media campaign for upcoming concert series.", type: "landing_page", status: "draft", channel: "Entertainment Venues", created_at: "2024-11-25T11:20:00Z", preview_url: "/placeholders/pickleball-social.jpg", views: 0 },
  { id: "asset-6", name: "Gym Membership Promo Email", description: "New Year promotion email with special membership offers.", type: "email", status: "approved", channel: "Gyms", created_at: "2024-11-24T08:00:00Z", preview_url: "/placeholders/pickleball-email.jpg", views: 4300 },
];

export const SAMPLE_AUTOMATION_JOBS = [
  { id: "job-1", job_type: "daily_automation", status: "completed", scheduled_at: new Date().toISOString(), started_at: new Date(Date.now() - 3600000).toISOString(), completed_at: new Date(Date.now() - 3500000).toISOString(), result: { contentPublished: 3, leadsNurtured: 12, campaignsOptimized: 2 }, error_message: null },
  { id: "job-2", job_type: "content_publish", status: "completed", scheduled_at: new Date(Date.now() - 7200000).toISOString(), started_at: new Date(Date.now() - 7200000).toISOString(), completed_at: new Date(Date.now() - 7100000).toISOString(), result: { contentPublished: 1 }, error_message: null },
  { id: "job-3", job_type: "lead_nurture", status: "completed", scheduled_at: new Date(Date.now() - 14400000).toISOString(), started_at: new Date(Date.now() - 14400000).toISOString(), completed_at: new Date(Date.now() - 14300000).toISOString(), result: { leadsNurtured: 8 }, error_message: null },
  { id: "job-4", job_type: "performance_sync", status: "running", scheduled_at: new Date(Date.now() - 300000).toISOString(), started_at: new Date(Date.now() - 300000).toISOString(), completed_at: null, result: {}, error_message: null },
  { id: "job-5", job_type: "campaign_optimization", status: "pending", scheduled_at: new Date(Date.now() + 3600000).toISOString(), started_at: null, completed_at: null, result: {}, error_message: null },
  { id: "job-6", job_type: "daily_automation", status: "completed", scheduled_at: new Date(Date.now() - 86400000).toISOString(), started_at: new Date(Date.now() - 86400000).toISOString(), completed_at: new Date(Date.now() - 86300000).toISOString(), result: { contentPublished: 5, leadsNurtured: 18, campaignsOptimized: 3 }, error_message: null },
  { id: "job-7", job_type: "lead_nurture", status: "failed", scheduled_at: new Date(Date.now() - 172800000).toISOString(), started_at: new Date(Date.now() - 172800000).toISOString(), completed_at: new Date(Date.now() - 172700000).toISOString(), result: {}, error_message: "Rate limit exceeded" },
];

export const SAMPLE_CONTENT_CALENDAR = [
  { id: "content-1", title: "Weekly Newsletter - December Edition", content_type: "email", channel: "Email", scheduled_at: new Date().toISOString(), published_at: null, status: "scheduled", asset_id: null, content: { description: "Monthly highlights and upcoming events" } },
  { id: "content-2", title: "LinkedIn Thought Leadership Post", content_type: "social", channel: "LinkedIn", scheduled_at: new Date(Date.now() + 86400000).toISOString(), published_at: null, status: "scheduled", asset_id: null, content: { description: "Industry insights and trends" } },
  { id: "content-3", title: "Instagram Reel - Behind the Scenes", content_type: "social", channel: "Instagram", scheduled_at: new Date(Date.now() + 172800000).toISOString(), published_at: null, status: "scheduled", asset_id: null, content: { description: "Team culture showcase" } },
  { id: "content-4", title: "Product Launch Email", content_type: "email", channel: "Email", scheduled_at: new Date(Date.now() - 86400000).toISOString(), published_at: new Date(Date.now() - 86400000).toISOString(), status: "published", asset_id: null, content: { description: "New feature announcement" } },
  { id: "content-5", title: "Facebook Event Promotion", content_type: "social", channel: "Facebook", scheduled_at: new Date(Date.now() + 259200000).toISOString(), published_at: null, status: "scheduled", asset_id: null, content: { description: "Upcoming webinar promotion" } },
];

export const SAMPLE_DEALS = [
  { id: "deal-1", name: "Luxury Resorts Enterprise Deal", value: 125000, stage: "negotiation", lead_id: "sample-1", expected_close_date: "2024-12-15", probability: 75, created_at: "2024-11-15T10:00:00Z" },
  { id: "deal-2", name: "Urban Properties Annual Contract", value: 48000, stage: "qualified", lead_id: "sample-2", expected_close_date: "2024-12-28", probability: 50, created_at: "2024-11-20T14:30:00Z" },
  { id: "deal-3", name: "Pickleball Nation Membership", value: 24000, stage: "prospecting", lead_id: "sample-3", expected_close_date: "2025-01-15", probability: 25, created_at: "2024-11-25T09:15:00Z" },
  { id: "deal-4", name: "Entertainment Plus Multi-Year", value: 250000, stage: "proposal", lead_id: "sample-4", expected_close_date: "2024-12-20", probability: 65, created_at: "2024-11-18T16:45:00Z" },
  { id: "deal-5", name: "HealWell Expansion", value: 36000, stage: "won", lead_id: "sample-5", expected_close_date: "2024-11-30", probability: 100, created_at: "2024-11-10T11:20:00Z", actual_close_date: "2024-11-28" },
];

export const SAMPLE_TASKS = [
  { id: "task-1", title: "Follow up with Sarah Johnson", description: "Discuss enterprise pricing options", due_date: new Date(Date.now() + 86400000).toISOString(), priority: "high", status: "pending", lead_id: "sample-1", task_type: "follow_up" },
  { id: "task-2", title: "Send proposal to Entertainment Plus", description: "Include multi-year discount options", due_date: new Date(Date.now() + 172800000).toISOString(), priority: "high", status: "pending", lead_id: "sample-4", task_type: "proposal" },
  { id: "task-3", title: "Schedule demo with Urban Properties", description: "Product walkthrough for marketing team", due_date: new Date(Date.now() + 259200000).toISOString(), priority: "medium", status: "pending", lead_id: "sample-2", task_type: "demo" },
  { id: "task-4", title: "Call back Robert Wilson", description: "Answer questions about integrations", due_date: new Date().toISOString(), priority: "medium", status: "completed", lead_id: "sample-6", task_type: "call" },
  { id: "task-5", title: "Send case study to Jennifer", description: "Include ROI metrics from similar clients", due_date: new Date(Date.now() - 86400000).toISOString(), priority: "low", status: "completed", lead_id: "sample-5", task_type: "email" },
];

export const SAMPLE_EMAIL_SEQUENCES = [
  { id: "seq-1", name: "New Lead Welcome Series", description: "5-part nurture sequence for new leads", status: "active", total_steps: 5, enrolled_count: 45, completed_count: 12, trigger_type: "lead_created" },
  { id: "seq-2", name: "Re-engagement Campaign", description: "Win back inactive leads", status: "active", total_steps: 3, enrolled_count: 28, completed_count: 8, trigger_type: "manual" },
  { id: "seq-3", name: "Post-Demo Follow-up", description: "Automated follow-up after product demos", status: "active", total_steps: 4, enrolled_count: 15, completed_count: 6, trigger_type: "demo_completed" },
  { id: "seq-4", name: "Onboarding Series", description: "Welcome sequence for new customers", status: "draft", total_steps: 7, enrolled_count: 0, completed_count: 0, trigger_type: "deal_won" },
];

// Dashboard metrics
export const SAMPLE_DASHBOARD_METRICS = {
  totalRevenue: 280770,
  totalCost: 24000,
  roi: 1069.9,
  activeCampaigns: 5,
};

export const SAMPLE_CAMPAIGN_PERFORMANCE = [
  { id: "camp-1", name: "Summer Pickleball Championship", channel: "Video", views: 45200, clicks: 3820, revenue: 28450, cost: 2400, roi: 1085.4, status: "active" },
  { id: "camp-2", name: "Luxury Resort Email Blast", channel: "Email", views: 125000, clicks: 18750, revenue: 156780, cost: 8500, roi: 1744.5, status: "active" },
  { id: "camp-3", name: "Urban Living Social Campaign", channel: "Social", views: 89400, clicks: 7150, revenue: 42800, cost: 5200, roi: 723.1, status: "active" },
  { id: "camp-4", name: "Gym Membership Promo", channel: "Email", views: 67300, clicks: 4890, revenue: 18720, cost: 3100, roi: 503.9, status: "active" },
  { id: "camp-5", name: "Entertainment Venue Ads", channel: "Social", views: 234500, clicks: 9870, revenue: 34020, cost: 4800, roi: 608.8, status: "active" },
];
