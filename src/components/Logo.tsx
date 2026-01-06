import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Building2 } from "lucide-react";
import { useActiveWorkspaceId } from "@/hooks/useWorkspace";
import ubigrowthLogo from "@/assets/ubigrowth-logo.png";

interface LogoProps {
  className?: string;
  showCompanyName?: boolean;
}

interface BusinessProfile {
  business_name: string | null;
}

const Logo = ({ className = "h-8", showCompanyName = false }: LogoProps) => {
  const workspaceId = useActiveWorkspaceId();
  const [profile, setProfile] = useState<BusinessProfile | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!workspaceId) return;

      const { data } = await supabase
        .from("business_profiles")
        .select("business_name")
        .eq("workspace_id", workspaceId)
        .maybeSingle();

      if (data) {
        setProfile(data);
      }
    };

    fetchProfile();
  }, [workspaceId]);

  const companyName = profile?.business_name;

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <img 
        src={ubigrowthLogo} 
        alt="UbiGrowth CMO Logo" 
        className="h-full w-auto object-contain"
      />
      <div className="flex flex-col">
        <span className="text-xl font-bold tracking-tight text-foreground">
          UbiGrowth CMO
        </span>
        {showCompanyName && companyName && (
          <span className="text-xs text-muted-foreground">
            {companyName}
          </span>
        )}
      </div>
    </div>
  );
};

export default Logo;
