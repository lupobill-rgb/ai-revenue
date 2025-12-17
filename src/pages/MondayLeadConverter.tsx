import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import NavBar from "@/components/NavBar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, FileSpreadsheet, Download, Database, CheckCircle2, XCircle, AlertCircle, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface ParsedLead {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  company: string;
  job_title: string;
  source: string;
  status: string;
  notes: string;
  isValid: boolean;
  validationError?: string;
}

const STATUS_MAP: Record<string, string> = {
  "new": "new",
  "in progress": "contacted",
  "working": "contacted",
  "contacted": "contacted",
  "qualified": "qualified",
  "won": "converted",
  "closed won": "converted",
  "converted": "converted",
  "lost": "lost",
  "closed lost": "lost",
};

const normalizeStatus = (status: string): string => {
  const normalized = status?.toLowerCase().trim() || "";
  return STATUS_MAP[normalized] || "new";
};

const extractPhoneNumber = (text: string): string => {
  if (!text) return "";
  const phoneRegex = /[\+]?[(]?[0-9]{1,3}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,4}[-\s\.]?[0-9]{1,9}/g;
  const matches = text.match(phoneRegex);
  return matches ? matches[0].replace(/[^\d+]/g, "") : "";
};

const splitFullName = (fullName: string): { firstName: string; lastName: string } => {
  if (!fullName) return { firstName: "", lastName: "" };
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
};

const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const MondayLeadConverter = () => {
  const [leads, setLeads] = useState<ParsedLead[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [fileName, setFileName] = useState<string>("");
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();

  const parseExcelFile = useCallback((file: File) => {
    setIsLoading(true);
    setFileName(file.name);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

        const seenEmails = new Set<string>();
        const parsedLeads: ParsedLead[] = [];

        jsonData.forEach((row: any) => {
          // Try to find email field
          const emailField = row.email || row.Email || row.EMAIL || row["E-mail"] || row["e-mail"] || "";
          const email = emailField.toString().toLowerCase().trim();

          // Skip duplicates
          if (seenEmails.has(email)) return;
          if (email) seenEmails.add(email);

          // Handle name - could be split or combined
          let firstName = row.first_name || row.firstName || row["First Name"] || row["first name"] || "";
          let lastName = row.last_name || row.lastName || row["Last Name"] || row["last name"] || "";
          
          if (!firstName && !lastName) {
            const fullName = row.name || row.Name || row["Full Name"] || row["full name"] || "";
            const split = splitFullName(fullName);
            firstName = split.firstName;
            lastName = split.lastName;
          }

          // Extract phone from various fields
          const phoneField = row.phone || row.Phone || row.PHONE || row["Phone Number"] || row.mobile || row.Mobile || "";
          const notesField = row.notes || row.Notes || row.description || row.Description || "";
          const phone = extractPhoneNumber(phoneField.toString()) || extractPhoneNumber(notesField.toString());

          // Get other fields
          const company = row.company || row.Company || row.organization || row.Organization || "";
          const jobTitle = row.job_title || row.jobTitle || row["Job Title"] || row.title || row.Title || row.position || row.Position || "";
          const source = row.source || row.Source || row.lead_source || row["Lead Source"] || "Monday.com Import";
          const status = row.status || row.Status || row.stage || row.Stage || "new";
          const notes = notesField;

          // Validate
          const isValid = isValidEmail(email) && firstName.trim().length > 0;
          let validationError: string | undefined;
          if (!isValid) {
            if (!firstName.trim()) validationError = "Missing first name";
            else if (!isValidEmail(email)) validationError = "Invalid email";
          }

          parsedLeads.push({
            first_name: firstName.toString().trim(),
            last_name: lastName.toString().trim(),
            email,
            phone,
            company: company.toString().trim(),
            job_title: jobTitle.toString().trim(),
            source: source.toString().trim(),
            status: normalizeStatus(status.toString()),
            notes: notes.toString().trim(),
            isValid,
            validationError,
          });
        });

        setLeads(parsedLeads);
        toast({
          title: "File parsed successfully",
          description: `Found ${parsedLeads.length} leads (${parsedLeads.filter(l => l.isValid).length} valid)`,
        });
      } catch (error) {
        console.error("Parse error:", error);
        toast({
          title: "Error parsing file",
          description: "Please ensure the file is a valid Excel file",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  }, [toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith(".xlsx") || file.name.endsWith(".xls"))) {
      parseExcelFile(file);
    } else {
      toast({
        title: "Invalid file type",
        description: "Please upload an Excel file (.xlsx or .xls)",
        variant: "destructive",
      });
    }
  }, [parseExcelFile, toast]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      parseExcelFile(file);
    }
  }, [parseExcelFile]);

  const downloadCSV = useCallback(() => {
    const validLeads = leads.filter(l => l.isValid);
    const headers = ["first_name", "last_name", "email", "phone", "company", "job_title", "source", "status", "notes"];
    const csvContent = [
      headers.join(","),
      ...validLeads.map(lead => 
        headers.map(h => `"${(lead[h as keyof ParsedLead] || "").toString().replace(/"/g, '""')}"`).join(",")
      )
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `monday-leads-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "CSV downloaded",
      description: `Exported ${validLeads.length} valid leads`,
    });
  }, [leads, toast]);

  const deployToCRM = useCallback(async () => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please log in to deploy leads",
        variant: "destructive",
      });
      return;
    }

    const validLeads = leads.filter(l => l.isValid);
    if (validLeads.length === 0) {
      toast({
        title: "No valid leads",
        description: "Please upload a file with valid leads",
        variant: "destructive",
      });
      return;
    }

    setIsDeploying(true);
    try {
      // Get user's workspace
      const { data: workspaceMember } = await supabase
        .from("workspace_members")
        .select("workspace_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (!workspaceMember?.workspace_id) {
        throw new Error("No workspace found");
      }

      const workspaceId = workspaceMember.workspace_id;

      // Check for existing emails to avoid duplicates
      const emails = validLeads.map(l => l.email);
      const { data: existingLeads } = await supabase
        .from("leads")
        .select("email")
        .eq("workspace_id", workspaceId)
        .in("email", emails);

      const existingEmails = new Set(existingLeads?.map(l => l.email) || []);
      const newLeads = validLeads.filter(l => !existingEmails.has(l.email));

      if (newLeads.length === 0) {
        toast({
          title: "No new leads",
          description: "All leads already exist in your CRM",
        });
        setIsDeploying(false);
        return;
      }

      // Insert leads
      const leadsToInsert = newLeads.map(lead => ({
        first_name: lead.first_name,
        last_name: lead.last_name,
        email: lead.email,
        phone: lead.phone || null,
        company: lead.company || null,
        job_title: lead.job_title || null,
        source: lead.source || "Monday.com Import",
        status: lead.status,
        notes: lead.notes || null,
        workspace_id: workspaceId,
        created_by: user.id,
        score: 50, // Default score
      }));

      const { error } = await supabase.from("leads").insert(leadsToInsert);

      if (error) throw error;

      toast({
        title: "Leads deployed successfully",
        description: `Added ${newLeads.length} leads to CRM${existingEmails.size > 0 ? ` (${existingEmails.size} duplicates skipped)` : ""}`,
      });

      navigate("/crm");
    } catch (error: any) {
      console.error("Deploy error:", error);
      toast({
        title: "Error deploying leads",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsDeploying(false);
    }
  }, [leads, user, toast, navigate]);

  const validCount = leads.filter(l => l.isValid).length;
  const invalidCount = leads.length - validCount;

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate("/crm")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Monday.com Lead Converter</h1>
            <p className="text-muted-foreground">Import and convert Monday.com leads to your CRM</p>
          </div>
        </div>

        {/* Upload Area */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Upload Excel File
            </CardTitle>
            <CardDescription>
              Drag and drop or click to upload your Monday.com export (.xlsx, .xls)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
              }`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium text-foreground">
                  {isLoading ? "Processing..." : "Drop your Excel file here"}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  or click to browse
                </p>
                {fileName && (
                  <Badge variant="secondary" className="mt-4">
                    {fileName}
                  </Badge>
                )}
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {leads.length > 0 && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-primary/10">
                      <FileSpreadsheet className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{leads.length}</p>
                      <p className="text-sm text-muted-foreground">Total Leads</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-green-500/10">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{validCount}</p>
                      <p className="text-sm text-muted-foreground">Valid Leads</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-destructive/10">
                      <XCircle className="h-5 w-5 text-destructive" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{invalidCount}</p>
                      <p className="text-sm text-muted-foreground">Invalid Leads</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Actions */}
            <div className="flex gap-4 mb-6">
              <Button onClick={downloadCSV} variant="outline" disabled={validCount === 0}>
                <Download className="h-4 w-4 mr-2" />
                Download CSV ({validCount})
              </Button>
              <Button onClick={deployToCRM} disabled={validCount === 0 || isDeploying}>
                <Database className="h-4 w-4 mr-2" />
                {isDeploying ? "Deploying..." : `Deploy to CRM (${validCount})`}
              </Button>
            </div>

            {/* Preview Table */}
            <Card>
              <CardHeader>
                <CardTitle>Lead Preview</CardTitle>
                <CardDescription>Review parsed leads before importing</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">Status</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Job Title</TableHead>
                        <TableHead>CRM Status</TableHead>
                        <TableHead>Source</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leads.map((lead, index) => (
                        <TableRow key={index} className={!lead.isValid ? "bg-destructive/5" : ""}>
                          <TableCell>
                            {lead.isValid ? (
                              <CheckCircle2 className="h-5 w-5 text-green-500" />
                            ) : (
                              <div className="flex items-center gap-1">
                                <AlertCircle className="h-5 w-5 text-destructive" />
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="font-medium">
                            {lead.first_name} {lead.last_name}
                            {lead.validationError && (
                              <p className="text-xs text-destructive">{lead.validationError}</p>
                            )}
                          </TableCell>
                          <TableCell className={isValidEmail(lead.email) ? "text-green-600" : "text-destructive"}>
                            {lead.email || "-"}
                          </TableCell>
                          <TableCell>{lead.phone || "-"}</TableCell>
                          <TableCell>{lead.company || "-"}</TableCell>
                          <TableCell>{lead.job_title || "-"}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">
                              {lead.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{lead.source}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
};

export default MondayLeadConverter;
