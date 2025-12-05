import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Building2 } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/dashboard");
      }
    });
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-6 animate-fade-in">
        <div className="flex justify-center">
          <div className="h-16 w-16 bg-primary/10 rounded-xl flex items-center justify-center">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
        </div>
        <div>
          <h1 className="mb-4 text-4xl font-bold text-foreground">
            AI Marketing Platform
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            AI-powered marketing automation for your business
          </p>
        </div>
        <Button
          onClick={() => navigate("/login")}
          size="lg"
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          Sign In
        </Button>
        <div className="text-sm text-muted-foreground">
          New here?{" "}
          <button
            onClick={() => navigate("/signup")}
            className="text-primary hover:text-primary/90 font-medium transition-colors"
          >
            Get Started
          </button>
        </div>
      </div>
    </div>
  );
};

export default Index;
