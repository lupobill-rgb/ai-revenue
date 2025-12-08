import React, { useState, useEffect } from "react";
import { Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

interface WelcomeModalProps {
  onStartTour: () => void;
}

const WELCOME_SEEN_KEY = "ubigrowth_welcome_seen";

const WelcomeModal: React.FC<WelcomeModalProps> = ({ onStartTour }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const hasSeenWelcome = localStorage.getItem(WELCOME_SEEN_KEY);
    const hasSeenTour = sessionStorage.getItem("product_tour_seen");

    if (!hasSeenWelcome && !hasSeenTour) {
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [user]);

  const handleStartTour = () => {
    localStorage.setItem(WELCOME_SEEN_KEY, "true");
    setIsOpen(false);
    onStartTour();
  };

  const handleSkip = () => {
    localStorage.setItem(WELCOME_SEEN_KEY, "true");
    setIsOpen(false);
  };

  const steps = [
    {
      number: 1,
      title: "Create AI-powered campaigns in seconds",
    },
    {
      number: 2,
      title: "Review and approve generated content",
    },
    {
      number: 3,
      title: "Deploy to email, social, and voice channels",
    },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[400px] p-6">
        <DialogHeader className="flex flex-col items-center text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-primary-foreground" />
          </div>
          <DialogTitle className="text-2xl font-bold">
            Welcome to UbiGrowth AI!
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Your AI-powered marketing automation platform that creates, optimizes, and deploys campaigns across all channels.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-6 space-y-3">
          {steps.map((step) => (
            <div
              key={step.number}
              className="flex items-center gap-4 p-3 border rounded-lg bg-card"
            >
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm shrink-0">
                {step.number}
              </div>
              <p className="text-sm font-medium text-foreground">{step.title}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-2">
          <Button onClick={handleStartTour} className="w-full">
            Start Tour (2 min)
          </Button>
          <Button variant="ghost" onClick={handleSkip} className="w-full text-muted-foreground">
            Skip for now
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WelcomeModal;
