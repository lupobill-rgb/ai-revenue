import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Building2 } from "lucide-react";

interface LogoProps {
  className?: string;
  showTagline?: boolean;
}

interface BusinessProfile {
  business_name: string | null;
  logo_url: string | null;
}

const Logo = ({ className = "h-8", showTagline = false }: LogoProps) => {
  const [profile, setProfile] = useState<BusinessProfile | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("business_profiles")
        .select("business_name, logo_url")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data) {
        setProfile(data);
      }
    };

    fetchProfile();
  }, []);

  const businessName = profile?.business_name || "Marketing Platform";
  const logoUrl = profile?.logo_url;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {logoUrl ? (
        <img 
          src={logoUrl} 
          alt={`${businessName} Logo`} 
          className="h-full w-auto object-contain"
        />
      ) : (
        <div className="h-full aspect-square bg-primary/10 rounded-md flex items-center justify-center">
          <Building2 className="h-5 w-5 text-primary" />
        </div>
      )}
      <div className="flex flex-col">
        <span className="text-xl font-bold tracking-tight text-foreground">
          {businessName}
        </span>
        {showTagline && (
          <span className="text-xs text-muted-foreground">
            AI-Powered Marketing Platform
          </span>
        )}
      </div>
    </div>
  );
};

export default Logo;
