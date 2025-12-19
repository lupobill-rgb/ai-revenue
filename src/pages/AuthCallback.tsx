import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const AuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session) {
        const { data: profile } = await supabase
          .from("business_profiles")
          .select("id")
          .eq("user_id", session.user.id)
          .maybeSingle();

        navigate(profile ? "/dashboard" : "/onboarding", { replace: true });
      }
    });

    // Fallback: if session already exists
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) navigate("/login", { replace: true });
    });

    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4"></div>
        <p className="text-muted-foreground">Completing sign in...</p>
      </div>
    </div>
  );
};

export default AuthCallback;
