import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { X, ChevronLeft, ChevronRight, PlayCircle, Mail, Share2, Phone, BarChart3, Users, Calendar, Sparkles } from "lucide-react";

interface TourStep {
  title: string;
  description: string;
  icon: React.ReactNode;
  highlight?: string;
  action?: string;
}

const tourSteps: TourStep[] = [
  {
    title: "Welcome to Your Marketing Platform",
    description: "Your AI-powered marketing automation platform. Let's take a quick tour to help you get started and create your first campaign.",
    icon: <Sparkles className="h-8 w-8 text-primary" />,
    action: "Let's go!"
  },
  {
    title: "Create AI-Powered Videos",
    description: "Generate professional marketing videos in seconds. Just describe what you want, and our AI creates stunning video content for your campaigns.",
    icon: <PlayCircle className="h-8 w-8 text-red-500" />,
    highlight: "Video Studio",
    action: "Next"
  },
  {
    title: "Design Email Campaigns",
    description: "Create personalized email campaigns with AI-generated content. Target specific segments and track engagement in real-time.",
    icon: <Mail className="h-8 w-8 text-blue-500" />,
    highlight: "Email Studio",
    action: "Next"
  },
  {
    title: "Social Media Publishing",
    description: "Schedule and publish content across multiple social platforms. Let AI optimize your posting times for maximum engagement.",
    icon: <Share2 className="h-8 w-8 text-green-500" />,
    highlight: "Social Studio",
    action: "Next"
  },
  {
    title: "AI Voice Agents",
    description: "Deploy intelligent voice agents for outbound calls. Automate lead qualification and follow-ups with natural conversations.",
    icon: <Phone className="h-8 w-8 text-purple-500" />,
    highlight: "Voice Agents",
    action: "Next"
  },
  {
    title: "CRM & Lead Management",
    description: "Track leads through your pipeline, manage deals, and let AI score and prioritize your most valuable prospects.",
    icon: <Users className="h-8 w-8 text-orange-500" />,
    highlight: "CRM",
    action: "Next"
  },
  {
    title: "Content Calendar",
    description: "Plan and schedule all your marketing content in one place. Visualize your campaigns and maintain a consistent publishing schedule.",
    icon: <Calendar className="h-8 w-8 text-cyan-500" />,
    highlight: "Content Calendar",
    action: "Next"
  },
  {
    title: "Track Performance",
    description: "Monitor ROI, engagement metrics, and campaign performance in real-time. Make data-driven decisions with comprehensive analytics.",
    icon: <BarChart3 className="h-8 w-8 text-emerald-500" />,
    highlight: "Dashboard",
    action: "Finish Tour"
  }
];

interface ProductTourProps {
  onComplete?: () => void;
  forceShow?: boolean;
}

const ProductTour = ({ onComplete, forceShow = false }: ProductTourProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (forceShow) {
      setIsVisible(true);
      return;
    }

    // Check if user has seen the tour
    const hasSeenTour = localStorage.getItem("marketing-platform-tour-completed");
    if (!hasSeenTour) {
      // Small delay to let the page load first
      const timer = setTimeout(() => setIsVisible(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [forceShow]);

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

  const handleSkip = () => {
    localStorage.setItem("marketing-platform-tour-completed", "true");
    setIsVisible(false);
    onComplete?.();
  };

  const handleComplete = () => {
    localStorage.setItem("marketing-platform-tour-completed", "true");
    setIsVisible(false);
    onComplete?.();
  };

  if (!isVisible) return null;

  const step = tourSteps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === tourSteps.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={handleSkip} />
      
      {/* Tour Card */}
      <Card className="relative z-10 w-full max-w-lg mx-4 border-primary/20 shadow-2xl animate-in fade-in zoom-in duration-300">
        {/* Progress Bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-muted rounded-t-lg overflow-hidden">
          <div 
            className="h-full bg-primary transition-all duration-300 ease-out"
            style={{ width: `${((currentStep + 1) / tourSteps.length) * 100}%` }}
          />
        </div>

        {/* Close Button */}
        <button
          onClick={handleSkip}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <CardHeader className="text-center pt-8 pb-4">
          <div className="mx-auto mb-4 p-4 rounded-full bg-muted/50">
            {step.icon}
          </div>
          <div className="flex items-center justify-center gap-2 mb-2">
            <CardTitle className="text-2xl">{step.title}</CardTitle>
          </div>
          {step.highlight && (
            <Badge variant="secondary" className="mx-auto">
              {step.highlight}
            </Badge>
          )}
        </CardHeader>

        <CardContent className="text-center pb-8">
          <CardDescription className="text-base mb-8 px-4">
            {step.description}
          </CardDescription>

          {/* Step Indicators */}
          <div className="flex justify-center gap-2 mb-6">
            {tourSteps.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentStep(index)}
                className={`w-2 h-2 rounded-full transition-all duration-200 ${
                  index === currentStep 
                    ? "w-6 bg-primary" 
                    : index < currentStep 
                      ? "bg-primary/50" 
                      : "bg-muted-foreground/30"
                }`}
              />
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between px-4">
            <Button
              variant="ghost"
              onClick={handleSkip}
              className="text-muted-foreground"
            >
              Skip Tour
            </Button>

            <div className="flex gap-2">
              {!isFirstStep && (
                <Button variant="outline" onClick={handlePrevious}>
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
              )}
              <Button onClick={handleNext} className="min-w-[120px]">
                {step.action || "Next"}
                {!isLastStep && <ChevronRight className="h-4 w-4 ml-1" />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProductTour;
