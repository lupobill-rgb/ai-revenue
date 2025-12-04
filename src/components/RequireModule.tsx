/**
 * Route Protection Component for Module Access
 * Redirects to /dashboard if module is disabled
 */

import { ReactNode, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useModuleEnabled, ModuleName } from "@/hooks/useModuleEnabled";
import { Loader2 } from "lucide-react";

interface RequireModuleProps {
  module: ModuleName;
  children: ReactNode;
  fallbackPath?: string;
}

export function RequireModule({ 
  module, 
  children, 
  fallbackPath = "/dashboard" 
}: RequireModuleProps) {
  const navigate = useNavigate();
  const { isEnabled, isLoading } = useModuleEnabled(module);

  useEffect(() => {
    if (!isLoading && !isEnabled) {
      navigate(fallbackPath, { replace: true });
    }
  }, [isEnabled, isLoading, navigate, fallbackPath]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isEnabled) {
    return null;
  }

  return <>{children}</>;
}

export default RequireModule;
