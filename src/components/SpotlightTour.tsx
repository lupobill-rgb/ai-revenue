import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { X, ChevronLeft, ChevronRight, Sparkles, Home, CheckSquare, BarChart3, PenSquare, Rocket, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface TourStep {
  title: string;
  description: string;
  icon: React.ReactNode;
  targetSelector: string;
  position: "top" | "bottom" | "left" | "right";
}

const tourSteps: TourStep[] = [
  {
    title: "Welcome to Your Dashboard",
    description: "This is your command center. View performance metrics, active campaigns, and quick actions all in one place.",
    icon: <Home className="h-6 w-6" />,
    targetSelector: '[href="/dashboard"]',
    position: "bottom",
  },
  {
    title: "Review & Approve Content",
    description: "AI-generated content lands here for your approval before going live. Review, edit, and deploy with confidence.",
    icon: <CheckSquare className="h-6 w-6" />,
    targetSelector: '[href="/approvals"]',
    position: "bottom",
  },
  {
    title: "Create New Content",
    description: "Access all creation tools here - videos, emails, social posts, landing pages, and voice agents.",
    icon: <PenSquare className="h-6 w-6" />,
    targetSelector: 'button:has(.lucide-pen-square)',
    position: "bottom",
  },
  {
    title: "Deploy Campaigns",
    description: "Launch your content across channels - outbound sequences, websites, and automated workflows.",
    icon: <Rocket className="h-6 w-6" />,
    targetSelector: 'button:has(.lucide-rocket)',
    position: "bottom",
  },
  {
    title: "Track Performance",
    description: "Monitor ROI, engagement metrics, and campaign performance with real-time analytics.",
    icon: <BarChart3 className="h-6 w-6" />,
    targetSelector: '[href="/reports"]',
    position: "bottom",
  },
  {
    title: "Manage Your CRM",
    description: "Track leads, manage deals, and let AI score and prioritize your most valuable prospects.",
    icon: <Users className="h-6 w-6" />,
    targetSelector: '[href="/crm"]',
    position: "bottom",
  },
];

interface SpotlightTourProps {
  isOpen: boolean;
  onComplete: () => void;
}

const SpotlightTour = ({ isOpen, onComplete }: SpotlightTourProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [spotlightPosition, setSpotlightPosition] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [cardPosition, setCardPosition] = useState<{ top: number; left: number }>({ top: 100, left: 100 });
  const { user } = useAuth();

  const updatePositions = useCallback(() => {
    const step = tourSteps[currentStep];
    const element = document.querySelector(step.targetSelector);
    
    if (element) {
      const rect = element.getBoundingClientRect();
      const padding = 8;
      
      setSpotlightPosition({
        top: rect.top - padding,
        left: rect.left - padding,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
      });

      // Calculate card position based on step position preference
      const cardWidth = 320;
      const cardHeight = 200;
      let cardTop = rect.bottom + 16;
      let cardLeft = rect.left;

      switch (step.position) {
        case "bottom":
          cardTop = rect.bottom + 16;
          cardLeft = Math.max(16, Math.min(rect.left, window.innerWidth - cardWidth - 16));
          break;
        case "top":
          cardTop = rect.top - cardHeight - 16;
          cardLeft = Math.max(16, Math.min(rect.left, window.innerWidth - cardWidth - 16));
          break;
        case "left":
          cardTop = rect.top;
          cardLeft = rect.left - cardWidth - 16;
          break;
        case "right":
          cardTop = rect.top;
          cardLeft = rect.right + 16;
          break;
      }

      // Ensure card stays within viewport
      if (cardTop + cardHeight > window.innerHeight - 16) {
        cardTop = window.innerHeight - cardHeight - 16;
      }
      if (cardTop < 16) cardTop = 16;

      setCardPosition({ top: cardTop, left: cardLeft });
    } else {
      // Fallback to center if element not found
      setSpotlightPosition(null);
      setCardPosition({
        top: window.innerHeight / 2 - 100,
        left: window.innerWidth / 2 - 160,
      });
    }
  }, [currentStep]);

  useEffect(() => {
    if (!isOpen) return;
    
    updatePositions();
    window.addEventListener("resize", updatePositions);
    window.addEventListener("scroll", updatePositions);
    
    return () => {
      window.removeEventListener("resize", updatePositions);
      window.removeEventListener("scroll", updatePositions);
    };
  }, [isOpen, updatePositions]);

  const handleComplete = async () => {
    // Mark onboarding as completed in database
    if (user) {
      await supabase
        .from("user_tenants")
        .update({ onboarding_completed_at: new Date().toISOString() })
        .eq("user_id", user.id);
    }
    sessionStorage.setItem("tour-shown-this-session", "true");
    localStorage.setItem("ubigrowth_welcome_seen", "true");
    onComplete();
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleNext = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  if (!isOpen) return null;

  const step = tourSteps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === tourSteps.length - 1;

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Dark overlay with spotlight cutout */}
      <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: "none" }}>
        <defs>
          <mask id="spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {spotlightPosition && (
              <rect
                x={spotlightPosition.left}
                y={spotlightPosition.top}
                width={spotlightPosition.width}
                height={spotlightPosition.height}
                rx="8"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.75)"
          mask="url(#spotlight-mask)"
          style={{ pointerEvents: "auto" }}
          onClick={handleSkip}
        />
      </svg>

      {/* Spotlight ring */}
      {spotlightPosition && (
        <div
          className="absolute border-2 border-primary rounded-lg animate-pulse pointer-events-none"
          style={{
            top: spotlightPosition.top,
            left: spotlightPosition.left,
            width: spotlightPosition.width,
            height: spotlightPosition.height,
          }}
        />
      )}

      {/* Tour card */}
      <Card
        className="absolute w-80 shadow-2xl border-primary/20 z-10 animate-in fade-in slide-in-from-bottom-4 duration-300"
        style={{ top: cardPosition.top, left: cardPosition.left }}
      >
        {/* Progress bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-muted rounded-t-lg overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${((currentStep + 1) / tourSteps.length) * 100}%` }}
          />
        </div>

        {/* Close button */}
        <button
          onClick={handleSkip}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <CardHeader className="pb-2 pt-5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              {step.icon}
            </div>
            <div>
              <CardTitle className="text-base">{step.title}</CardTitle>
              <span className="text-xs text-muted-foreground">
                Step {currentStep + 1} of {tourSteps.length}
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pb-4">
          <CardDescription className="text-sm mb-4">{step.description}</CardDescription>

          {/* Step indicators */}
          <div className="flex justify-center gap-1.5 mb-4">
            {tourSteps.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentStep(index)}
                className={`h-1.5 rounded-full transition-all duration-200 ${
                  index === currentStep
                    ? "w-4 bg-primary"
                    : index < currentStep
                    ? "w-1.5 bg-primary/50"
                    : "w-1.5 bg-muted-foreground/30"
                }`}
              />
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={handleSkip} className="text-muted-foreground">
              Skip
            </Button>
            <div className="flex gap-2">
              {!isFirstStep && (
                <Button variant="outline" size="sm" onClick={handlePrevious}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              )}
              <Button size="sm" onClick={handleNext}>
                {isLastStep ? "Done" : "Next"}
                {!isLastStep && <ChevronRight className="h-4 w-4 ml-1" />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SpotlightTour;
