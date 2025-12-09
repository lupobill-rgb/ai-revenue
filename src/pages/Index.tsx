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
    { icon: Target, title: "Campaign Strategy", desc: "AI-generated targeting and messaging" },
    { icon: Mail, title: "Email + SMS Sequences", desc: "Multi-step automated outreach" },
    { icon: Globe, title: "Funnel + Landing Copy", desc: "Conversion-optimized content" },
    { icon: Phone, title: "Voice Agent Triggers", desc: "Automated call campaigns" },
    { icon: Workflow, title: "CRM Automation", desc: "Seamless pipeline integration" },
    { icon: BarChart3, title: "Attribution + Reporting", desc: "Full-funnel analytics" },
  ];

  const steps = [
    { num: "01", title: "Choose Your Goal", desc: "Lead gen, nurture, reactivation, upsell, retention." },
    { num: "02", title: "AI Builds the Campaign", desc: "Targeting, sequences, automation, scheduling." },
    { num: "03", title: "Deploy with One Click", desc: "Push into CRM, SMS, email, and voice agents." },
    { num: "04", title: "Unified Reporting", desc: "Track opens, replies, calls, and pipeline created." },
  ];

  const keyFeatures = [
    { icon: Sparkles, title: "Autonomous Campaign Builder", desc: "AI creates complete campaigns from a single goal" },
    { icon: Send, title: "Email + SMS Engine", desc: "Multi-channel messaging at scale" },
    { icon: Phone, title: "Voice Agent Integration", desc: "AI-powered calling campaigns" },
    { icon: Workflow, title: "CRM-Connected Orchestration", desc: "Direct pipeline integration" },
    { icon: Layers, title: "Funnel + Landing Copy", desc: "Conversion-optimized content generation" },
    { icon: LineChart, title: "Performance Dashboards", desc: "Real-time campaign analytics" },
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
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Logo className="h-8" />
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => navigate("/login")} className="text-muted-foreground hover:text-foreground">
                Login
              </Button>
              <Button onClick={() => navigate("/dashboard")} className="gold-gradient text-primary-foreground font-semibold">
                Launch AI CMO
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-24 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(45_100%_51%/0.08),transparent_50%)]" />
        <div className="mx-auto max-w-5xl text-center relative">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6">
            Your Marketing,{" "}
            <span className="gold-gradient-text">Automated by AI.</span>
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto mb-10">
            AI CMO is an orchestration layer that builds and deploys full campaigns — email, SMS, funnels, and voice — directly into your CRM.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Button onClick={() => navigate("/dashboard")} size="lg" className="gold-gradient text-primary-foreground font-semibold text-lg px-8 h-14 gold-glow">
              Launch AI CMO
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button variant="outline" size="lg" className="border-border hover:bg-secondary text-foreground text-lg px-8 h-14">
              Book a Demo
            </Button>
          </div>
          
          {/* Proof Points */}
          <div className="flex flex-wrap justify-center gap-8 md:gap-16">
            <div className="flex items-center gap-2 text-muted-foreground">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              <span>Full-funnel orchestration</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              <span>Instant campaigns</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              <span>CRM + voice + SMS integrated</span>
            </div>
          </div>
        </div>
      </section>

      {/* Gold accent line */}
      <div className="h-px gold-gradient mx-auto max-w-4xl opacity-50" />

      {/* What AI CMO Does */}
      <section className="py-24 px-4">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              The AI Marketing <span className="gold-gradient-text">Orchestration Layer</span>
            </h2>
            <p className="text-xl text-muted-foreground">
              Generate and deploy complete marketing campaigns from a single command.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <div key={i} className="group p-6 rounded-xl border border-border bg-card hover:border-primary/50 transition-all duration-300">
                <div className="h-12 w-12 rounded-lg gold-gradient flex items-center justify-center mb-4">
                  <feature.icon className="h-6 w-6 text-primary-foreground" />
                </div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 px-4 bg-card/50">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              How It <span className="gold-gradient-text">Works</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((step, i) => (
              <div key={i} className="relative p-6 rounded-xl border border-border bg-background">
                <span className="text-5xl font-bold gold-gradient-text opacity-50">{step.num}</span>
                <h3 className="text-xl font-semibold mt-4 mb-2">{step.title}</h3>
                <p className="text-muted-foreground text-sm">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Key Features Grid */}
      <section className="py-24 px-4">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              Key <span className="gold-gradient-text">Features</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {keyFeatures.map((feature, i) => (
              <div key={i} className="p-6 rounded-xl border border-border bg-card hover:gold-glow transition-all duration-300">
                <feature.icon className="h-10 w-10 text-primary mb-4" />
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Gold accent line */}
      <div className="h-px gold-gradient mx-auto max-w-4xl opacity-50" />

      {/* Industry Templates */}
      <section className="py-24 px-4 bg-card/50">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              Industry-Specific <span className="gold-gradient-text">Playbooks</span>
            </h2>
          </div>
          <div className="flex flex-wrap justify-center gap-4">
            {industries.map((industry, i) => (
              <div key={i} className="flex items-center gap-2 px-5 py-3 rounded-full border border-border bg-background hover:border-primary/50 transition-colors">
                <industry.icon className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium">{industry.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Teams Use AI CMO */}
      <section className="py-24 px-4">
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl md:text-5xl font-bold mb-8">
                Why Teams Use <span className="gold-gradient-text">AI CMO</span>
              </h2>
              <ul className="space-y-4">
                {benefits.map((benefit, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <CheckCircle2 className="h-6 w-6 text-primary flex-shrink-0" />
                    <span className="text-lg">{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative">
              <div className="rounded-xl border border-border bg-card p-8 gold-glow">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-background border border-border">
                    <div className="text-3xl font-bold gold-gradient-text">10x</div>
                    <div className="text-sm text-muted-foreground">Faster Campaigns</div>
                  </div>
                  <div className="p-4 rounded-lg bg-background border border-border">
                    <div className="text-3xl font-bold gold-gradient-text">4+</div>
                    <div className="text-sm text-muted-foreground">Channels</div>
                  </div>
                  <div className="p-4 rounded-lg bg-background border border-border">
                    <div className="text-3xl font-bold gold-gradient-text">100%</div>
                    <div className="text-sm text-muted-foreground">Automated</div>
                  </div>
                  <div className="p-4 rounded-lg bg-background border border-border">
                    <div className="text-3xl font-bold gold-gradient-text">$0</div>
                    <div className="text-sm text-muted-foreground">Agency Fees</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Security & Infrastructure */}
      <section className="py-24 px-4 bg-card/50">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              Security & <span className="gold-gradient-text">Infrastructure</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="p-6 rounded-xl border border-border bg-background text-center">
              <Shield className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Multi-tenant RLS Isolation</h3>
              <p className="text-muted-foreground text-sm">Complete data separation between accounts</p>
            </div>
            <div className="p-6 rounded-xl border border-border bg-background text-center">
              <Lock className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Encrypted Data</h3>
              <p className="text-muted-foreground text-sm">End-to-end encryption at rest and in transit</p>
            </div>
            <div className="p-6 rounded-xl border border-border bg-background text-center">
              <CreditCard className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">PCI-Compliant Billing</h3>
              <p className="text-muted-foreground text-sm">Secure payment processing via Stripe</p>
            </div>
          </div>
          <p className="text-center text-muted-foreground">
            Built on the UbiGrowth AI OS with secure edge functions and full audit logging.
          </p>
        </div>
      </section>

      {/* Final CTA Banner */}
      <section className="py-24 px-4">
        <div className="mx-auto max-w-4xl text-center">
          <div className="h-px gold-gradient mb-16 opacity-50" />
          <h2 className="text-3xl md:text-5xl font-bold mb-6">
            Marketing doesn't have to be <span className="gold-gradient-text">manual.</span>
          </h2>
          <p className="text-xl text-muted-foreground mb-10">
            AI CMO orchestrates your campaigns so you can focus on growth.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button onClick={() => navigate("/dashboard")} size="lg" className="gold-gradient text-primary-foreground font-semibold text-lg px-8 h-14 gold-glow">
              Launch AI CMO
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button variant="outline" size="lg" className="border-border hover:bg-secondary text-foreground text-lg px-8 h-14">
              Book a Demo
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12 px-4">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <Logo className="h-8" />
            <div className="flex items-center gap-8 text-sm text-muted-foreground">
              <button onClick={() => navigate("/dashboard")} className="hover:text-foreground transition-colors">
                Product
              </button>
              <a href="#" className="hover:text-foreground transition-colors">
                Documentation
              </a>
              <button onClick={() => navigate("/login")} className="hover:text-foreground transition-colors">
                Login
              </button>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-border text-center text-sm text-muted-foreground">
            © 2025 UbiGrowth AI. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
