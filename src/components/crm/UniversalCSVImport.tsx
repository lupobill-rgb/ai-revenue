import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Loader2, 
  Download, 
  Sparkles,
  Users,
  Building2,
  Briefcase,
  ArrowRight,
  Eye,
  Settings2,
  RefreshCw
} from "lucide-react";
import { useTenantSegments } from "@/hooks/useTenantSegments";

type ImportStep = "upload" | "analyzing" | "preview" | "importing" | "complete";

type EntityType = "contacts" | "companies" | "deals" | "activities" | "mixed";

interface ColumnMapping {
  csvColumn: string;
  targetField: string | null;
  sampleValue: string;
}

interface ImportStats {
  created: number;
  updated: number;
  skipped: number;
  errors: number;
}

interface FailedRow {
  row: number;
  data: Record<string, string>;
  reason: string;
}

interface UniversalCSVImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string | null;
  onImportComplete?: () => void;
}

const ENTITY_ICONS = {
  contacts: Users,
  companies: Building2,
  deals: Briefcase,
  activities: RefreshCw,
  mixed: FileSpreadsheet,
};

const AVAILABLE_TAGS = [
  { name: "Hot Lead", color: "bg-red-500/10 text-red-500 border-red-500/20" },
  { name: "Decision Maker", color: "bg-purple-500/10 text-purple-500 border-purple-500/20" },
  { name: "Budget Approved", color: "bg-green-500/10 text-green-500 border-green-500/20" },
  { name: "Needs Demo", color: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
  { name: "Referral", color: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
  { name: "Enterprise", color: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20" },
  { name: "SMB", color: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20" },
  { name: "Follow Up", color: "bg-orange-500/10 text-orange-500 border-orange-500/20" },
  { name: "Priority", color: "bg-pink-500/10 text-pink-500 border-pink-500/20" },
  { name: "Competitor", color: "bg-slate-500/10 text-slate-500 border-slate-500/20" },
];

export function UniversalCSVImport({ 
  open, 
  onOpenChange, 
  workspaceId,
  onImportComplete 
}: UniversalCSVImportProps) {
  const { segments } = useTenantSegments();
  const [step, setStep] = useState<ImportStep>("upload");
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  
  // Analysis results
  const [entityType, setEntityType] = useState<EntityType>("contacts");
  const [confidence, setConfidence] = useState(0);
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
  const [previewData, setPreviewData] = useState<Record<string, string>[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  
  // Import options
  const [advancedMode, setAdvancedMode] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState<string>("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  
  // Import results
  const [importStats, setImportStats] = useState<ImportStats>({ created: 0, updated: 0, skipped: 0, errors: 0 });
  const [failedRows, setFailedRows] = useState<FailedRow[]>([]);
  const [progress, setProgress] = useState(0);

  const resetState = useCallback(() => {
    setStep("upload");
    setFile(null);
    setEntityType("contacts");
    setConfidence(0);
    setColumnMappings([]);
    setPreviewData([]);
    setTotalRows(0);
    setAdvancedMode(false);
    setSelectedSegment("");
    setSelectedTags([]);
    setImportStats({ created: 0, updated: 0, skipped: 0, errors: 0 });
    setFailedRows([]);
    setProgress(0);
  }, []);

  const toggleTag = (tagName: string) => {
    setSelectedTags(prev => 
      prev.includes(tagName) 
        ? prev.filter(t => t !== tagName)
        : [...prev, tagName]
    );
  };

  const handleClose = useCallback(() => {
    resetState();
    onOpenChange(false);
  }, [resetState, onOpenChange]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.name.endsWith('.csv') || droppedFile.type === 'text/csv')) {
      processFile(droppedFile);
    } else {
      toast.error("Please upload a CSV file");
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  }, []);

  const processFile = async (uploadedFile: File) => {
    setFile(uploadedFile);
    setStep("analyzing");

    try {
      const csvContent = await uploadedFile.text();
      
      // Call AI CSV mapper
      const { data, error } = await supabase.functions.invoke('ai-csv-mapper', {
        body: { csvContent, sampleRows: 5 }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Process analysis results
      setConfidence(Math.round((data.confidence || 0.8) * 100));
      setTotalRows(data.totalRows || 0);
      
      // Detect entity type based on mapping
      const mapping = data.mapping || {};
      const hasEmail = Object.values(mapping).includes('email');
      const hasCompanyDomain = Object.values(mapping).some((v: any) => 
        v === 'domain' || v === 'company_domain' || v === 'website'
      );
      const hasDealValue = Object.values(mapping).some((v: any) => 
        v === 'deal_value' || v === 'amount' || v === 'value'
      );
      
      if (hasDealValue) {
        setEntityType("deals");
      } else if (hasCompanyDomain && !hasEmail) {
        setEntityType("companies");
      } else {
        setEntityType("contacts");
      }

      // Build column mappings with sample values
      const lines = csvContent.split(/\r?\n/).filter(l => l.trim());
      const headers = parseCSVLine(lines[0]);
      const firstDataRow = lines[1] ? parseCSVLine(lines[1]) : [];
      
      const mappings: ColumnMapping[] = headers.map((header, i) => ({
        csvColumn: header,
        targetField: mapping[header] || null,
        sampleValue: firstDataRow[i] || ""
      }));
      setColumnMappings(mappings);

      // Preview data (first 20 rows)
      const preview = data.leads?.slice(0, 20) || [];
      setPreviewData(preview);

      setStep("preview");
    } catch (err) {
      console.error("Analysis error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to analyze CSV");
      setStep("upload");
    }
  };

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        result.push(current.trim().replace(/^"|"$/g, ""));
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim().replace(/^"|"$/g, ""));
    return result;
  };

  const handleImport = async () => {
    if (!workspaceId) {
      toast.error("Please select a workspace first");
      return;
    }

    setStep("importing");
    setProgress(0);

    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");

      // Re-process CSV for full import
      const csvContent = await file!.text();
      const { data, error } = await supabase.functions.invoke('ai-csv-mapper', {
        body: { csvContent }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const leads = data.leads || [];
      const batchSize = 50;
      const stats: ImportStats = { created: 0, updated: 0, skipped: 0, errors: 0 };
      const failed: FailedRow[] = [];

      for (let i = 0; i < leads.length; i += batchSize) {
        const batch = leads.slice(i, i + batchSize);
        
        // Check for existing leads by email (deduplication)
        const emails = batch.map((l: any) => l.email).filter(Boolean);
        const { data: existing } = await supabase
          .from("leads")
          .select("id, email")
          .eq("workspace_id", workspaceId)
          .in("email", emails);

        const existingEmails = new Set((existing || []).map(e => e.email.toLowerCase()));
        const existingMap = Object.fromEntries((existing || []).map(e => [e.email.toLowerCase(), e.id]));

        const toInsert: any[] = [];
        const toUpdate: any[] = [];

        for (const lead of batch) {
          if (!lead.email) {
            stats.skipped++;
            failed.push({
              row: i + batch.indexOf(lead) + 2,
              data: lead,
              reason: "Missing email address"
            });
            continue;
          }

          const emailLower = lead.email.toLowerCase();
          const leadData = {
            first_name: lead.first_name || "Unknown",
            last_name: lead.last_name || "Contact",
            email: lead.email,
            phone: lead.phone || null,
            company: lead.company || null,
            job_title: lead.job_title || null,
            vertical: lead.vertical || null,
            notes: lead.notes || null,
            source: "csv_import",
            segment_code: selectedSegment || null,
            tags: selectedTags.length > 0 ? selectedTags : null,
            workspace_id: workspaceId,
            created_by: user.user.id,
            // Store unmapped fields as custom_fields
            custom_fields: lead.custom_fields || null,
          };

          if (existingEmails.has(emailLower)) {
            toUpdate.push({ id: existingMap[emailLower], ...leadData });
          } else {
            toInsert.push(leadData);
          }
        }

        // Insert new leads
        if (toInsert.length > 0) {
          const { error: insertErr } = await supabase.from("leads").insert(toInsert);
          if (insertErr) {
            console.error("Insert error:", insertErr);
            stats.errors += toInsert.length;
          } else {
            stats.created += toInsert.length;
          }
        }

        // Update existing leads
        for (const lead of toUpdate) {
          const { id, ...updateData } = lead;
          const { error: updateErr } = await supabase
            .from("leads")
            .update(updateData)
            .eq("id", id);
          if (updateErr) {
            stats.errors++;
          } else {
            stats.updated++;
          }
        }

        setProgress(Math.round(((i + batchSize) / leads.length) * 100));
      }

      setImportStats(stats);
      setFailedRows(failed.slice(0, 50)); // Keep first 50 failures
      setStep("complete");
      
      if (stats.created > 0 || stats.updated > 0) {
        onImportComplete?.();
      }
    } catch (err) {
      console.error("Import error:", err);
      toast.error(err instanceof Error ? err.message : "Import failed");
      setStep("preview");
    }
  };

  const downloadFailedRows = () => {
    if (failedRows.length === 0) return;
    
    const headers = Object.keys(failedRows[0].data);
    const csvContent = [
      [...headers, "Error Reason"].join(","),
      ...failedRows.map(row => 
        [...headers.map(h => `"${(row.data[h] || "").replace(/"/g, '""')}"`), `"${row.reason}"`].join(",")
      )
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "failed_imports.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const EntityIcon = ENTITY_ICONS[entityType];

  // No workspace selected
  if (!workspaceId) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Universal CSV Import
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg">No Workspace Selected</h3>
            <p className="text-muted-foreground text-sm mt-2">
              Please select or create a workspace to import data.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Universal CSV Import
          </DialogTitle>
          <DialogDescription>
            {step === "upload" && "Drop any CSV file — AI will handle the rest"}
            {step === "analyzing" && "AI is analyzing your data..."}
            {step === "preview" && "Review what will be imported"}
            {step === "importing" && "Importing your data..."}
            {step === "complete" && "Import complete!"}
          </DialogDescription>
        </DialogHeader>

        {/* Step: Upload */}
        {step === "upload" && (
          <div className="flex-1 flex flex-col gap-4">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`
                flex-1 min-h-[200px] border-2 border-dashed rounded-lg
                flex flex-col items-center justify-center gap-4 p-8 transition-colors
                ${isDragging 
                  ? "border-primary bg-primary/5" 
                  : "border-muted-foreground/25 hover:border-primary/50"
                }
              `}
            >
              <Upload className={`h-12 w-12 ${isDragging ? "text-primary" : "text-muted-foreground"}`} />
              <div className="text-center">
                <p className="font-medium">Drop your CSV file here</p>
                <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
              </div>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileSelect}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Supports CSV from Excel, HubSpot, Salesforce, and more</span>
              <Button variant="ghost" size="sm" onClick={() => {
                const csv = `Name,Email,Phone,Company,Title
John Doe,john@example.com,+1-555-0100,Acme Inc,CEO
Jane Smith,jane@example.com,+1-555-0101,Tech Corp,CTO`;
                const blob = new Blob([csv], { type: "text/csv" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "sample_import.csv";
                a.click();
                URL.revokeObjectURL(url);
              }}>
                <Download className="h-4 w-4 mr-1" />
                Sample CSV
              </Button>
            </div>
          </div>
        )}

        {/* Step: Analyzing */}
        {step === "analyzing" && (
          <div className="flex-1 flex flex-col items-center justify-center py-12 gap-4">
            <div className="relative">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <Sparkles className="h-5 w-5 text-primary absolute -top-1 -right-1" />
            </div>
            <div className="text-center">
              <p className="font-medium">AI is analyzing your CSV</p>
              <p className="text-sm text-muted-foreground mt-1">
                Detecting columns, mapping fields, and preparing preview...
              </p>
            </div>
          </div>
        )}

        {/* Step: Preview */}
        {step === "preview" && (
          <div className="flex-1 flex flex-col gap-4 overflow-hidden">
            {/* Detection summary */}
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <EntityIcon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium capitalize">{entityType} detected</span>
                    <Badge variant={confidence >= 80 ? "default" : "secondary"}>
                      {confidence}% confidence
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {totalRows} rows found · {columnMappings.filter(m => m.targetField).length} fields mapped
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch 
                  id="advanced" 
                  checked={advancedMode} 
                  onCheckedChange={setAdvancedMode}
                />
                <Label htmlFor="advanced" className="text-sm cursor-pointer">
                  <Settings2 className="h-4 w-4 inline mr-1" />
                  Advanced
                </Label>
              </div>
            </div>

            {/* Advanced mapping (optional) */}
            {advancedMode && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Column Mapping
                </h4>
                <ScrollArea className="h-[150px] border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>CSV Column</TableHead>
                        <TableHead>Sample</TableHead>
                        <TableHead>Maps To</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {columnMappings.map((mapping, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-sm">{mapping.csvColumn}</TableCell>
                          <TableCell className="text-muted-foreground text-sm max-w-[150px] truncate">
                            {mapping.sampleValue || "—"}
                          </TableCell>
                          <TableCell>
                            {mapping.targetField ? (
                              <Badge variant="outline">{mapping.targetField}</Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">custom_field</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            )}

            {/* Segment selection */}
            <div className="flex items-center gap-3">
              <Label className="whitespace-nowrap">Assign to segment:</Label>
              <Select value={selectedSegment} onValueChange={(v) => setSelectedSegment(v === "__clear__" ? "" : v)}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="None (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__clear__">None</SelectItem>
                  {segments.map((seg) => (
                    <SelectItem key={seg.code} value={seg.code}>
                      {seg.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tag selection */}
            <div className="space-y-2">
              <Label>Apply tags to all imported leads:</Label>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_TAGS.map(tag => (
                  <Badge
                    key={tag.name}
                    variant="outline"
                    className={`cursor-pointer transition-all ${
                      selectedTags.includes(tag.name) 
                        ? tag.color + " ring-2 ring-offset-1 ring-primary" 
                        : "opacity-60 hover:opacity-100"
                    }`}
                    onClick={() => toggleTag(tag.name)}
                  >
                    <Checkbox 
                      checked={selectedTags.includes(tag.name)} 
                      className="mr-1.5 h-3 w-3"
                      onCheckedChange={() => toggleTag(tag.name)}
                    />
                    {tag.name}
                  </Badge>
                ))}
              </div>
              {selectedTags.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {selectedTags.length} tag{selectedTags.length > 1 ? 's' : ''} will be applied to all imported leads
                </p>
              )}
            </div>

            {/* Preview table */}
            <div className="flex-1 overflow-hidden">
              <h4 className="text-sm font-medium mb-2">Preview (first 20 rows)</h4>
              <ScrollArea className="h-[200px] border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Phone</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData.map((row, i) => (
                      <TableRow key={i}>
                        <TableCell>{row.first_name} {row.last_name}</TableCell>
                        <TableCell className="font-mono text-sm">{row.email}</TableCell>
                        <TableCell>{row.company || "—"}</TableCell>
                        <TableCell>{row.phone || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>

            {/* Actions */}
            <div className="flex justify-between items-center pt-2">
              <Button variant="ghost" onClick={resetState}>
                Start Over
              </Button>
              <Button onClick={handleImport}>
                Import {totalRows} Records
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Step: Importing */}
        {step === "importing" && (
          <div className="flex-1 flex flex-col items-center justify-center py-12 gap-6">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <div className="text-center w-full max-w-sm">
              <p className="font-medium mb-4">Importing your data...</p>
              <Progress value={progress} className="h-2" />
              <p className="text-sm text-muted-foreground mt-2">{progress}% complete</p>
            </div>
          </div>
        )}

        {/* Step: Complete */}
        {step === "complete" && (
          <div className="flex-1 flex flex-col gap-6 py-4">
            <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
              <div>
                <p className="font-semibold text-green-700 dark:text-green-400">Import Complete!</p>
                <p className="text-sm text-muted-foreground">Your data has been imported successfully.</p>
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{importStats.created}</div>
                <div className="text-sm text-muted-foreground">Created</div>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{importStats.updated}</div>
                <div className="text-sm text-muted-foreground">Updated</div>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">{importStats.skipped}</div>
                <div className="text-sm text-muted-foreground">Skipped</div>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{importStats.errors}</div>
                <div className="text-sm text-muted-foreground">Errors</div>
              </div>
            </div>

            {/* Failed rows */}
            {failedRows.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <AlertCircle className="h-4 w-4" />
                    {failedRows.length} rows could not be imported
                  </p>
                  <Button variant="outline" size="sm" onClick={downloadFailedRows}>
                    <Download className="h-4 w-4 mr-1" />
                    Download Failed Rows
                  </Button>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-4">
              <Button onClick={handleClose}>
                Done
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
