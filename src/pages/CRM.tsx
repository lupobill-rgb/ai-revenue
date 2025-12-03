import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Plus, Upload, Search, Filter, Mail, Phone, Building, User, Calendar, PhoneCall, Loader2, LayoutGrid, List, BarChart3, Download, Building2 } from "lucide-react";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import ProtectedRoute from "@/components/ProtectedRoute";
import LeadPipeline from "@/components/crm/LeadPipeline";
import CRMDashboard from "@/components/crm/CRMDashboard";
import { DealsPipeline } from "@/components/crm/DealsPipeline";
import { TaskManager } from "@/components/crm/TaskManager";
import { EmailSequences } from "@/components/crm/EmailSequences";
import { CRMReports } from "@/components/crm/CRMReports";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast as sonnerToast } from "sonner";
import WorkspaceSelector from "@/components/WorkspaceSelector";

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
  assigned_to?: string;
  created_at: string;
  tags?: string[];
}

interface VapiAssistant {
  id: string;
  name: string;
}

interface VapiPhoneNumber {
  id: string;
  number: string;
  name: string;
}

const CRM = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [workspaceId, setWorkspaceId] = useState<string | null>(
    localStorage.getItem("currentWorkspaceId")
  );
  const [leads, setLeads] = useState<Lead[]>([]);
  const [activeTab, setActiveTab] = useState<"dashboard" | "list" | "pipeline" | "deals" | "tasks" | "sequences" | "reports">("dashboard");
  const [filteredLeads, setFilteredLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showNewLeadDialog, setShowNewLeadDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showScraperDialog, setShowScraperDialog] = useState(false);
  const [importing, setImporting] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [showSampleData, setShowSampleData] = useState(true);
  const [isDragging, setIsDragging] = useState(false);

  // Outbound calling state
  const [showCallDialog, setShowCallDialog] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [vapiAssistants, setVapiAssistants] = useState<VapiAssistant[]>([]);
  const [vapiPhoneNumbers, setVapiPhoneNumbers] = useState<VapiPhoneNumber[]>([]);
  const [selectedAssistantId, setSelectedAssistantId] = useState("");
  const [selectedPhoneNumberId, setSelectedPhoneNumberId] = useState("");
  const [isLoadingVapi, setIsLoadingVapi] = useState(false);
  const [isCalling, setIsCalling] = useState(false);

  // Scraper form
  const [scraperParams, setScraperParams] = useState({
    location: "",
    businessType: "hotel",
    radius: 5000,
    maxResults: 20,
  });

  // New lead form
  const [newLead, setNewLead] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    company: "",
    job_title: "",
    vertical: "",
    source: "manual",
    notes: "",
  });

  useEffect(() => {
    if (workspaceId) {
      fetchLeads();
    } else {
      setLeads([]);
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    filterLeads();
  }, [leads, searchQuery, statusFilter]);

  const fetchLeads = async () => {
    if (!workspaceId) return;
    
    try {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setLeads(data || []);
    } catch (error) {
      console.error("Error fetching leads:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load leads",
      });
    } finally {
      setLoading(false);
    }
  };

  const filterLeads = () => {
    let filtered = leads;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (lead) =>
          lead.first_name.toLowerCase().includes(query) ||
          lead.last_name.toLowerCase().includes(query) ||
          lead.email.toLowerCase().includes(query) ||
          lead.company?.toLowerCase().includes(query)
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((lead) => lead.status === statusFilter);
    }

    setFilteredLeads(filtered);
  };

  const fetchVapiData = async () => {
    setIsLoadingVapi(true);
    try {
      // Fetch assistants and phone numbers in parallel
      const [assistantsRes, phoneNumbersRes] = await Promise.all([
        supabase.functions.invoke('vapi-list-assistants'),
        supabase.functions.invoke('vapi-list-phone-numbers'),
      ]);

      if (assistantsRes.data?.assistants) {
        setVapiAssistants(assistantsRes.data.assistants);
        // Auto-select first assistant if available
        if (assistantsRes.data.assistants.length > 0 && !selectedAssistantId) {
          setSelectedAssistantId(assistantsRes.data.assistants[0].id);
        }
      }

      if (phoneNumbersRes.data?.phoneNumbers) {
        setVapiPhoneNumbers(phoneNumbersRes.data.phoneNumbers);
        // Auto-select first phone number if available
        if (phoneNumbersRes.data.phoneNumbers.length > 0 && !selectedPhoneNumberId) {
          setSelectedPhoneNumberId(phoneNumbersRes.data.phoneNumbers[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching Vapi data:', error);
      sonnerToast.error('Failed to load voice agents');
    } finally {
      setIsLoadingVapi(false);
    }
  };

  const handleCallLead = (lead: Lead) => {
    if (!lead.phone) {
      sonnerToast.error('This lead has no phone number');
      return;
    }
    setSelectedLead(lead);
    setShowCallDialog(true);
    fetchVapiData();
  };

  const initiateOutboundCall = async () => {
    if (!selectedLead || !selectedAssistantId) {
      sonnerToast.error('Please select an assistant');
      return;
    }

    if (!selectedLead.phone) {
      sonnerToast.error('Lead has no phone number');
      return;
    }

    setIsCalling(true);
    try {
      const { data, error } = await supabase.functions.invoke('vapi-outbound-call', {
        body: {
          assistantId: selectedAssistantId,
          phoneNumberId: selectedPhoneNumberId || undefined,
          customerNumber: selectedLead.phone,
          customerName: `${selectedLead.first_name} ${selectedLead.last_name}`,
          leadId: selectedLead.id,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      sonnerToast.success(`Call initiated to ${selectedLead.first_name} ${selectedLead.last_name}`);
      setShowCallDialog(false);

      // Update lead status to contacted
      await supabase
        .from('leads')
        .update({ status: 'contacted', last_contacted_at: new Date().toISOString() })
        .eq('id', selectedLead.id);

      fetchLeads();
    } catch (error) {
      console.error('Error initiating call:', error);
      sonnerToast.error(error instanceof Error ? error.message : 'Failed to initiate call');
    } finally {
      setIsCalling(false);
    }
  };

  const handleCreateLead = async () => {
    if (!workspaceId) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select a workspace first",
      });
      return;
    }
    
    try {
      const { data: user } = await supabase.auth.getUser();
      
      const { error } = await supabase.from("leads").insert([
        {
          ...newLead,
          created_by: user.user?.id,
          workspace_id: workspaceId,
        },
      ]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Lead created successfully",
      });

      setShowNewLeadDialog(false);
      setNewLead({
        first_name: "",
        last_name: "",
        email: "",
        phone: "",
        company: "",
        job_title: "",
        vertical: "",
        source: "manual",
        notes: "",
      });
      fetchLeads();
    } catch (error) {
      console.error("Error creating lead:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create lead",
      });
    }
  };

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim().replace(/^"|"$/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim().replace(/^"|"$/g, ''));
    return result;
  };

  const normalizeHeader = (header: string): string => {
    const h = header.toLowerCase().replace(/[^a-z0-9]/g, '');
    // Map common variations
    if (['firstname', 'first', 'fname', 'givenname'].includes(h)) return 'first_name';
    if (['lastname', 'last', 'lname', 'surname', 'familyname'].includes(h)) return 'last_name';
    if (['email', 'emailaddress', 'mail'].includes(h)) return 'email';
    if (['phone', 'phonenumber', 'tel', 'telephone', 'mobile', 'cell'].includes(h)) return 'phone';
    if (['company', 'companyname', 'organization', 'org', 'business'].includes(h)) return 'company';
    if (['jobtitle', 'title', 'position', 'role'].includes(h)) return 'job_title';
    if (['vertical', 'industry', 'sector'].includes(h)) return 'vertical';
    if (['name', 'fullname'].includes(h)) return 'full_name';
    return h;
  };

  const handleCSVImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(line => line.trim());
      
      if (lines.length < 2) {
        throw new Error("CSV file must have a header row and at least one data row");
      }

      const headers = parseCSVLine(lines[0]).map(h => normalizeHeader(h));
      console.log("Detected headers:", headers);

      const leadsToImport = [];
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const lead: any = { source: "csv_import" };

        headers.forEach((header, index) => {
          const value = values[index]?.trim();
          if (!value) return;
          
          if (header === 'first_name') lead.first_name = value;
          else if (header === 'last_name') lead.last_name = value;
          else if (header === 'email') lead.email = value;
          else if (header === 'phone') lead.phone = value;
          else if (header === 'company') lead.company = value;
          else if (header === 'job_title') lead.job_title = value;
          else if (header === 'vertical') lead.vertical = value;
          else if (header === 'full_name' && value) {
            // Split full name into first/last
            const parts = value.split(/\s+/);
            if (!lead.first_name) lead.first_name = parts[0] || '';
            if (!lead.last_name) lead.last_name = parts.slice(1).join(' ') || parts[0] || '';
          }
        });

        // Validate required fields
        if (lead.email) {
          // Provide defaults if first/last name missing
          if (!lead.first_name) lead.first_name = lead.email.split('@')[0] || 'Unknown';
          if (!lead.last_name) lead.last_name = 'Contact';
          leadsToImport.push(lead);
        }
      }

      console.log("Leads to import:", leadsToImport.length);

      if (leadsToImport.length === 0) {
        throw new Error("No valid leads found. Make sure your CSV has an 'email' column.");
      }

      const { data: user } = await supabase.auth.getUser();
      const leadsWithCreator = leadsToImport.map((lead) => ({
        ...lead,
        created_by: user.user?.id,
      }));

      const { error } = await supabase.from("leads").insert(leadsWithCreator);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Imported ${leadsToImport.length} leads`,
      });

      setShowImportDialog(false);
      fetchLeads();
    } catch (error) {
      console.error("Error importing leads:", error);
      toast({
        variant: "destructive",
        title: "Import Failed",
        description: error instanceof Error ? error.message : "Failed to import CSV file",
      });
    } finally {
      setImporting(false);
      // Reset file input
      event.target.value = '';
    }
  };

  const handleGoogleMapsScrape = async () => {
    if (!scraperParams.location || !scraperParams.businessType) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please provide location and business type",
      });
      return;
    }

    setScraping(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scrape-google-maps`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ ...scraperParams, workspaceId }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        const errorTitle = result.error || 'Failed to scrape Google Maps';
        const errorDetails = result.details || 'An unexpected error occurred.';
        
        toast({
          variant: "destructive",
          title: errorTitle,
          description: errorDetails,
          duration: 10000,
        });
        return;
      }

      toast({
        title: "Success",
        description: result.message || `Imported ${result.leadsImported} leads`,
      });

      setShowScraperDialog(false);
      setScraperParams({
        location: "",
        businessType: "hotel",
        radius: 5000,
        maxResults: 20,
      });
      fetchLeads();
    } catch (error) {
      console.error("Error scraping Google Maps:", error);
      
      let errorMessage = "Failed to scrape Google Maps";
      if (error instanceof Error) {
        errorMessage = error.message;
        
        if (error.message.includes('fetch') || error.message.includes('network')) {
          errorMessage = "Network error: Unable to reach Google Maps API. Please check your internet connection and try again.";
        }
      }
      
      toast({
        variant: "destructive",
        title: "Scraping Failed",
        description: errorMessage,
        duration: 8000,
      });
    } finally {
      setScraping(false);
    }
  };

  const downloadCSVTemplate = () => {
    const headers = ['first_name', 'last_name', 'email', 'phone', 'company', 'job_title', 'vertical'];
    const sampleRows = [
      ['John', 'Doe', 'john.doe@example.com', '555-123-4567', 'Acme Corp', 'Marketing Manager', 'Hotels & Resorts'],
      ['Jane', 'Smith', 'jane.smith@example.com', '555-987-6543', 'Widget Inc', 'Sales Director', 'Gyms'],
    ];
    
    const csvContent = [headers.join(','), ...sampleRows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'leads_template.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "new":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "contacted":
        return "bg-purple-500/10 text-purple-500 border-purple-500/20";
      case "qualified":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      case "converted":
        return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
      case "unqualified":
      case "lost":
        return "bg-gray-500/10 text-gray-500 border-gray-500/20";
      default:
        return "bg-gray-500/10 text-gray-500 border-gray-500/20";
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 75) return "text-green-500";
    if (score >= 50) return "text-yellow-500";
    return "text-red-500";
  };

  return (
    <ProtectedRoute>
      <div className="flex min-h-screen flex-col bg-background">
        <NavBar />
        <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-4xl font-bold text-foreground">CRM</h1>
                <p className="mt-2 text-muted-foreground">
                  Manage and track your leads
                </p>
              </div>
              <div className="flex items-center gap-3">
                <WorkspaceSelector onWorkspaceChange={setWorkspaceId} />
                <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
                  <DialogTrigger asChild>
                    <Button variant="outline">
                      <Upload className="mr-2 h-4 w-4" />
                      Import CSV
                    </Button>
                  </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Import Leads from CSV</DialogTitle>
                    <DialogDescription>
                      Upload a CSV file with lead data. Only email is required; names will be auto-generated if missing.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <Button variant="outline" size="sm" onClick={downloadCSVTemplate} className="w-full">
                      <Download className="mr-2 h-4 w-4" />
                      Download CSV Template
                    </Button>
                    <div className="text-xs text-muted-foreground">
                      Supported columns: first_name, last_name, email, phone, company, job_title, vertical
                    </div>
                    <div
                      className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                        isDragging 
                          ? 'border-primary bg-primary/5' 
                          : 'border-muted-foreground/25 hover:border-muted-foreground/50'
                      } ${importing ? 'opacity-50 pointer-events-none' : ''}`}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsDragging(true);
                      }}
                      onDragEnter={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsDragging(true);
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsDragging(false);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsDragging(false);
                        const file = e.dataTransfer.files?.[0];
                        if (file && file.name.endsWith('.csv')) {
                          const event = { target: { files: [file], value: '' } } as unknown as React.ChangeEvent<HTMLInputElement>;
                          handleCSVImport(event);
                        } else {
                          toast({
                            variant: "destructive",
                            title: "Invalid File",
                            description: "Please upload a CSV file",
                          });
                        }
                      }}
                    >
                      <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
                      <p className="text-sm font-medium">
                        {isDragging ? 'Drop CSV file here' : 'Drag & drop CSV file here'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">or click to browse</p>
                      <Input
                        type="file"
                        accept=".csv"
                        onChange={handleCSVImport}
                        disabled={importing}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                    </div>
                    {importing && (
                      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Importing leads...
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={showScraperDialog} onOpenChange={setShowScraperDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <Search className="mr-2 h-4 w-4" />
                    Scrape Google Maps
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Import Leads from Google Maps</DialogTitle>
                    <DialogDescription>
                      Search for businesses on Google Maps and import them as leads
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="location">Location *</Label>
                      <Input
                        id="location"
                        placeholder="e.g., Miami, FL or 90210"
                        value={scraperParams.location}
                        onChange={(e) =>
                          setScraperParams({ ...scraperParams, location: e.target.value })
                        }
                        disabled={scraping}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="businessType">Business Type *</Label>
                      <Select
                        value={scraperParams.businessType}
                        onValueChange={(value) =>
                          setScraperParams({ ...scraperParams, businessType: value })
                        }
                        disabled={scraping}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="hotel">Hotels & Resorts</SelectItem>
                          <SelectItem value="lodging">Lodging</SelectItem>
                          <SelectItem value="apartment_complex">Apartment Complex</SelectItem>
                          <SelectItem value="real_estate_agency">Real Estate Agency</SelectItem>
                          <SelectItem value="country_club">Country Club</SelectItem>
                          <SelectItem value="sports_club">Sports Club</SelectItem>
                          <SelectItem value="night_club">Night Club</SelectItem>
                          <SelectItem value="bar">Bar</SelectItem>
                          <SelectItem value="event_venue">Event Venue</SelectItem>
                          <SelectItem value="physiotherapist">Physiotherapist</SelectItem>
                          <SelectItem value="physical_therapy">Physical Therapy</SelectItem>
                          <SelectItem value="office_space_rental_agency">Office Space / Coworking</SelectItem>
                          <SelectItem value="school">School</SelectItem>
                          <SelectItem value="university">University</SelectItem>
                          <SelectItem value="college">College</SelectItem>
                          <SelectItem value="gym">Gym</SelectItem>
                          <SelectItem value="fitness_center">Fitness Center</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="radius">Search Radius (meters)</Label>
                        <Input
                          id="radius"
                          type="number"
                          value={scraperParams.radius}
                          onChange={(e) =>
                            setScraperParams({ ...scraperParams, radius: parseInt(e.target.value) })
                          }
                          disabled={scraping}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="maxResults">Max Results</Label>
                        <Input
                          id="maxResults"
                          type="number"
                          value={scraperParams.maxResults}
                          onChange={(e) =>
                            setScraperParams({ ...scraperParams, maxResults: parseInt(e.target.value) })
                          }
                          disabled={scraping}
                        />
                      </div>
                    </div>
                    <Button
                      onClick={handleGoogleMapsScrape}
                      disabled={scraping || !scraperParams.location || !scraperParams.businessType}
                      className="w-full"
                    >
                      {scraping ? "Scraping..." : "Start Scraping"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={showNewLeadDialog} onOpenChange={setShowNewLeadDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Plus className="mr-2 h-4 w-4" />
                    New Lead
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Create New Lead</DialogTitle>
                    <DialogDescription>
                      Add a new lead to your CRM
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="first_name">First Name *</Label>
                        <Input
                          id="first_name"
                          value={newLead.first_name}
                          onChange={(e) =>
                            setNewLead({ ...newLead, first_name: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="last_name">Last Name *</Label>
                        <Input
                          id="last_name"
                          value={newLead.last_name}
                          onChange={(e) =>
                            setNewLead({ ...newLead, last_name: e.target.value })
                          }
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="email">Email *</Label>
                        <Input
                          id="email"
                          type="email"
                          value={newLead.email}
                          onChange={(e) =>
                            setNewLead({ ...newLead, email: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone">Phone</Label>
                        <Input
                          id="phone"
                          value={newLead.phone}
                          onChange={(e) =>
                            setNewLead({ ...newLead, phone: e.target.value })
                          }
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="company">Company</Label>
                        <Input
                          id="company"
                          value={newLead.company}
                          onChange={(e) =>
                            setNewLead({ ...newLead, company: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="job_title">Job Title</Label>
                        <Input
                          id="job_title"
                          value={newLead.job_title}
                          onChange={(e) =>
                            setNewLead({ ...newLead, job_title: e.target.value })
                          }
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="vertical">Vertical</Label>
                      <Select
                        value={newLead.vertical}
                        onValueChange={(value) =>
                          setNewLead({ ...newLead, vertical: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select vertical" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="hotels">Hotels & Resorts</SelectItem>
                          <SelectItem value="multifamily">Multifamily Real Estate</SelectItem>
                          <SelectItem value="clubs">Pickleball Clubs & Country Clubs</SelectItem>
                          <SelectItem value="entertainment">Entertainment Venues</SelectItem>
                          <SelectItem value="therapy">Physical Therapy</SelectItem>
                          <SelectItem value="corporate">Corporate Offices & Co-Working</SelectItem>
                          <SelectItem value="education">Education</SelectItem>
                          <SelectItem value="gyms">Gyms</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="notes">Notes</Label>
                      <Textarea
                        id="notes"
                        value={newLead.notes}
                        onChange={(e) =>
                          setNewLead({ ...newLead, notes: e.target.value })
                        }
                        rows={3}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setShowNewLeadDialog(false)}
                    >
                      Cancel
                    </Button>
                    <Button onClick={handleCreateLead}>Create Lead</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Empty State / Quick Start */}
            {leads.length === 0 && !loading && (
              <Card className="border-dashed mt-6">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Search className="h-16 w-16 text-muted-foreground mb-4" />
                  <h3 className="text-xl font-semibold mb-2">No leads yet</h3>
                  <p className="text-muted-foreground text-center mb-6 max-w-md">
                    Get started by scraping Google Maps to automatically import leads from businesses in your target verticals
                  </p>
                  <Button onClick={() => setShowScraperDialog(true)} size="lg">
                    <Search className="mr-2 h-5 w-5" />
                    Start Scraping Google Maps
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          {/* CRM Navigation Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-6">
            <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
              <TabsTrigger value="dashboard" className="gap-2">
                <BarChart3 className="h-4 w-4" />
                Dashboard
              </TabsTrigger>
              <TabsTrigger value="list" className="gap-2">
                <List className="h-4 w-4" />
                Leads
              </TabsTrigger>
              <TabsTrigger value="pipeline" className="gap-2">
                <LayoutGrid className="h-4 w-4" />
                Pipeline
              </TabsTrigger>
              <TabsTrigger value="deals" className="gap-2">
                <Building className="h-4 w-4" />
                Deals
              </TabsTrigger>
              <TabsTrigger value="tasks" className="gap-2">
                <Calendar className="h-4 w-4" />
                Tasks
              </TabsTrigger>
              <TabsTrigger value="sequences" className="gap-2">
                <Mail className="h-4 w-4" />
                Sequences
              </TabsTrigger>
              <TabsTrigger value="reports" className="gap-2">
                <BarChart3 className="h-4 w-4" />
                Reports
              </TabsTrigger>
            </TabsList>

            {/* Dashboard Tab */}
            <TabsContent value="dashboard">
              <CRMDashboard 
                leads={leads} 
                showSampleData={showSampleData}
                onToggleSampleData={setShowSampleData}
              />
            </TabsContent>

            {/* List Tab */}
            <TabsContent value="list" className="space-y-6">
              {/* Filters */}
              {leads.length > 0 && (
              <Card className="border-border bg-card">
                <CardContent className="pt-6">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Search leads..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    <div className="flex gap-3">
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[180px]">
                          <Filter className="mr-2 h-4 w-4" />
                          <SelectValue placeholder="Filter by status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Statuses</SelectItem>
                          <SelectItem value="new">New</SelectItem>
                          <SelectItem value="contacted">Contacted</SelectItem>
                          <SelectItem value="qualified">Qualified</SelectItem>
                          <SelectItem value="unqualified">Unqualified</SelectItem>
                          <SelectItem value="converted">Converted</SelectItem>
                          <SelectItem value="lost">Lost</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
              )}

              {/* Leads Table */}
              {leads.length > 0 && (
          <Card className="border-border bg-card shadow-md">
            <CardHeader>
              <CardTitle className="text-foreground">Leads</CardTitle>
              <CardDescription>
                {filteredLeads.length} lead{filteredLeads.length !== 1 ? "s" : ""} found
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-12">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
                </div>
              ) : filteredLeads.length === 0 ? (
                <div className="py-16 text-center">
                  <User className="mx-auto h-12 w-12 text-muted-foreground" />
                  <p className="mt-4 text-sm text-muted-foreground">
                    No leads found
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="pb-3 text-left text-sm font-medium text-muted-foreground">
                          Name
                        </th>
                        <th className="pb-3 text-left text-sm font-medium text-muted-foreground">
                          Contact
                        </th>
                        <th className="pb-3 text-left text-sm font-medium text-muted-foreground">
                          Company
                        </th>
                        <th className="pb-3 text-left text-sm font-medium text-muted-foreground">
                          Vertical
                        </th>
                        <th className="pb-3 text-center text-sm font-medium text-muted-foreground">
                          Score
                        </th>
                        <th className="pb-3 text-left text-sm font-medium text-muted-foreground">
                          Status
                        </th>
                        <th className="pb-3 text-left text-sm font-medium text-muted-foreground">
                          Source
                        </th>
                        <th className="pb-3 text-center text-sm font-medium text-muted-foreground">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLeads.map((lead) => (
                        <tr
                          key={lead.id}
                          className="border-b border-border transition-colors hover:bg-muted/50 cursor-pointer"
                          onClick={() => navigate(`/crm/${lead.id}`)}
                        >
                          <td className="py-4">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm font-medium text-foreground">
                                {lead.first_name} {lead.last_name}
                              </span>
                            </div>
                          </td>
                          <td className="py-4">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Mail className="h-3 w-3" />
                                {lead.email}
                              </div>
                              {lead.phone && (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <Phone className="h-3 w-3" />
                                  {lead.phone}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="py-4">
                            {lead.company && (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Building className="h-3 w-3" />
                                {lead.company}
                              </div>
                            )}
                          </td>
                          <td className="py-4 text-sm text-muted-foreground capitalize">
                            {lead.vertical || "-"}
                          </td>
                          <td className="py-4 text-center">
                            <span
                              className={`text-sm font-bold ${getScoreColor(
                                lead.score
                              )}`}
                            >
                              {lead.score}
                            </span>
                          </td>
                          <td className="py-4">
                            <Badge
                              variant="outline"
                              className={getStatusColor(lead.status)}
                            >
                              {lead.status}
                            </Badge>
                          </td>
                          <td className="py-4 text-sm text-muted-foreground capitalize">
                            {lead.source.replace("_", " ")}
                          </td>
                          <td className="py-4">
                            <div className="flex justify-center gap-2" onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleCallLead(lead)}
                                disabled={!lead.phone}
                                className="gap-1"
                              >
                                <PhoneCall className="h-4 w-4" />
                                Call
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
          )}
            </TabsContent>

            {/* Pipeline Tab */}
            <TabsContent value="pipeline">
              {leads.length > 0 && workspaceId ? (
                <LeadPipeline
                  leads={filteredLeads}
                  workspaceId={workspaceId}
                  onLeadClick={(lead) => navigate(`/crm/${lead.id}`)}
                  onLeadUpdate={fetchLeads}
                />
              ) : (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <LayoutGrid className="h-16 w-16 text-muted-foreground mb-4" />
                    <h3 className="text-xl font-semibold mb-2">No leads in pipeline</h3>
                    <p className="text-muted-foreground text-center mb-6 max-w-md">
                      Import leads to see them in the pipeline view
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Deals Tab */}
            <TabsContent value="deals">
              {workspaceId ? (
                <DealsPipeline workspaceId={workspaceId} />
              ) : (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <Building2 className="h-16 w-16 text-muted-foreground/50 mb-4" />
                  <h2 className="text-xl font-semibold mb-2">No Workspace Selected</h2>
                  <p className="text-muted-foreground">Select a workspace to manage deals.</p>
                </div>
              )}
            </TabsContent>

            {/* Tasks Tab */}
            <TabsContent value="tasks">
              {workspaceId ? (
                <TaskManager workspaceId={workspaceId} />
              ) : (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <Building2 className="h-16 w-16 text-muted-foreground/50 mb-4" />
                  <h2 className="text-xl font-semibold mb-2">No Workspace Selected</h2>
                  <p className="text-muted-foreground">Select a workspace to manage tasks.</p>
                </div>
              )}
            </TabsContent>

            {/* Sequences Tab */}
            <TabsContent value="sequences">
              {workspaceId ? (
                <EmailSequences workspaceId={workspaceId} />
              ) : (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <Building2 className="h-16 w-16 text-muted-foreground/50 mb-4" />
                  <h2 className="text-xl font-semibold mb-2">No Workspace Selected</h2>
                  <p className="text-muted-foreground">Select a workspace to manage email sequences.</p>
                </div>
              )}
            </TabsContent>

            {/* Reports Tab */}
            <TabsContent value="reports">
              <CRMReports />
            </TabsContent>
          </Tabs>

          {/* Outbound Call Dialog */}
          <Dialog open={showCallDialog} onOpenChange={setShowCallDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Call Lead</DialogTitle>
                <DialogDescription>
                  {selectedLead && (
                    <>Initiate an outbound call to <strong>{selectedLead.first_name} {selectedLead.last_name}</strong> at <strong>{selectedLead.phone}</strong></>
                  )}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {isLoadingVapi ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label>Voice Agent *</Label>
                      <Select value={selectedAssistantId} onValueChange={setSelectedAssistantId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select an assistant" />
                        </SelectTrigger>
                        <SelectContent>
                          {vapiAssistants.map((assistant) => (
                            <SelectItem key={assistant.id} value={assistant.id}>
                              {assistant.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {vapiAssistants.length === 0 && (
                        <p className="text-xs text-muted-foreground">
                          No assistants found. Create one in your Vapi dashboard.
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>Outbound Phone Number</Label>
                      <Select value={selectedPhoneNumberId} onValueChange={setSelectedPhoneNumberId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a phone number (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">No phone number</SelectItem>
                          {vapiPhoneNumbers.map((phone) => (
                            <SelectItem key={phone.id} value={phone.id}>
                              {phone.name} ({phone.number})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        The number that will appear on caller ID. Required for actual phone calls.
                      </p>
                    </div>
                  </>
                )}
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setShowCallDialog(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={initiateOutboundCall} 
                  disabled={isCalling || !selectedAssistantId || isLoadingVapi}
                  className="gap-2"
                >
                  {isCalling ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <PhoneCall className="h-4 w-4" />
                  )}
                  {isCalling ? 'Calling...' : 'Start Call'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </main>
        <Footer />
      </div>
    </ProtectedRoute>
  );
};

export default CRM;
