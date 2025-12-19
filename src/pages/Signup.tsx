import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Building2 } from "lucide-react";
import { z } from "zod";

const GoogleIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24">
    <path
      fill="currentColor"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="currentColor"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="currentColor"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill="currentColor"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);

type AppRole = 'admin' | 'sales' | 'manager';

const signupSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().trim().email({ message: "Invalid email address" }).max(255),
  password: z.string().min(8, { message: "Password must be at least 8 characters" }).max(100),
  confirmPassword: z.string(),
  role: z.enum(['admin', 'sales', 'manager']),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

const Signup = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<AppRole>("admin");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string; confirmPassword?: string; role?: string }>({});

  const handleGoogleSignUp = async () => {
    setIsGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'https://cmo.ubigrowth.ai/auth/callback',
        },
      });

      if (error) {
        toast({
          variant: "destructive",
          title: "Google sign-up failed",
          description: error.message,
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
      });
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    
    const result = signupSchema.safeParse({ name, email, password, confirmPassword, role });
    if (!result.success) {
      const fieldErrors: { name?: string; email?: string; password?: string; confirmPassword?: string; role?: string } = {};
      result.error.errors.forEach((err) => {
        const field = err.path[0] as keyof typeof fieldErrors;
        if (field) fieldErrors[field] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);

    try {
      const redirectUrl = 'https://cmo.ubigrowth.ai/onboarding';
      
      const { data, error } = await supabase.auth.signUp({
        email: result.data.email,
        password: result.data.password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            name: result.data.name,
            role: result.data.role,
          }
        }
      });

      if (error) {
        if (error.message.includes("already registered")) {
          toast({
            variant: "destructive",
            title: "Account exists",
            description: "This email is already registered. Please sign in instead.",
          });
        } else {
          toast({
            variant: "destructive",
            title: "Signup failed",
            description: error.message,
          });
        }
      } else if (data.user) {
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert({ user_id: data.user.id, role: result.data.role });

        if (roleError) {
          console.error('Error assigning role:', roleError);
        }

        toast({
          title: "Welcome!",
          description: "Let's set up your business profile.",
        });
        navigate("/onboarding");
      }
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md animate-fade-in border-border bg-card">
        <CardHeader className="space-y-4 text-center">
          <div className="flex justify-center">
            <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
          </div>
          <div>
            <CardTitle className="text-3xl font-bold tracking-tight">Get Started</CardTitle>
            <CardDescription className="text-base text-muted-foreground">
              Create your marketing platform account
            </CardDescription>
          </div>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-foreground">
                Full Name
              </Label>
              <Input
                id="name"
                type="text"
                placeholder="Jane Smith"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isLoading}
                className="bg-background border-input text-foreground placeholder:text-muted-foreground"
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? "name-error" : undefined}
              />
              {errors.name && (
                <p id="name-error" className="text-sm text-destructive">
                  {errors.name}
                </p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground">
                Work Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                className="bg-background border-input text-foreground placeholder:text-muted-foreground"
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "email-error" : undefined}
              />
              {errors.email && (
                <p id="email-error" className="text-sm text-destructive">
                  {errors.email}
                </p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                className="bg-background border-input text-foreground"
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? "password-error" : undefined}
              />
              {errors.password && (
                <p id="password-error" className="text-sm text-destructive">
                  {errors.password}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Must be at least 8 characters
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-foreground">
                Confirm Password
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isLoading}
                className="bg-background border-input text-foreground"
                aria-invalid={!!errors.confirmPassword}
                aria-describedby={errors.confirmPassword ? "confirm-password-error" : undefined}
              />
              {errors.confirmPassword && (
                <p id="confirm-password-error" className="text-sm text-destructive">
                  {errors.confirmPassword}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="role" className="text-foreground">
                Your Role
              </Label>
              <Select value={role} onValueChange={(v) => setRole(v as AppRole)} disabled={isLoading}>
                <SelectTrigger className="bg-background border-input text-foreground">
                  <SelectValue placeholder="Select your role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="sales">Sales</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button
              type="submit"
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
              disabled={isLoading || isGoogleLoading}
            >
              {isLoading ? "Creating account..." : "Create Account"}
            </Button>
            
            <div className="relative w-full">
              <div className="absolute inset-0 flex items-center">
                <Separator className="w-full" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
              </div>
            </div>
            
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleGoogleSignUp}
              disabled={isLoading || isGoogleLoading}
            >
              <GoogleIcon />
              <span className="ml-2">{isGoogleLoading ? "Signing up..." : "Google"}</span>
            </Button>
            
            <div className="text-center text-sm">
              <span className="text-muted-foreground">Already have an account? </span>
              <Link
                to="/login"
                className="text-primary hover:text-primary/90 font-medium transition-colors"
              >
                Sign in
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default Signup;
