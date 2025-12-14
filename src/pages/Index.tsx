import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import Logo from "@/components/Logo";
import { ArrowRight, Check } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/revenue-os/targets");
      }
    });
  }, [navigate]);

  const steps = [
    { num: "1", title: "Set your revenue goal", desc: "Tell us what you want to hit. Pipeline, bookings, meetings — your number." },
    { num: "2", title: "UbiGrowth builds the plan", desc: "AI creates campaigns, sequences, and content. You approve or adjust." },
    { num: "3", title: "Watch it execute and optimize", desc: "The system runs, learns, and improves. You focus on closing." },
  ];

  const stackItems = [
    { name: "CRM" },
    { name: "Outreach Tools" },
    { name: "Email Automation" },
    { name: "Analytics & Reporting" },
    { name: "Lead Scoring" },
    { name: "Marketing Automation" },
  ];

  const differences = [
    { label: "One system", desc: "Not 6 tools stitched together" },
    { label: "AI that executes", desc: "Not just reports and recommendations" },
    { label: "Automatic optimization", desc: "Not manual A/B tests you forget to check" },
    { label: "Revenue focus", desc: "Not activity metrics that don't matter" },
  ];

  const outcomes = [
    "Fewer tools to manage",
    "Lower software costs",
    "Less time on busywork",
    "Faster pipeline velocity",
    "More consistent execution",
    "Better conversion rates",
  ];

  return (
    <div className="min-h-screen bg-background font-sans">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto max-w-[1200px] px-6">
          <div className="flex h-16 items-center justify-between">
            <Logo className="h-7" />
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => navigate("/login")} className="text-muted-foreground hover:text-foreground">
                Login
              </Button>
              <Button onClick={() => navigate("/signup")} className="gold-gradient text-primary-foreground font-medium">
                Start Free
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section - Simple headline, subheadline, one CTA */}
      <section className="pt-32 pb-24 px-6">
        <div className="mx-auto max-w-[900px] text-center">
          <h1 className="font-display text-5xl md:text-7xl font-bold tracking-tight mb-6">
            Replace your revenue stack.
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            One AI system that plans, executes, and optimizes your growth. 
            Stop paying for tools that don't talk to each other.
          </p>
          <Button 
            onClick={() => navigate("/signup")} 
            size="lg" 
            className="gold-gradient text-primary-foreground font-semibold text-lg px-10 h-14 gold-glow"
          >
            Start with your revenue goal
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>

      {/* How It Works - Exactly 3 steps */}
      <section className="py-24 px-6 bg-card/30">
        <div className="mx-auto max-w-[1000px]">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-center mb-16 tracking-tight">
            How it works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((step, i) => (
              <div key={i} className="text-center">
                <div className="w-12 h-12 rounded-full gold-gradient flex items-center justify-center mx-auto mb-5">
                  <span className="text-xl font-bold text-primary-foreground">{step.num}</span>
                </div>
                <h3 className="text-xl font-semibold mb-3">{step.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Replace This Stack */}
      <section className="py-24 px-6">
        <div className="mx-auto max-w-[900px]">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-center mb-6 tracking-tight">
            Replace this stack
          </h2>
          <p className="text-center text-muted-foreground mb-12 text-lg">
            One system instead of many disconnected tools.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-[700px] mx-auto">
            {stackItems.map((item, i) => (
              <div 
                key={i} 
                className="p-5 rounded-xl border border-border bg-card text-center"
              >
                <div className="font-semibold text-foreground mb-1">{item.name}</div>
                <div className="text-xs text-primary">Unified inside UbiGrowth</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why UbiGrowth Is Different */}
      <section className="py-24 px-6 bg-card/30">
        <div className="mx-auto max-w-[900px]">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-center mb-16 tracking-tight">
            Why UbiGrowth is different
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {differences.map((diff, i) => (
              <div key={i} className="p-6 rounded-xl border border-border bg-background">
                <div className="font-semibold text-lg mb-1">{diff.label}</div>
                <p className="text-muted-foreground">{diff.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Outcomes */}
      <section className="py-24 px-6">
        <div className="mx-auto max-w-[800px]">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-center mb-12 tracking-tight">
            What you get
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {outcomes.map((outcome, i) => (
              <div key={i} className="flex items-center gap-3 p-4">
                <Check className="w-5 h-5 text-primary flex-shrink-0" />
                <span className="text-lg">{outcome}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 px-6 bg-card/30">
        <div className="mx-auto max-w-[700px] text-center">
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-6 tracking-tight">
            Ready to simplify your revenue stack?
          </h2>
          <p className="text-muted-foreground text-lg mb-10">
            Start with your goal. UbiGrowth handles the rest.
          </p>
          <Button 
            onClick={() => navigate("/signup")} 
            size="lg" 
            className="gold-gradient text-primary-foreground font-semibold text-lg px-10 h-14 gold-glow"
          >
            Start with your revenue goal
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-border">
        <div className="mx-auto max-w-[1200px] flex flex-col md:flex-row items-center justify-between gap-4">
          <Logo className="h-6" />
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} UbiGrowth. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
