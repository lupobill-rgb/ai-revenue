import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from "@/components/ui/dropdown-menu";
import { Menu, X, LogOut, User, Settings, Plus, Shield, Plug, Home, PenSquare, CheckSquare, Rocket, BarChart3, Users, ChevronDown, FileText, Video, Mail, Phone, Globe, Layout, Database, Workflow, HelpCircle, Sparkles } from "lucide-react";
import Logo from "@/components/Logo";
import NotificationBell from "@/components/NotificationBell";
import FeedbackButton from "@/components/FeedbackButton";
import WorkspaceSelector from "@/components/WorkspaceSelector";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useAllModulesEnabled } from "@/hooks/useModuleEnabled";

const NavBar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { user, roles, isAdmin, signOut } = useAuth();
  const { modules } = useAllModulesEnabled();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userName, setUserName] = useState<string>("");
  const [userInitials, setUserInitials] = useState<string>("U");
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);

  useEffect(() => {
    if (user) {
      supabase.rpc('is_platform_admin')
        .then(({ data }) => setIsPlatformAdmin(!!data));
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      const name = user.user_metadata?.name || user.email?.split('@')[0] || "User";
      setUserName(name);
      const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
      setUserInitials(initials);
    }
  }, [user]);

  const handleLogout = async () => {
    await signOut();
    toast({
      title: "Signed out",
      description: "You've been successfully signed out.",
    });
    navigate("/login");
  };

  // Primary navigation items
  const primaryNav = [
    { path: "/dashboard", label: "Home", icon: Home },
    { path: "/approvals", label: "Approve", icon: CheckSquare },
    { path: "/reports", label: "Analytics", icon: BarChart3 },
    { path: "/crm", label: "CRM", icon: Users, module: "crm" as const },
  ];

  // Create dropdown items
  const createItems = [
    { path: "/new-campaign", label: "New Campaign", icon: Plus },
    { path: "/assets", label: "Asset Catalog", icon: FileText },
    { path: "/assets/new", label: "New Asset", icon: PenSquare },
    { path: "/video", label: "Video", icon: Video },
    { path: "/email", label: "Email", icon: Mail },
    { path: "/social", label: "Social", icon: Globe },
    { path: "/landing-pages", label: "Landing Pages", icon: Layout },
    { path: "/voice-agents", label: "Voice Agents", icon: Phone },
  ];

  // Deploy/Campaigns dropdown items
  const deployItems = [
    { path: "/outbound", label: "Outbound", icon: Rocket },
    { path: "/websites", label: "Sites", icon: Globe },
    { path: "/automation", label: "Automation", icon: Workflow },
    { path: "/sms", label: "SMS", icon: Mail },
  ];

  // Admin items (shown conditionally)
  const adminItems = modules.os_admin ? [
    { path: "/os", label: "OS Dashboard", icon: Database },
  ] : [];

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + "/");
  const isInGroup = (paths: string[]) => paths.some(p => isActive(p));

  const getRoleBadgeColor = () => {
    if (isAdmin) return "bg-red-500/10 text-red-500";
    if (roles.includes('manager')) return "bg-blue-500/10 text-blue-500";
    if (roles.includes('sales')) return "bg-green-500/10 text-green-500";
    return "bg-muted text-muted-foreground";
  };

  const getPrimaryRole = () => {
    if (isAdmin) return "Admin";
    if (roles.includes('manager')) return "Manager";
    if (roles.includes('sales')) return "Sales";
    return "User";
  };

  const filteredPrimaryNav = primaryNav.filter((link) => {
    if (!link.module) return true;
    return modules[link.module];
  });

  return (
    <nav className="border-b border-border bg-card sticky top-0 z-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Main Navigation Row */}
        <div className="flex h-16 items-center justify-between gap-4">
          <div className="flex items-center min-w-0 flex-1 mr-4">
            <Link to="/dashboard" className="flex-shrink-0">
              <Logo className="h-8" showCompanyName />
            </Link>
            <div className="hidden lg:block ml-6 flex-1 min-w-0">
              <div className="flex items-baseline space-x-1">
                {/* Primary nav items */}
                {filteredPrimaryNav.map((link) => (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                      isActive(link.path)
                        ? "bg-secondary text-foreground"
                        : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                    }`}
                  >
                    <link.icon className="h-4 w-4" />
                    {link.label}
                  </Link>
                ))}

                {/* Create Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1 ${
                        isInGroup(createItems.map(i => i.path))
                          ? "bg-secondary text-foreground"
                          : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                      }`}
                    >
                      <PenSquare className="h-4 w-4" />
                      Create
                      <ChevronDown className="h-3 w-3" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48">
                    {createItems.map((item) => (
                      <DropdownMenuItem key={item.path} onClick={() => navigate(item.path)}>
                        <item.icon className="mr-2 h-4 w-4" />
                        {item.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Deploy Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1 ${
                        isInGroup(deployItems.map(i => i.path))
                          ? "bg-secondary text-foreground"
                          : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                      }`}
                    >
                      <Rocket className="h-4 w-4" />
                      Deploy
                      <ChevronDown className="h-3 w-3" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48">
                    {deployItems.map((item) => (
                      <DropdownMenuItem key={item.path} onClick={() => navigate(item.path)}>
                        <item.icon className="mr-2 h-4 w-4" />
                        {item.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2">
            {/* Workspace Selector */}
            <WorkspaceSelector />
            
            {/* Help Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <HelpCircle className="h-5 w-5 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => {
                  window.dispatchEvent(new CustomEvent('trigger-product-tour'));
                }}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Restart Tour
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  window.dispatchEvent(new CustomEvent('open-ai-chat'));
                }}>
                  <HelpCircle className="mr-2 h-4 w-4" />
                  AI Assistant
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <NotificationBell />
            <FeedbackButton />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary text-primary-foreground text-sm font-medium">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{userName}</p>
                    <Badge variant="outline" className={`w-fit text-xs ${getRoleBadgeColor()}`}>
                      {getPrimaryRole()}
                    </Badge>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/profile")}>
                  <User className="mr-2 h-4 w-4" />
                  User Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/settings")}>
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/settings/integrations")}>
                  <Plug className="mr-2 h-4 w-4" />
                  Integrations
                </DropdownMenuItem>
                {isPlatformAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate("/platform-admin")}>
                      <Shield className="mr-2 h-4 w-4 text-primary" />
                      Platform Admin
                    </DropdownMenuItem>
                  </>
                )}
                {isAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate("/users")}>
                      <Shield className="mr-2 h-4 w-4" />
                      User Management
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="md:hidden">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </Button>
          </div>
        </div>

        {/* Admin Navigation Row (appears below main nav when admin items exist) */}
        {adminItems.length > 0 && (
          <div className="hidden lg:flex border-t border-border/50 py-2">
            <div className="flex items-center space-x-1 ml-[180px]">
              {adminItems.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-2 ${
                    isActive(link.path)
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                  }`}
                >
                  <link.icon className="h-3.5 w-3.5" />
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border">
          <div className="space-y-1 px-4 pb-3 pt-2">
            {/* Workspace Selector */}
            <div className="mb-3">
              <WorkspaceSelector />
            </div>
            
            <Button
              onClick={() => {
                navigate("/new-campaign");
                setMobileMenuOpen(false);
              }}
              size="sm"
              className="w-full mb-3 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="mr-2 h-4 w-4" />
              New Campaign
            </Button>
            
            {/* Primary nav */}
            {filteredPrimaryNav.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`block px-3 py-2 rounded-md text-base font-medium transition-colors flex items-center gap-2 ${
                  isActive(link.path)
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                <link.icon className="h-4 w-4" />
                {link.label}
              </Link>
            ))}

            {/* Create section */}
            <div className="pt-2 pb-1 px-3 text-xs font-semibold text-muted-foreground uppercase">Create</div>
            {createItems.slice(0, 4).map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`block px-3 py-2 rounded-md text-base font-medium transition-colors flex items-center gap-2 ${
                  isActive(item.path)
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}

            {/* Deploy section */}
            <div className="pt-2 pb-1 px-3 text-xs font-semibold text-muted-foreground uppercase">Deploy</div>
            {deployItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`block px-3 py-2 rounded-md text-base font-medium transition-colors flex items-center gap-2 ${
                  isActive(item.path)
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}

            {/* Admin items */}
            {adminItems.length > 0 && (
              <>
                <div className="pt-2 pb-1 px-3 text-xs font-semibold text-muted-foreground uppercase">Admin</div>
                {adminItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`block px-3 py-2 rounded-md text-base font-medium transition-colors flex items-center gap-2 ${
                      isActive(item.path)
                        ? "bg-secondary text-foreground"
                        : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                    }`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                ))}
              </>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="w-full justify-start text-muted-foreground hover:text-foreground mt-2"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      )}
    </nav>
  );
};

export default NavBar;
