import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Shield, Eye, EyeOff, Loader2 } from "lucide-react";
import { z } from "zod";

const passwordSchema = z.object({
  newPassword: z.string()
    .min(8, { message: "Password must be at least 8 characters" })
    .max(100, { message: "Password must be less than 100 characters" })
    .regex(/[A-Z]/, { message: "Password must contain at least one uppercase letter" })
    .regex(/[a-z]/, { message: "Password must contain at least one lowercase letter" })
    .regex(/[0-9]/, { message: "Password must contain at least one number" }),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

const ForcePasswordChange = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isRecoveryFlow, setIsRecoveryFlow] = useState(false);
  const [errors, setErrors] = useState<{ newPassword?: string; confirmPassword?: string }>({});

  // Handle password recovery from email link
  useEffect(() => {
    const handleRecoverySession = async () => {
      try {
        // Check for token in query params (from our custom reset link)
        const tokenHash = searchParams.get('token_hash');
        const token = searchParams.get('token');
        const type = searchParams.get('type');
        
        // Also check hash params (legacy Supabase format)
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const hashType = hashParams.get('type');
        
        if ((tokenHash || token) && type === 'recovery') {
          setIsRecoveryFlow(true);
          
          // Verify the OTP token to get a session
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash || undefined,
            token: token || undefined,
            type: 'recovery',
          });
          
          if (error || !data.session) {
            console.error("Token verification failed:", error);
            toast({
              variant: "destructive",
              title: "Invalid or expired link",
              description: "Please request a new password reset link.",
            });
            navigate("/login");
            return;
          }
          
          // Clear the query params from URL for cleaner display
          window.history.replaceState(null, '', window.location.pathname);
          setIsInitializing(false);
          return;
        }
        
        // Handle hash params (legacy format)
        if (accessToken && hashType === 'recovery') {
          setIsRecoveryFlow(true);
          const { data: { session }, error } = await supabase.auth.getSession();
          
          if (error || !session) {
            toast({
              variant: "destructive",
              title: "Invalid or expired link",
              description: "Please request a new password reset link.",
            });
            navigate("/login");
            return;
          }
          
          window.history.replaceState(null, '', window.location.pathname);
          setIsInitializing(false);
          return;
        }
        
        // Check if user has an existing session (force change flow)
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          navigate("/login");
          return;
        }
        setIsInitializing(false);
      } catch (error) {
        console.error("Error handling recovery session:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Unable to process password reset. Please try again.",
        });
        navigate("/login");
      }
    };

    // Listen for auth state changes (handles the recovery token exchange)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecoveryFlow(true);
        setIsInitializing(false);
      }
    });

    handleRecoverySession();

    return () => subscription.unsubscribe();
  }, [navigate, toast, searchParams]);

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

  // Show loading while checking session
  if (isInitializing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
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
              {isRecoveryFlow ? "Reset Password" : "Change Password"}
            </CardTitle>
            <CardDescription className="text-base text-muted-foreground">
              {isRecoveryFlow 
                ? "Enter your new password below" 
                : "For security, you must set a new password before continuing"}
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
            <Button
              type="submit"
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
              disabled={isLoading}
            >
              {isLoading ? "Updating..." : "Set New Password"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default ForcePasswordChange;