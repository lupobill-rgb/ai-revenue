import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  RefreshCw,
  Mail,
  Phone,
  AlertTriangle,
  Settings,
  Gauge,
  Clock,
  Save,
} from "lucide-react";

interface TenantRateLimit {
  id: string;
  tenant_id: string;
  email_daily_limit: number;
  email_hourly_limit: number;
  email_daily_used: number;
  email_hourly_used: number;
  voice_daily_minutes: number;
  voice_hourly_minutes: number;
  voice_daily_minutes_used: number;
  voice_hourly_minutes_used: number;
  daily_reset_at: string;
  hourly_reset_at: string;
  soft_cap_enabled: boolean;
  notify_at_percentage: number;
}

interface RateLimitEvent {
  id: string;
  tenant_id: string;
  event_type: string;
  channel: string;
  limit_type: string;
  current_usage: number;
  limit_value: number;
  created_at: string;
}

interface Tenant {
  id: string;
  name: string;
}

export default function TenantRateLimits() {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [rateLimits, setRateLimits] = useState<Map<string, TenantRateLimit>>(new Map());
  const [events, setEvents] = useState<RateLimitEvent[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<TenantRateLimit>>({});
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    checkAdmin();
  }, []);

  useEffect(() => {
    if (isAdmin) {
      fetchData();
    }
  }, [isAdmin]);

  async function checkAdmin() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/login");
      return;
    }

    // Use the proper is_platform_admin RPC function
    const { data: isPlatformAdminResult, error } = await supabase
      .rpc("is_platform_admin", { _user_id: user.id });
    
    if (error) {
      console.error("Error checking platform admin:", error);
      // Fallback: check user_tenants role
      const { data: userTenant } = await supabase
        .from("user_tenants")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();
      
      const isAdmin = userTenant?.role === "owner" || userTenant?.role === "admin";
      if (!isAdmin) {
        toast.error("Access denied. Platform admin role required.");
        navigate("/");
        return;
      }
      setIsAdmin(true);
      return;
    }

    if (!isPlatformAdminResult) {
      toast.error("Access denied. Platform admin role required.");
      navigate("/");
      return;
    }

    setIsAdmin(true);
  }

  async function fetchData() {
    setLoading(true);
    try {
      // Fetch tenants
      const { data: tenantsData } = await supabase
        .from("tenants")
        .select("id, name")
        .eq("status", "active")
        .order("name");
      
      setTenants((tenantsData || []) as Tenant[]);

      // Fetch rate limits
      const { data: limitsData } = await supabase
        .from("tenant_rate_limits")
        .select("*");
      
      const limitsMap = new Map<string, TenantRateLimit>();
      for (const limit of (limitsData || []) as TenantRateLimit[]) {
        limitsMap.set(limit.tenant_id, limit);
      }
      setRateLimits(limitsMap);

      // Fetch recent events
      const { data: eventsData } = await supabase
        .from("rate_limit_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      
      setEvents((eventsData || []) as RateLimitEvent[]);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to fetch rate limit data");
    } finally {
      setLoading(false);
    }
  }

  function selectTenant(tenantId: string) {
    setSelectedTenant(tenantId);
    const existing = rateLimits.get(tenantId);
    if (existing) {
      setEditForm(existing);
    } else {
      setEditForm({
        email_daily_limit: 1000,
        email_hourly_limit: 100,
        voice_daily_minutes: 60,
        voice_hourly_minutes: 15,
        soft_cap_enabled: true,
        notify_at_percentage: 80,
      });
    }
  }

  async function saveLimits() {
    if (!selectedTenant) return;
    
    setSaving(true);
    try {
      const existing = rateLimits.get(selectedTenant);
      
      if (existing) {
        // Update
        const { error } = await supabase
          .from("tenant_rate_limits")
          .update({
            email_daily_limit: editForm.email_daily_limit,
            email_hourly_limit: editForm.email_hourly_limit,
            voice_daily_minutes: editForm.voice_daily_minutes,
            voice_hourly_minutes: editForm.voice_hourly_minutes,
            soft_cap_enabled: editForm.soft_cap_enabled,
            notify_at_percentage: editForm.notify_at_percentage,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
        
        if (error) throw error;
      } else {
        // Insert
        const { error } = await supabase
          .from("tenant_rate_limits")
          .insert({
            tenant_id: selectedTenant,
            email_daily_limit: editForm.email_daily_limit,
            email_hourly_limit: editForm.email_hourly_limit,
            voice_daily_minutes: editForm.voice_daily_minutes,
            voice_hourly_minutes: editForm.voice_hourly_minutes,
            soft_cap_enabled: editForm.soft_cap_enabled,
            notify_at_percentage: editForm.notify_at_percentage,
          });
        
        if (error) throw error;
      }
      
      toast.success("Rate limits saved successfully");
      await fetchData();
    } catch (error) {
      console.error("Error saving limits:", error);
      toast.error("Failed to save rate limits");
    } finally {
      setSaving(false);
    }
  }

  function getUsagePercentage(used: number, limit: number): number {
    if (limit === 0) return 0;
    return Math.min(100, Math.round((used / limit) * 100));
  }

  function getUsageColor(percentage: number): string {
    if (percentage >= 100) return "bg-destructive";
    if (percentage >= 80) return "bg-yellow-500";
    return "bg-green-500";
  }

  if (!isAdmin) return null;

  const capHitEvents = events.filter(e => e.event_type === "cap_hit");
  const warningEvents = events.filter(e => e.event_type === "warning_threshold");

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <NavBar />
      <main className="flex-1 container py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Gauge className="h-8 w-8" />
              Tenant Rate Limits
            </h1>
            <p className="text-muted-foreground mt-1">
              Cost & rate controls to prevent runaway spend
            </p>
          </div>
          <Button onClick={fetchData} disabled={loading} variant="outline">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Tenants</p>
                  <p className="text-3xl font-bold">{tenants.length}</p>
                </div>
                <Settings className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Configured</p>
                  <p className="text-3xl font-bold">{rateLimits.size}</p>
                </div>
                <Gauge className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Caps Hit (24h)</p>
                  <p className="text-3xl font-bold text-destructive">{capHitEvents.length}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Warnings (24h)</p>
                  <p className="text-3xl font-bold text-yellow-500">{warningEvents.length}</p>
                </div>
                <Clock className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="overview">Usage Overview</TabsTrigger>
            <TabsTrigger value="configure">Configure Limits</TabsTrigger>
            <TabsTrigger value="events">
              Events {capHitEvents.length > 0 && <Badge variant="destructive" className="ml-2">{capHitEvents.length}</Badge>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : tenants.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No tenants found</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {tenants.map((tenant) => {
                  const limits = rateLimits.get(tenant.id);
                  const now = new Date();
                  
                  // Check if windows have reset
                  const dailyReset = limits ? new Date(limits.daily_reset_at) : now;
                  const hourlyReset = limits ? new Date(limits.hourly_reset_at) : now;
                  const isDailyReset = now >= dailyReset;
                  const isHourlyReset = now >= hourlyReset;
                  
                  const emailDailyUsed = isDailyReset ? 0 : (limits?.email_daily_used || 0);
                  const emailHourlyUsed = isHourlyReset ? 0 : (limits?.email_hourly_used || 0);
                  const voiceDailyUsed = isDailyReset ? 0 : (limits?.voice_daily_minutes_used || 0);
                  const voiceHourlyUsed = isHourlyReset ? 0 : (limits?.voice_hourly_minutes_used || 0);
                  
                  const emailDailyPct = getUsagePercentage(emailDailyUsed, limits?.email_daily_limit || 1000);
                  const emailHourlyPct = getUsagePercentage(emailHourlyUsed, limits?.email_hourly_limit || 100);
                  const voiceDailyPct = getUsagePercentage(voiceDailyUsed, limits?.voice_daily_minutes || 60);
                  const voiceHourlyPct = getUsagePercentage(voiceHourlyUsed, limits?.voice_hourly_minutes || 15);

                  return (
                    <Card key={tenant.id}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center justify-between">
                          {tenant.name}
                          {!limits && <Badge variant="outline">Default</Badge>}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Email Usage */}
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">Email</span>
                          </div>
                          <div className="space-y-2">
                            <div>
                              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                                <span>Daily</span>
                                <span>{emailDailyUsed} / {limits?.email_daily_limit || 1000}</span>
                              </div>
                              <Progress value={emailDailyPct} className={getUsageColor(emailDailyPct)} />
                            </div>
                            <div>
                              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                                <span>Hourly</span>
                                <span>{emailHourlyUsed} / {limits?.email_hourly_limit || 100}</span>
                              </div>
                              <Progress value={emailHourlyPct} className={getUsageColor(emailHourlyPct)} />
                            </div>
                          </div>
                        </div>

                        {/* Voice Usage */}
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">Voice (minutes)</span>
                          </div>
                          <div className="space-y-2">
                            <div>
                              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                                <span>Daily</span>
                                <span>{voiceDailyUsed} / {limits?.voice_daily_minutes || 60}</span>
                              </div>
                              <Progress value={voiceDailyPct} className={getUsageColor(voiceDailyPct)} />
                            </div>
                            <div>
                              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                                <span>Hourly</span>
                                <span>{voiceHourlyUsed} / {limits?.voice_hourly_minutes || 15}</span>
                              </div>
                              <Progress value={voiceHourlyPct} className={getUsageColor(voiceHourlyPct)} />
                            </div>
                          </div>
                        </div>

                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full"
                          onClick={() => {
                            selectTenant(tenant.id);
                            setActiveTab("configure");
                          }}
                        >
                          <Settings className="h-4 w-4 mr-2" />
                          Configure
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="configure">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Tenant Selector */}
              <Card>
                <CardHeader>
                  <CardTitle>Select Tenant</CardTitle>
                  <CardDescription>Choose a tenant to configure limits</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {tenants.map((tenant) => (
                      <Button
                        key={tenant.id}
                        variant={selectedTenant === tenant.id ? "default" : "outline"}
                        className="w-full justify-start"
                        onClick={() => selectTenant(tenant.id)}
                      >
                        {tenant.name}
                        {rateLimits.has(tenant.id) && (
                          <Badge variant="secondary" className="ml-auto">Configured</Badge>
                        )}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Limit Configuration */}
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Rate Limit Configuration</CardTitle>
                  <CardDescription>
                    {selectedTenant 
                      ? `Configure limits for ${tenants.find(t => t.id === selectedTenant)?.name}`
                      : "Select a tenant to configure"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {selectedTenant ? (
                    <div className="space-y-6">
                      {/* Email Limits */}
                      <div>
                        <h4 className="text-sm font-medium flex items-center gap-2 mb-4">
                          <Mail className="h-4 w-4" />
                          Email Limits
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="email_daily">Daily Limit</Label>
                            <Input
                              id="email_daily"
                              type="number"
                              value={editForm.email_daily_limit || 0}
                              onChange={(e) => setEditForm({ ...editForm, email_daily_limit: parseInt(e.target.value) || 0 })}
                            />
                          </div>
                          <div>
                            <Label htmlFor="email_hourly">Hourly Limit</Label>
                            <Input
                              id="email_hourly"
                              type="number"
                              value={editForm.email_hourly_limit || 0}
                              onChange={(e) => setEditForm({ ...editForm, email_hourly_limit: parseInt(e.target.value) || 0 })}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Voice Limits */}
                      <div>
                        <h4 className="text-sm font-medium flex items-center gap-2 mb-4">
                          <Phone className="h-4 w-4" />
                          Voice Limits (minutes)
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="voice_daily">Daily Limit</Label>
                            <Input
                              id="voice_daily"
                              type="number"
                              value={editForm.voice_daily_minutes || 0}
                              onChange={(e) => setEditForm({ ...editForm, voice_daily_minutes: parseInt(e.target.value) || 0 })}
                            />
                          </div>
                          <div>
                            <Label htmlFor="voice_hourly">Hourly Limit</Label>
                            <Input
                              id="voice_hourly"
                              type="number"
                              value={editForm.voice_hourly_minutes || 0}
                              onChange={(e) => setEditForm({ ...editForm, voice_hourly_minutes: parseInt(e.target.value) || 0 })}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Soft Cap Settings */}
                      <div className="border-t pt-4">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <Label>Soft Cap Warnings</Label>
                            <p className="text-sm text-muted-foreground">
                              Send warnings before hitting hard limits
                            </p>
                          </div>
                          <Switch
                            checked={editForm.soft_cap_enabled || false}
                            onCheckedChange={(checked) => setEditForm({ ...editForm, soft_cap_enabled: checked })}
                          />
                        </div>
                        {editForm.soft_cap_enabled && (
                          <div>
                            <Label htmlFor="notify_pct">Warning at (%)</Label>
                            <Input
                              id="notify_pct"
                              type="number"
                              min={50}
                              max={99}
                              value={editForm.notify_at_percentage || 80}
                              onChange={(e) => setEditForm({ ...editForm, notify_at_percentage: parseInt(e.target.value) || 80 })}
                            />
                          </div>
                        )}
                      </div>

                      <Button onClick={saveLimits} disabled={saving} className="w-full">
                        <Save className="h-4 w-4 mr-2" />
                        {saving ? "Saving..." : "Save Limits"}
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Settings className="h-12 w-12 mx-auto mb-2" />
                      <p>Select a tenant to configure rate limits</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="events">
            <Card>
              <CardHeader>
                <CardTitle>Rate Limit Events</CardTitle>
                <CardDescription>Recent cap hits and warning thresholds</CardDescription>
              </CardHeader>
              <CardContent>
                {events.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Gauge className="h-12 w-12 mx-auto mb-2" />
                    <p>No rate limit events recorded</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Channel</TableHead>
                        <TableHead>Limit Type</TableHead>
                        <TableHead>Usage</TableHead>
                        <TableHead>Tenant</TableHead>
                        <TableHead>Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {events.map((event) => {
                        const tenant = tenants.find(t => t.id === event.tenant_id);
                        return (
                          <TableRow key={event.id}>
                            <TableCell>
                              <Badge variant={event.event_type === "cap_hit" ? "destructive" : "secondary"}>
                                {event.event_type === "cap_hit" ? "Cap Hit" : "Warning"}
                              </Badge>
                            </TableCell>
                            <TableCell className="capitalize">{event.channel}</TableCell>
                            <TableCell className="capitalize">{event.limit_type}</TableCell>
                            <TableCell>
                              {event.current_usage} / {event.limit_value}
                            </TableCell>
                            <TableCell>{tenant?.name || event.tenant_id.slice(0, 8)}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {new Date(event.created_at).toLocaleString()}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
      <Footer />
    </div>
  );
}
