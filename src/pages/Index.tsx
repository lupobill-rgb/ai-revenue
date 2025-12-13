import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import Logo from "@/components/Logo";
import {
  Zap,
  BarChart3,
  Target,
  Workflow,
  Shield,
  Lock,
  CreditCard,
  ArrowRight,
  CheckCircle2,
  LineChart,
  TrendingUp,
  DollarSign,
  Users,
  Brain,
  Gauge,
  Activity,
  PieChart,
  Calculator,
} from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/revenue-os/targets");
      }
    });
  }, [navigate]);

  const pillars = [
    { 
      icon: Target, 
      title: "CMO", 
      subtitle: "Demand & Pipeline",
      desc: "Autonomous campaigns, multi-channel orchestration, funnel optimization" 
    },
    { 
      icon: TrendingUp, 
      title: "CRO", 
      subtitle: "Sales & Conversion",
      desc: "Deal velocity, win rate optimization, forecast accuracy" 
    },
    { 
      icon: DollarSign, 
      title: "CFO", 
      subtitle: "Economics & Efficiency",
      desc: "CAC payback, margin protection, spend governance" 
    },
  ];

  const steps = [
    { num: "01", title: "Set Targets & Guardrails", desc: "Define pipeline goals, payback limits, and margin floors." },
    { num: "02", title: "OS Analyzes Your Data", desc: "Revenue spine ingests metrics across marketing, sales, and finance." },
    { num: "03", title: "Kernel Generates Actions", desc: "AI produces prioritized, economics-aware optimization moves." },
    { num: "04", title: "Autonomous Execution", desc: "Actions execute automatically with full observability and rollback." },
  ];

  const keyFeatures = [
    { icon: Brain, title: "Unified Kernel", desc: "One AI brain optimizing across CMO, CRO, and CFO lenses" },
    { icon: Activity, title: "Revenue Spine", desc: "Single source of truth for all revenue metrics" },
    { icon: Gauge, title: "Targets & Guardrails", desc: "Define what 'good' looks like—once—and the OS respects it" },
    { icon: Zap, title: "Autonomous Actions", desc: "AI-generated experiments that execute and learn" },
    { icon: LineChart, title: "Economics-First", desc: "Every action checked against payback and margin constraints" },
    { icon: PieChart, title: "Closed-Loop Learning", desc: "Results feed back into the kernel for continuous improvement" },
  ];

  const metrics = [
    { label: "Pipeline", metric: "pipeline_total", desc: "Total qualified pipeline value" },
    { label: "Bookings", metric: "bookings_total", desc: "New business closed" },
    { label: "Payback", metric: "payback_months", desc: "CAC recovery time" },
    { label: "CAC", metric: "cac_blended", desc: "Customer acquisition cost" },
    { label: "Margin", metric: "gross_margin_pct", desc: "Gross margin percentage" },
  ];

  const benefits = [
    "No more role silos — one unified revenue view",
    "Economics constraints baked into every decision",
    "Autonomous optimization without constant oversight",
    "Full audit trail of every AI decision",
    "Multi-tenant architecture with strict isolation",
    "CFO-gated spend controls and margin protection",
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
              <Button onClick={() => navigate("/revenue-os/targets")} className="gold-gradient text-primary-foreground font-semibold tracking-wide">
                Launch Revenue OS
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-40 pb-32 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(190_100%_50%/0.08),transparent_50%)]" />
        <div className="mx-auto max-w-[1200px] text-center relative">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-primary/5 text-primary text-sm mb-8">
            <Zap className="h-4 w-4" />
            <span className="tracking-wide">CMO + CRO + CFO in One Autonomous Kernel</span>
          </div>
          <h1 className="font-display text-6xl md:text-8xl font-bold tracking-tight mb-8">
            Revenue OS.{" "}
            <span className="gold-gradient-text">One Brain.</span>
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-4xl mx-auto mb-14 leading-relaxed tracking-wide">
            A unified AI kernel that optimizes pipeline, conversions, and economics together — 
            not as separate dashboards, but as one autonomous revenue system.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-5 mb-20">
            <Button onClick={() => navigate("/revenue-os/targets")} size="lg" className="gold-gradient text-primary-foreground font-semibold text-lg px-10 h-16 gold-glow tracking-wide">
              Launch Revenue OS
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
              <span className="tracking-wide">Unified revenue metrics</span>
            </div>
            <div className="flex items-center gap-3 text-muted-foreground">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              <span className="tracking-wide">Economics-first decisions</span>
            </div>
            <div className="flex items-center gap-3 text-muted-foreground">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              <span className="tracking-wide">Autonomous optimization</span>
            </div>
          </div>
        </div>
      </section>

      {/* Accent line */}
      <div className="h-px gold-gradient mx-auto max-w-5xl opacity-50" />

      {/* Three Pillars */}
      <section className="py-36 px-6">
        <div className="mx-auto max-w-[1400px]">
          <div className="text-center mb-20">
            <h2 className="font-display text-4xl md:text-6xl font-bold mb-6 tracking-tight">
              Three Lenses. <span className="gold-gradient-text">One Kernel.</span>
            </h2>
            <p className="text-xl text-muted-foreground tracking-wide max-w-3xl mx-auto">
              The kernel reasons through CMO, CRO, and CFO perspectives internally, 
              then outputs unified, economics-aware actions.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {pillars.map((pillar, i) => (
              <div key={i} className="group p-8 rounded-2xl border border-border bg-card hover:border-primary/50 transition-all duration-300">
                <div className="h-14 w-14 rounded-xl gold-gradient flex items-center justify-center mb-6">
                  <pillar.icon className="h-7 w-7 text-primary-foreground" />
                </div>
                <div className="text-sm text-primary font-semibold tracking-widest uppercase mb-2">{pillar.title}</div>
                <h3 className="text-2xl font-semibold mb-3 tracking-tight">{pillar.subtitle}</h3>
                <p className="text-muted-foreground leading-relaxed">{pillar.desc}</p>
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

      {/* The Revenue Spine */}
      <section className="py-36 px-6">
        <div className="mx-auto max-w-[1400px]">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
            <div>
              <h2 className="font-display text-4xl md:text-5xl font-bold mb-8 tracking-tight">
                The <span className="gold-gradient-text">Revenue Spine</span>
              </h2>
              <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
                One canonical data layer for all your revenue metrics. No more reconciling 
                marketing dashboards with sales reports with finance spreadsheets.
              </p>
              <div className="space-y-4">
                {metrics.map((m, i) => (
                  <div key={i} className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <BarChart3 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-semibold">{m.label}</div>
                      <div className="text-sm text-muted-foreground">{m.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <div className="rounded-2xl border border-border bg-card p-10 gold-glow">
                <div className="text-center mb-8">
                  <Calculator className="h-12 w-12 text-primary mx-auto mb-4" />
                  <h3 className="text-2xl font-semibold">One Source of Truth</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-background border border-border text-center">
                    <div className="text-2xl font-bold gold-gradient-text font-display">$1.2M</div>
                    <div className="text-xs text-muted-foreground mt-1">Pipeline</div>
                  </div>
                  <div className="p-4 rounded-xl bg-background border border-border text-center">
                    <div className="text-2xl font-bold gold-gradient-text font-display">4.2mo</div>
                    <div className="text-xs text-muted-foreground mt-1">Payback</div>
                  </div>
                  <div className="p-4 rounded-xl bg-background border border-border text-center">
                    <div className="text-2xl font-bold gold-gradient-text font-display">$842</div>
                    <div className="text-xs text-muted-foreground mt-1">CAC</div>
                  </div>
                  <div className="p-4 rounded-xl bg-background border border-border text-center">
                    <div className="text-2xl font-bold gold-gradient-text font-display">72%</div>
                    <div className="text-xs text-muted-foreground mt-1">Margin</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Key Features Grid */}
      <section className="py-36 px-6 bg-card/50">
        <div className="mx-auto max-w-[1400px]">
          <div className="text-center mb-20">
            <h2 className="font-display text-4xl md:text-6xl font-bold mb-6 tracking-tight">
              Key <span className="gold-gradient-text">Capabilities</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {keyFeatures.map((feature, i) => (
              <div key={i} className="p-8 rounded-2xl border border-border bg-background hover:gold-glow transition-all duration-300">
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

      {/* Why Revenue OS */}
      <section className="py-36 px-6">
        <div className="mx-auto max-w-[1400px]">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
            <div>
              <h2 className="font-display text-4xl md:text-5xl font-bold mb-10 tracking-tight">
                Why <span className="gold-gradient-text">Revenue OS</span>
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
                    <div className="text-4xl font-bold gold-gradient-text font-display">3</div>
                    <div className="text-sm text-muted-foreground mt-1 tracking-wide">Lenses Unified</div>
                  </div>
                  <div className="p-6 rounded-xl bg-background border border-border">
                    <div className="text-4xl font-bold gold-gradient-text font-display">1</div>
                    <div className="text-sm text-muted-foreground mt-1 tracking-wide">Kernel</div>
                  </div>
                  <div className="p-6 rounded-xl bg-background border border-border">
                    <div className="text-4xl font-bold gold-gradient-text font-display">0</div>
                    <div className="text-sm text-muted-foreground mt-1 tracking-wide">Manual Dashboards</div>
                  </div>
                  <div className="p-6 rounded-xl bg-background border border-border">
                    <div className="text-4xl font-bold gold-gradient-text font-display">∞</div>
                    <div className="text-sm text-muted-foreground mt-1 tracking-wide">Learning Loops</div>
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
              <p className="text-muted-foreground leading-relaxed">Complete data separation between tenants</p>
            </div>
            <div className="p-8 rounded-2xl border border-border bg-background text-center">
              <Lock className="h-14 w-14 text-primary mx-auto mb-6" />
              <h3 className="text-xl font-semibold mb-3 tracking-tight">Full Audit Logging</h3>
              <p className="text-muted-foreground leading-relaxed">Every kernel decision tracked and traceable</p>
            </div>
            <div className="p-8 rounded-2xl border border-border bg-background text-center">
              <CreditCard className="h-14 w-14 text-primary mx-auto mb-6" />
              <h3 className="text-xl font-semibold mb-3 tracking-tight">CFO Spend Gates</h3>
              <p className="text-muted-foreground leading-relaxed">Economics constraints enforced at kernel level</p>
            </div>
          </div>
          <p className="text-center text-muted-foreground tracking-wide">
            Built on UbiGrowth AI with secure edge functions, SLO monitoring, and weekly CFO digests.
          </p>
        </div>
      </section>

      {/* Final CTA Banner */}
      <section className="py-36 px-6">
        <div className="mx-auto max-w-5xl text-center">
          <div className="h-px gold-gradient mb-20 opacity-50" />
          <h2 className="font-display text-4xl md:text-6xl font-bold mb-8 tracking-tight">
            Revenue doesn't need <span className="gold-gradient-text">three dashboards.</span>
          </h2>
          <p className="text-xl text-muted-foreground mb-14 tracking-wide">
            Revenue OS unifies CMO, CRO, and CFO into one autonomous kernel.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-5">
            <Button onClick={() => navigate("/revenue-os/targets")} size="lg" className="gold-gradient text-primary-foreground font-semibold text-lg px-10 h-16 gold-glow tracking-wide">
              Launch Revenue OS
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
              <button onClick={() => navigate("/revenue-os/targets")} className="hover:text-foreground transition-colors tracking-wide">
                Product
              </button>
              <a href="#" className="hover:text-foreground transition-colors tracking-wide">
                Documentation
              </a>
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
