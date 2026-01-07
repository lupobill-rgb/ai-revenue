import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const AuthCallback = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState("Completing sign in...");
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let mounted = true;

    const handleAuthCallback = async (session: any) => {
      if (!session || !mounted) return;

      console.log("[AuthCallback] Handling sign-in for user:", session.user.id);
      setStatus("Setting up your account...");

      try {
        // Wait a moment for the trigger to complete
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Try to get business profile with retries
        let profile = null;
        let attempts = 0;
        const maxAttempts = 5;

        while (attempts < maxAttempts && !profile && mounted) {
          attempts++;
          console.log(`[AuthCallback] Checking for profile (attempt ${attempts}/${maxAttempts})...`);
          
          const { data: profileArr, error } = await supabase
            .from("business_profiles")
            .select("id, workspace_id")
            .eq("user_id", session.user.id)
            .limit(1);

          if (error) {
            console.error("[AuthCallback] Error querying business_profiles:", error);
            
            // If RLS is blocking, try checking workspaces instead
            console.log("[AuthCallback] Trying to check workspaces table...");
            const { data: workspaces } = await supabase
              .from("workspaces")
              .select("id")
              .eq("owner_id", session.user.id)
              .limit(1);

            if (workspaces && workspaces.length > 0) {
              console.log("[AuthCallback] Found workspace, redirecting to dashboard");
              if (mounted) navigate("/dashboard", { replace: true });
              return;
            }
          }

          profile = profileArr?.[0] ?? null;

          if (!profile && attempts < maxAttempts) {
            console.log(`[AuthCallback] Profile not found, waiting 1s before retry...`);
            setStatus(`Setting up your account (${attempts}/${maxAttempts})...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }

        if (!mounted) return;

        if (profile) {
          console.log("[AuthCallback] Profile found, redirecting to dashboard");
          setStatus("Redirecting to dashboard...");
          navigate("/dashboard", { replace: true });
        } else {
          console.log("[AuthCallback] No profile found after retries, redirecting to onboarding");
          setStatus("Redirecting to onboarding...");
          navigate("/onboarding", { replace: true });
        }
      } catch (error) {
        console.error("[AuthCallback] Error during auth callback:", error);
        if (mounted) {
          setStatus("Error completing sign in, retrying...");
          
          // Retry once more after error
          if (retryCount < 2) {
            setTimeout(() => {
              setRetryCount(prev => prev + 1);
              handleAuthCallback(session);
            }, 2000);
          } else {
            // Give up and go to onboarding
            console.error("[AuthCallback] Max retries reached, redirecting to onboarding");
            navigate("/onboarding", { replace: true });
          }
        }
      }
    };

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("[AuthCallback] Auth state changed:", event, session ? "Session exists" : "No session");
      
      if (event === "SIGNED_IN" && session) {
        await handleAuthCallback(session);
      } else if (event === "SIGNED_OUT") {
        console.log("[AuthCallback] User signed out, redirecting to login");
        navigate("/login", { replace: true });
      }
    });

    // Wait for auth state to settle before checking session
    const timeoutId = setTimeout(async () => {
      if (!mounted) return;
      
      const { data: { session } } = await supabase.auth.getSession();
      console.log("[AuthCallback] Timeout check - session exists:", !!session);
      
      if (session && mounted) {
        // Session exists but event didn't fire - handle it manually
        console.log("[AuthCallback] Session found on timeout, handling manually");
        await handleAuthCallback(session);
      } else if (!session && mounted) {
        // No session after timeout - something went wrong
        console.error("[AuthCallback] No session found after timeout, redirecting to login");
        navigate("/login", { replace: true });
      }
    }, 3000); // Wait 3 seconds for auth state to settle

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      sub.subscription.unsubscribe();
    };
  }, [navigate, retryCount]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4"></div>
        <p className="text-muted-foreground">{status}</p>
        <p className="text-xs text-muted-foreground/60 mt-2">
          This may take a few seconds...
        </p>
      </div>
    </div>
  );
};

export default AuthCallback;
