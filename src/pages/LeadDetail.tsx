import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import {
  ArrowLeft,
  Mail,
  Phone,
  Building,
  Briefcase,
  MapPin,
  Calendar,
  Save,
  PhoneCall,
  Send,
  Trash2,
} from "lucide-react";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import ProtectedRoute from "@/components/ProtectedRoute";
import LeadTimeline from "@/components/crm/LeadTimeline";
import LeadScoring from "@/components/crm/LeadScoring";
import { LeadNurturing } from "@/components/crm/LeadNurturing";
import { format } from "date-fns";

interface Lead {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  company?: string;
  job_title?: string;
  status: string;
  score: number;
  source: string;
  vertical?: string;
  industry?: string;
  company_size?: string;
  notes?: string;
  tags?: string[];
  created_at: string;
  updated_at: string;
  last_contacted_at?: string;
}

const VERTICALS = [
  "Hotels & Resorts",
  "Multifamily Real Estate",
  "Pickleball Clubs & Country Clubs",
  "Entertainment Venues",
  "Physical Therapy",
  "Corporate Offices & Co-Working Spaces",
  "Education",
  "Gyms",
];

const STATUSES = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" },
  { value: "converted", label: "Won" },
  { value: "lost", label: "Lost" },
];

export default function LeadDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<Lead>>({});

  useEffect(() => {
    if (id) {
      fetchLead();
    }
  }, [id]);

  const fetchLead = async () => {
    try {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        toast.error("Lead not found");
        navigate("/crm");
        return;
      }

      setLead(data);
      setFormData(data);
    } catch (error) {
      console.error("Error fetching lead:", error);
      toast.error("Failed to load lead");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!lead) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("leads")
        .update({
          first_name: formData.first_name,
          last_name: formData.last_name,
          email: formData.email,
          phone: formData.phone,
          company: formData.company,
          job_title: formData.job_title,
          status: formData.status,
          vertical: formData.vertical,
          notes: formData.notes,
        })
        .eq("id", lead.id);

      if (error) throw error;

      toast.success("Lead updated successfully");
      fetchLead();
    } catch (error) {
      console.error("Error updating lead:", error);
      toast.error("Failed to update lead");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!lead || !confirm("Are you sure you want to delete this lead?")) return;

    try {
      const { error } = await supabase.from("leads").delete().eq("id", lead.id);

      if (error) throw error;

      toast.success("Lead deleted");
      navigate("/crm");
    } catch (error) {
      console.error("Error deleting lead:", error);
      toast.error("Failed to delete lead");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "new":
        return "bg-blue-500/10 text-blue-500";
      case "contacted":
        return "bg-purple-500/10 text-purple-500";
      case "qualified":
        return "bg-green-500/10 text-green-500";
      case "converted":
        return "bg-emerald-500/10 text-emerald-500";
      case "lost":
        return "bg-muted text-muted-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="flex min-h-screen flex-col bg-background">
          <NavBar />
          <main className="flex-1 flex items-center justify-center">
            <p className="text-muted-foreground">Loading lead...</p>
          </main>
          <Footer />
        </div>
      </ProtectedRoute>
    );
  }

  if (!lead) return null;

  return (
    <ProtectedRoute>
      <div className="flex min-h-screen flex-col bg-background">
        <NavBar />
        <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-6">
            <Button variant="ghost" onClick={() => navigate("/crm")} className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to CRM
            </Button>

            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="text-xl">
                    {lead.first_name[0]}
                    {lead.last_name[0]}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h1 className="text-3xl font-bold">
                    {lead.first_name} {lead.last_name}
                  </h1>
                  {lead.company && (
                    <p className="text-muted-foreground flex items-center gap-1">
                      <Building className="h-4 w-4" />
                      {lead.job_title && `${lead.job_title} at `}
                      {lead.company}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <Badge className={getStatusColor(lead.status)}>
                      {lead.status}
                    </Badge>
                    <Badge variant="outline">Score: {lead.score}</Badge>
                    <Badge variant="outline">{lead.source}</Badge>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                {lead.phone && (
                  <Button variant="outline" asChild>
                    <a href={`tel:${lead.phone}`}>
                      <PhoneCall className="mr-2 h-4 w-4" />
                      Call
                    </a>
                  </Button>
                )}
                <Button variant="outline" asChild>
                  <a href={`mailto:${lead.email}`}>
                    <Send className="mr-2 h-4 w-4" />
                    Email
                  </a>
                </Button>
                <Button variant="destructive" size="icon" onClick={handleDelete}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Tabs defaultValue="details">
                <TabsList>
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="activity">Activity</TabsTrigger>
                  <TabsTrigger value="nurturing">AI Nurturing</TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="space-y-6 mt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Contact Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="first_name">First Name</Label>
                          <Input
                            id="first_name"
                            value={formData.first_name || ""}
                            onChange={(e) =>
                              setFormData({ ...formData, first_name: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="last_name">Last Name</Label>
                          <Input
                            id="last_name"
                            value={formData.last_name || ""}
                            onChange={(e) =>
                              setFormData({ ...formData, last_name: e.target.value })
                            }
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="email"
                            type="email"
                            className="pl-10"
                            value={formData.email || ""}
                            onChange={(e) =>
                              setFormData({ ...formData, email: e.target.value })
                            }
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="phone">Phone</Label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="phone"
                            className="pl-10"
                            value={formData.phone || ""}
                            onChange={(e) =>
                              setFormData({ ...formData, phone: e.target.value })
                            }
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Company Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="company">Company</Label>
                        <div className="relative">
                          <Building className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="company"
                            className="pl-10"
                            value={formData.company || ""}
                            onChange={(e) =>
                              setFormData({ ...formData, company: e.target.value })
                            }
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="job_title">Job Title</Label>
                        <div className="relative">
                          <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="job_title"
                            className="pl-10"
                            value={formData.job_title || ""}
                            onChange={(e) =>
                              setFormData({ ...formData, job_title: e.target.value })
                            }
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="vertical">Industry Vertical</Label>
                        <Select
                          value={formData.vertical || ""}
                          onValueChange={(value) =>
                            setFormData({ ...formData, vertical: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select vertical" />
                          </SelectTrigger>
                          <SelectContent>
                            {VERTICALS.map((v) => (
                              <SelectItem key={v} value={v}>
                                {v}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Status & Notes</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="status">Status</Label>
                        <Select
                          value={formData.status || ""}
                          onValueChange={(value) =>
                            setFormData({ ...formData, status: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUSES.map((s) => (
                              <SelectItem key={s.value} value={s.value}>
                                {s.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="notes">Notes</Label>
                        <Textarea
                          id="notes"
                          rows={4}
                          value={formData.notes || ""}
                          onChange={(e) =>
                            setFormData({ ...formData, notes: e.target.value })
                          }
                          placeholder="Add notes about this lead..."
                        />
                      </div>

                      <Button onClick={handleSave} disabled={saving}>
                        <Save className="mr-2 h-4 w-4" />
                        {saving ? "Saving..." : "Save Changes"}
                      </Button>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="activity" className="mt-4">
                  <Card>
                    <CardContent className="pt-6">
                      <LeadTimeline leadId={lead.id} />
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="nurturing" className="mt-4">
                  <LeadNurturing lead={lead} onUpdate={fetchLead} />
                </TabsContent>
              </Tabs>
            </div>

            <div className="space-y-6">
              <LeadScoring lead={lead} onUpdate={fetchLead} />

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Lead Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Source</span>
                    <span>{lead.source}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Created</span>
                    <span>{format(new Date(lead.created_at), "MMM d, yyyy")}</span>
                  </div>
                  {lead.last_contacted_at && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Last Contacted</span>
                      <span>
                        {format(new Date(lead.last_contacted_at), "MMM d, yyyy")}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    </ProtectedRoute>
  );
}
