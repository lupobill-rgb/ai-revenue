import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Shield, Eye, EyeOff } from "lucide-react";
import { z } from "zod";

const passwordSchema = z
  .object({
    newPassword: z
      .string()
      .min(8, { message: "Password must be at least 8 characters" })
      .max(100, { message: "Password must be less than 100 characters" })
      .regex(/[A-Z]/, { message: "Password must contain at least one uppercase letter" })
      .regex(/[a-z]/, { message: "Password must contain at least one lowercase letter" })
      .regex(/[0-9]/, { message: "Password must contain at least one number" }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

const ForcePasswordChange = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ newPassword?: string; confirmPassword?: string }>({});
  const [authReady, setAuthReady] = useState(false);
  const [hasAuthSession, setHasAuthSession] = useState(false);

  const recoveryTokens = useMemo(() => {
    // Supabase recovery redirects typically put tokens in the URL hash
    // Example: /change-password#access_token=...&refresh_token=...&type=recovery
    const hash = (location.hash || "").replace(/^#/, "");
    const params = new URLSearchParams(hash);
    const access_token = params.get("access_token") || "";
    const refresh_token = params.get("refresh_token") || "";
    const type = params.get("type") || "";

    return {
      access_token,
      refresh_token,
      type,
      hasTokens: Boolean(access_token && refresh_token),
    };
  }, [location.hash]);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      // 1) Check if we already have a session
      const { data: sessionData } = await supabase.auth.getSession();
      const existingSession = sessionData.session;

      // 2) If no session but we have recovery tokens in the URL hash, set the session
      if (!existingSession && recoveryTokens.hasTokens && recoveryTokens.type === "recovery") {
        const { data, error } = await supabase.auth.setSession({
          access_token: recoveryTokens.access_token,
          refresh_token: recoveryTokens.refresh_token,
        });

        if (!error && data.session) {
          if (mounted) setHasAuthSession(true);
        } else {
          if (mounted) setHasAuthSession(false);
        }
      } else {
        if (mounted) setHasAuthSession(Boolean(existingSession));
      }

      if (mounted) setAuthReady(true);
    };

    init();

    return () => {
      mounted = false;
    };
  }, [recoveryTokens.access_token, recoveryTokens.refresh_token, recoveryTokens.hasTokens, recoveryTokens.type]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = passwordSchema.safeParse({ newPassword, confirmPassword });
    if (!result.success) {
      const fieldErrors: { newPassword?: string; confirmPassword?: string } = {};
      result.error.errors.forEach((err) => {
        if (err.path[0] === "newPassword") fieldErrors.newPassword = err.message;
        if (err.path[0] === "confirmPassword") fieldErrors.confirmPassword = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);

    try {
      // Update the password
      const { error: updateError } = await supabase.auth.updateUser({
        password: result.data.newPassword,
      });

      if (updateError) {
        toast({
          variant: "destructive",
          title: "Password update failed",
          description: updateError.message,
        });
        setIsLoading(false);
        return;
      }

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // Clear the force_change flag
        const { error: clearError } = await supabase
          .from("user_password_resets")
          .update({ force_change: false })
          .eq("user_id", user.id);

        if (clearError) {
          console.error("Error clearing force_change flag:", clearError);
        }
      }

      toast({
        title: "Password updated",
        description: "Your password has been changed successfully.",
      });

      navigate("/dashboard");
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md animate-fade-in border-border bg-card">
          <CardHeader className="space-y-4 text-center">
            <div className="flex justify-center">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Shield className="h-6 w-6 text-primary" />
              </div>
            </div>
            <div>
              <CardTitle className="text-3xl font-bold tracking-tight text-foreground">Loading…</CardTitle>
              <CardDescription className="text-base text-muted-foreground">
                Preparing your password reset session.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-2 w-full rounded bg-muted" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!hasAuthSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md animate-fade-in border-border bg-card">
          <CardHeader className="space-y-4 text-center">
            <div className="flex justify-center">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Shield className="h-6 w-6 text-primary" />
              </div>
            </div>
            <div>
              <CardTitle className="text-3xl font-bold tracking-tight text-foreground">
                Open the reset link
              </CardTitle>
              <CardDescription className="text-base text-muted-foreground">
                This page needs an active password-reset session. Please open the latest reset link from your email.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              If you got here by typing the URL, go back and request a new reset link.
            </p>
          </CardContent>
          <CardFooter className="flex flex-col gap-2">
            <Button className="w-full" onClick={() => navigate("/login")}>Back to login</Button>
            <Button
              variant="secondary"
              className="w-full"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate("/login");
              }}
            >
              Clear session & retry
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md animate-fade-in border-border bg-card">
        <CardHeader className="space-y-4 text-center">
          <div className="flex justify-center">
            <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center">
              <Shield className="h-6 w-6 text-primary" />
            </div>
          </div>
          <div>
            <CardTitle className="text-3xl font-bold tracking-tight text-foreground">
              Change Password
            </CardTitle>
            <CardDescription className="text-base text-muted-foreground">
              For security, you must set a new password before continuing
            </CardDescription>
          </div>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword" className="text-foreground">
                New Password
              </Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={isLoading}
                  className="bg-background border-input text-foreground pr-10"
                  aria-invalid={!!errors.newPassword}
                  aria-describedby={errors.newPassword ? "newPassword-error" : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.newPassword && (
                <p id="newPassword-error" className="text-sm text-destructive">
                  {errors.newPassword}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Must be 8+ characters with uppercase, lowercase, and number
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-foreground">
                Confirm Password
              </Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isLoading}
                  className="bg-background border-input text-foreground pr-10"
                  aria-invalid={!!errors.confirmPassword}
                  aria-describedby={errors.confirmPassword ? "confirmPassword-error" : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p id="confirmPassword-error" className="text-sm text-destructive">
                  {errors.confirmPassword}
                </p>
              )}
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Updating..." : "Set New Password"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default ForcePasswordChange;