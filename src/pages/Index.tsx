import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import Logo from "@/components/Logo";
import {
  Zap,
  Mail,
  Phone,
  BarChart3,
  Target,
  MessageSquare,
  Workflow,
  Shield,
  Lock,
  CreditCard,
  ArrowRight,
  CheckCircle2,
  Layers,
  Send,
  LineChart,
  Globe,
  Users,
  Building2,
  Briefcase,
  GraduationCap,
  Home,
  Store,
  Heart,
  Sparkles,
} from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/dashboard");
      }
    });
  }, [navigate]);

  const features = [
    { icon: Target, title: "Campaign Strategy", desc: "AI-driven targeting and positioning" },
    { icon: Mail, title: "Email Sequences", desc: "Multi-step automated nurture flows" },
    { icon: MessageSquare, title: "SMS Sequences", desc: "Text-based engagement campaigns" },
    { icon: Globe, title: "Funnel Copy", desc: "Conversion-optimized landing content" },
    { icon: Phone, title: "Voice Triggers", desc: "AI-powered call automations" },
    { icon: Workflow, title: "CRM Automation", desc: "Seamless pipeline orchestration" },
  ];

  const steps = [
    { num: "01", title: "Choose a Goal", desc: "Lead generation, nurture, reactivation, upsell, or retention." },
    { num: "02", title: "AI Builds the Campaign", desc: "Targeting, sequences, automation rules, and scheduling." },
    { num: "03", title: "Deploy with One Click", desc: "Push to CRM, SMS, email, and voice agents instantly." },
    { num: "04", title: "Unified Reporting", desc: "Track opens, replies, calls, and pipeline created." },
  ];

  const keyFeatures = [
    { icon: Sparkles, title: "Autonomous Campaign Builder", desc: "AI creates complete campaigns from a single goal" },
    { icon: Mail, title: "Email Engine", desc: "Multi-step sequences with smart personalization" },
    { icon: MessageSquare, title: "SMS Engine", desc: "Text-based outreach at scale" },
    { icon: Phone, title: "Voice Agent Triggers", desc: "AI-powered calling campaigns" },
    { icon: Workflow, title: "CRM Orchestration", desc: "Direct pipeline integration and sync" },
    { icon: LineChart, title: "Dashboards", desc: "Real-time campaign analytics and insights" },
  ];

  const industries = [
    { icon: Users, label: "Sports & Youth Programs" },
    { icon: Heart, label: "Medical / Pharma" },
    { icon: Briefcase, label: "Financial Services" },
    { icon: Building2, label: "B2B / SMB Services" },
    { icon: Home, label: "Home Services" },
    { icon: GraduationCap, label: "Education & Training" },
    { icon: Store, label: "Marketplaces" },
  ];

  const benefits = [
    "Eliminates manual campaign work",
    "Deploys multi-channel campaigns instantly",
    "Orchestrates email, SMS, voice, and CRM",
    "Reduces need for agencies",
    "Multi-tenant ready",
    "Produces measurable pipeline",
  ];

  return (
    <div className="min-h-screen bg-background font-sans">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto max-w-[1400px] px-6 sm:px-8 lg:px-12">
          <div className="flex h-20 items-center justify-between">
            <Logo className="h-8" />
            <div className="flex items-center gap-6">
              <Button variant="ghost" onClick={() => navigate("/login")} className="text-muted-foreground hover:text-foreground tracking-wide">
                Login
              </Button>
              <Button onClick={() => navigate("/dashboard")} className="gold-gradient text-primary-foreground font-semibold tracking-wide">
                Launch AI CMO
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-40 pb-32 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(190_100%_50%/0.08),transparent_50%)]" />
        <div className="mx-auto max-w-[1200px] text-center relative">
          <h1 className="font-display text-6xl md:text-8xl font-bold tracking-tight mb-8">
            Your Marketing,{" "}
            <span className="gold-gradient-text">Automated by AI.</span>
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-4xl mx-auto mb-14 leading-relaxed tracking-wide">
            AI CMO is an orchestration layer that builds and deploys full campaigns — email, SMS, funnels, and voice — directly into your CRM.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-5 mb-20">
            <Button onClick={() => navigate("/dashboard")} size="lg" className="gold-gradient text-primary-foreground font-semibold text-lg px-10 h-16 gold-glow tracking-wide">
              Launch AI CMO
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button variant="outline" size="lg" className="border-border hover:bg-secondary text-foreground text-lg px-10 h-16 tracking-wide">
              Book a Demo
            </Button>
          </div>
          
          {/* Proof Points */}
          <div className="flex flex-wrap justify-center gap-10 md:gap-20">
            <div className="flex items-center gap-3 text-muted-foreground">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              <span className="tracking-wide">Full-funnel orchestration</span>
            </div>
            <div className="flex items-center gap-3 text-muted-foreground">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              <span className="tracking-wide">Instant campaigns</span>
            </div>
            <div className="flex items-center gap-3 text-muted-foreground">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              <span className="tracking-wide">CRM + voice + SMS integrated</span>
            </div>
          </div>
        </div>
      </section>

      {/* Accent line */}
      <div className="h-px gold-gradient mx-auto max-w-5xl opacity-50" />

      {/* What AI CMO Does */}
      <section className="py-36 px-6">
        <div className="mx-auto max-w-[1400px]">
          <div className="text-center mb-20">
            <h2 className="font-display text-4xl md:text-6xl font-bold mb-6 tracking-tight">
              The AI Marketing <span className="gold-gradient-text">Orchestration Layer</span>
            </h2>
            <p className="text-xl text-muted-foreground tracking-wide">
              Generate and deploy complete marketing campaigns from a single command.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, i) => (
              <div key={i} className="group p-8 rounded-2xl border border-border bg-card hover:border-primary/50 transition-all duration-300">
                <div className="h-14 w-14 rounded-xl gold-gradient flex items-center justify-center mb-6">
                  <feature.icon className="h-7 w-7 text-primary-foreground" />
                </div>
                <h3 className="text-2xl font-semibold mb-3 tracking-tight">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-36 px-6 bg-card/50">
        <div className="mx-auto max-w-[1400px]">
          <div className="text-center mb-20">
            <h2 className="font-display text-4xl md:text-6xl font-bold mb-6 tracking-tight">
              How It <span className="gold-gradient-text">Works</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step, i) => (
              <div key={i} className="relative p-8 rounded-2xl border border-border bg-background">
                <span className="text-6xl font-bold gold-gradient-text opacity-50 font-display">{step.num}</span>
                <h3 className="text-xl font-semibold mt-6 mb-3 tracking-tight">{step.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Key Features Grid */}
      <section className="py-36 px-6">
        <div className="mx-auto max-w-[1400px]">
          <div className="text-center mb-20">
            <h2 className="font-display text-4xl md:text-6xl font-bold mb-6 tracking-tight">
              Key <span className="gold-gradient-text">Features</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {keyFeatures.map((feature, i) => (
              <div key={i} className="p-8 rounded-2xl border border-border bg-card hover:gold-glow transition-all duration-300">
                <feature.icon className="h-12 w-12 text-primary mb-6" />
                <h3 className="text-2xl font-semibold mb-3 tracking-tight">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Accent line */}
      <div className="h-px gold-gradient mx-auto max-w-5xl opacity-50" />

      {/* Industry Templates */}
      <section className="py-36 px-6 bg-card/50">
        <div className="mx-auto max-w-[1400px]">
          <div className="text-center mb-20">
            <h2 className="font-display text-4xl md:text-6xl font-bold mb-6 tracking-tight">
              Industry-Specific <span className="gold-gradient-text">Playbooks</span>
            </h2>
          </div>
          <div className="flex flex-wrap justify-center gap-5">
            {industries.map((industry, i) => (
              <div key={i} className="flex items-center gap-3 px-6 py-4 rounded-full border border-border bg-background hover:border-primary/50 transition-colors">
                <industry.icon className="h-5 w-5 text-primary" />
                <span className="font-medium tracking-wide">{industry.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Teams Use AI CMO */}
      <section className="py-36 px-6">
        <div className="mx-auto max-w-[1400px]">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
            <div>
              <h2 className="font-display text-4xl md:text-6xl font-bold mb-10 tracking-tight">
                Why Teams Use <span className="gold-gradient-text">AI CMO</span>
              </h2>
              <ul className="space-y-5">
                {benefits.map((benefit, i) => (
                  <li key={i} className="flex items-center gap-4">
                    <CheckCircle2 className="h-6 w-6 text-primary flex-shrink-0" />
                    <span className="text-lg tracking-wide">{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative">
              <div className="rounded-2xl border border-border bg-card p-10 gold-glow">
                <div className="grid grid-cols-2 gap-6">
                  <div className="p-6 rounded-xl bg-background border border-border">
                    <div className="text-4xl font-bold gold-gradient-text font-display">10x</div>
                    <div className="text-sm text-muted-foreground mt-1 tracking-wide">Faster Campaigns</div>
                  </div>
                  <div className="p-6 rounded-xl bg-background border border-border">
                    <div className="text-4xl font-bold gold-gradient-text font-display">4+</div>
                    <div className="text-sm text-muted-foreground mt-1 tracking-wide">Channels</div>
                  </div>
                  <div className="p-6 rounded-xl bg-background border border-border">
                    <div className="text-4xl font-bold gold-gradient-text font-display">100%</div>
                    <div className="text-sm text-muted-foreground mt-1 tracking-wide">Automated</div>
                  </div>
                  <div className="p-6 rounded-xl bg-background border border-border">
                    <div className="text-4xl font-bold gold-gradient-text font-display">$0</div>
                    <div className="text-sm text-muted-foreground mt-1 tracking-wide">Agency Fees</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Security & Infrastructure */}
      <section className="py-36 px-6 bg-card/50">
        <div className="mx-auto max-w-[1400px]">
          <div className="text-center mb-20">
            <h2 className="font-display text-4xl md:text-6xl font-bold mb-6 tracking-tight">
              Security & <span className="gold-gradient-text">Infrastructure</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
            <div className="p-8 rounded-2xl border border-border bg-background text-center">
              <Shield className="h-14 w-14 text-primary mx-auto mb-6" />
              <h3 className="text-xl font-semibold mb-3 tracking-tight">Multi-tenant RLS Isolation</h3>
              <p className="text-muted-foreground leading-relaxed">Complete data separation between accounts</p>
            </div>
            <div className="p-8 rounded-2xl border border-border bg-background text-center">
              <Lock className="h-14 w-14 text-primary mx-auto mb-6" />
              <h3 className="text-xl font-semibold mb-3 tracking-tight">Encrypted Data</h3>
              <p className="text-muted-foreground leading-relaxed">End-to-end encryption at rest and in transit</p>
            </div>
            <div className="p-8 rounded-2xl border border-border bg-background text-center">
              <CreditCard className="h-14 w-14 text-primary mx-auto mb-6" />
              <h3 className="text-xl font-semibold mb-3 tracking-tight">PCI-Compliant Billing</h3>
              <p className="text-muted-foreground leading-relaxed">Secure payment processing via Stripe</p>
            </div>
          </div>
          <p className="text-center text-muted-foreground tracking-wide">
            Built on the UbiGrowth AI OS with secure edge functions and full audit logging.
          </p>
        </div>
      </section>

      {/* Final CTA Banner */}
      <section className="py-36 px-6">
        <div className="mx-auto max-w-5xl text-center">
          <div className="h-px gold-gradient mb-20 opacity-50" />
          <h2 className="font-display text-4xl md:text-6xl font-bold mb-8 tracking-tight">
            Marketing doesn't have to be <span className="gold-gradient-text">manual.</span>
          </h2>
          <p className="text-xl text-muted-foreground mb-14 tracking-wide">
            AI CMO orchestrates your campaigns so you can focus on growth.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-5">
            <Button onClick={() => navigate("/dashboard")} size="lg" className="gold-gradient text-primary-foreground font-semibold text-lg px-10 h-16 gold-glow tracking-wide">
              Launch AI CMO
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button variant="outline" size="lg" className="border-border hover:bg-secondary text-foreground text-lg px-10 h-16 tracking-wide">
              Book a Demo
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-16 px-6">
        <div className="mx-auto max-w-[1400px]">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <Logo className="h-8" />
            <div className="flex items-center gap-10 text-sm text-muted-foreground">
              <button onClick={() => navigate("/dashboard")} className="hover:text-foreground transition-colors tracking-wide">
                Product
              </button>
              <a href="#" className="hover:text-foreground transition-colors tracking-wide">
                Documentation
              </a>
              <button onClick={() => navigate("/privacy")} className="hover:text-foreground transition-colors tracking-wide">
                Privacy
              </button>
              <button onClick={() => navigate("/service")} className="hover:text-foreground transition-colors tracking-wide">
                Terms of Service
              </button>
              <button onClick={() => navigate("/login")} className="hover:text-foreground transition-colors tracking-wide">
                Login
              </button>
            </div>
          </div>
          <div className="mt-10 pt-10 border-t border-border text-center text-sm text-muted-foreground tracking-wide">
            © 2025 UbiGrowth AI. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
