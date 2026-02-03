import type { LandingPageDraft } from "./cmo/types";

export const landingTemplatePresets: LandingPageDraft[] = [
  {
    templateType: "saas",
    internalName: "SaaS Hero Lead-Gen",
    urlSlug: "saas-ai-cmo",
    heroHeadline: "Turn Your Marketing Into an Autopilot Growth Machine",
    heroSubheadline:
      "Deploy AI-driven campaigns, landing pages, and voice agents in days, not months.",
    heroSupportingPoints: [
      "Multi-channel campaigns in one hub",
      "AI agents that build and optimize for you",
      "Full CRM and voice integration"
    ],
    sections: [
      {
        type: "problem_solution",
        heading: "Manual Marketing Is Killing Your Time",
        body:
          "Most teams are stuck stitching together tools, writing endless copy, and guessing what works. AI CMO centralizes campaigns, landing pages, and voice agents into one orchestrated OS.",
        bullets: [
          "No more guessing on content and funnels",
          "No more fragmented tools and reporting",
          "No more waiting months to launch"
        ]
      },
      {
        type: "features",
        heading: "Everything You Need to Run Modern Outbound",
        body: "",
        bullets: [
          "Autopilot campaign builder across email, SMS, LinkedIn, voice",
          "AI-optimized landing pages with built-in CRM hooks",
          "AI voice agents that book meetings for you"
        ]
      },
      {
        type: "social_proof",
        heading: "Teams Using AI CMO Don't Go Back",
        body:
          "Once your campaigns run with AI automation, you stop hiring headcount to chase spreadsheets.",
        bullets: [
          "Fewer tools, more pipeline",
          "Predictable outbound at lower cost",
          "Executives finally see full-funnel visibility"
        ]
      }
    ],
    primaryCtaLabel: "Get a Demo",
    primaryCtaType: "calendar",
    formFields: [
      { name: "full_name", label: "Full Name", required: true },
      { name: "work_email", label: "Work Email", required: true },
      { name: "company", label: "Company", required: true },
      { name: "role", label: "Role", required: false }
    ]
  },
  {
    templateType: "lead_magnet",
    internalName: "Lead Magnet Download",
    urlSlug: "outbound-playbook",
    heroHeadline: "Free Playbook: Build a B2B Outbound Engine in 30 Days",
    heroSubheadline:
      "Step-by-step system to launch AI-powered outbound without hiring a full marketing team.",
    heroSupportingPoints: [
      "Frameworks, scripts, and funnels",
      "Real examples and cadences",
      "Built for B2B founders and GTM teams"
    ],
    sections: [
      {
        type: "features",
        heading: "What's Inside the Playbook",
        body: "",
        bullets: [
          "Proven outbound cadences across email, SMS, and LinkedIn",
          "Landing page layouts that actually convert",
          "AI prompts to generate content that sounds human"
        ]
      },
      {
        type: "social_proof",
        heading: "Downloaded by GTM Teams Across SaaS and Services",
        body:
          "Teams use this playbook as the starting point for their AI-powered outbound.",
        bullets: []
      }
    ],
    primaryCtaLabel: "Get the Free Playbook",
    primaryCtaType: "form",
    formFields: [
      { name: "full_name", label: "Full Name", required: true },
      { name: "work_email", label: "Work Email", required: true },
      { name: "company", label: "Company", required: false }
    ]
  },
  {
    templateType: "webinar",
    internalName: "Webinar: AI CMO Deep Dive",
    urlSlug: "webinar-ai-cmo",
    heroHeadline: "Live Session: Turn Your CRM Into an Autopilot Deal Engine",
    heroSubheadline:
      "See how AI agents build campaigns, landing pages, and voice call flows for you.",
    heroSupportingPoints: [
      "Live walkthrough of AI CMO",
      "Real campaign examples",
      "Q&A with the team"
    ],
    sections: [
      {
        type: "process",
        heading: "What We'll Cover in 45 Minutes",
        body: "",
        bullets: [
          "How to turn your ICP and offer into a complete campaign",
          "How AI voice agents plug into your sequences",
          "How ongoing optimization works in the background"
        ]
      },
      {
        type: "faq",
        heading: "Common Questions",
        body: "",
        bullets: [
          "Does this replace our marketing team?",
          "How does this connect to our CRM?",
          "What about compliance and brand voice?"
        ]
      }
    ],
    primaryCtaLabel: "Save My Seat",
    primaryCtaType: "form",
    formFields: [
      { name: "full_name", label: "Full Name", required: true },
      { name: "work_email", label: "Work Email", required: true },
      { name: "company", label: "Company", required: false }
    ]
  },
  {
    templateType: "services",
    internalName: "Services Landing",
    urlSlug: "ai-cmo-services",
    heroHeadline: "Done-With-You AI CMO for Founder-Led Teams",
    heroSubheadline:
      "We set up the OS, campaigns, landing pages, and voice agents so you can focus on closing deals.",
    heroSupportingPoints: [
      "Implementation in weeks, not quarters",
      "Battle-tested playbooks",
      "Clear KPIs and reporting"
    ],
    sections: [
      {
        type: "problem_solution",
        heading: "You Don't Need Another Agency. You Need an OS.",
        body:
          "Instead of handoffs and PDFs, you get a system that runs your outbound and content with AI automation.",
        bullets: []
      },
      {
        type: "process",
        heading: "How the Engagement Works",
        body: "",
        bullets: [
          "Discovery and ICP mapping",
          "OS and AI CMO implementation",
          "Campaign and voice agent launch",
          "Optimization and handoff"
        ]
      }
    ],
    primaryCtaLabel: "Talk to the Team",
    primaryCtaType: "calendar",
    formFields: [
      { name: "full_name", label: "Full Name", required: true },
      { name: "work_email", label: "Work Email", required: true },
      { name: "company", label: "Company", required: true }
    ]
  },
  {
    templateType: "booking",
    internalName: "Simple Booking Page",
    urlSlug: "book-ai-cmo-demo",
    heroHeadline: "See AI CMO Running on Live Data",
    heroSubheadline:
      "Book a working session to walk through campaigns, landing pages, and voice flows.",
    heroSupportingPoints: [],
    sections: [
      {
        type: "story",
        heading: "Bring a Real Use Case",
        body:
          "We'll map your ICP and offer into the OS so you see your own outbound on screen, not a canned demo.",
        bullets: []
      }
    ],
    primaryCtaLabel: "Book a Time",
    primaryCtaType: "calendar",
    formFields: []
  },
  {
    templateType: "long_form",
    internalName: "Long-Form Sales Page",
    urlSlug: "ai-cmo-long-form",
    heroHeadline: "The Operating System for AI-Driven Outbound and Growth",
    heroSubheadline:
      "If your team is serious about pipeline, AI CMO gives you the orchestration layer to run everything from one place.",
    heroSupportingPoints: [],
    sections: [
      {
        type: "story",
        heading: "Why the Old Stack Breaks at Scale",
        body:
          "CRMs, email tools, dialers, and landing page builders were never designed to be orchestrated by AI agents.",
        bullets: []
      },
      {
        type: "features",
        heading: "One OS. Multiple Agents. All Channels.",
        body: "",
        bullets: [
          "Campaign builder that takes an ICP and offer and builds everything",
          "Landing pages wired directly into the CRM and automation engine",
          "Voice agents that book meetings and log everything to the OS"
        ]
      },
      {
        type: "pricing",
        heading: "Built for Teams Who Care About ROI",
        body:
          "Pricing is transparent and directly tied to usage and outcomes, not seat-count bloat.",
        bullets: []
      }
    ],
    primaryCtaLabel: "Request Pricing & Details",
    primaryCtaType: "form",
    formFields: [
      { name: "full_name", label: "Full Name", required: true },
      { name: "work_email", label: "Work Email", required: true },
      { name: "company", label: "Company", required: true }
    ]
  }
];
