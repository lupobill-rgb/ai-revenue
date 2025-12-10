import { useState } from "react";
import { useLeads, useLeadDetails } from "@/hooks/useLeads";
import type { LeadRow, LeadDetailsResponse, LeadStatus } from "@/lib/cmo/types";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, User, Building2, Mail, Phone, Target, Calendar, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

function LeadsPage() {
  const { leads, loading } = useLeads();
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { details, loading: detailsLoading, changeStatus } =
    useLeadDetails(selectedLeadId);

  const filteredLeads = leads.filter((lead) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      lead.contact.firstName?.toLowerCase().includes(query) ||
      lead.contact.lastName?.toLowerCase().includes(query) ||
      lead.contact.email?.toLowerCase().includes(query) ||
      lead.contact.companyName?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <header className="flex items-center justify-between border-b border-border bg-card px-6 py-4">
        <h1 className="text-2xl font-semibold text-foreground">Leads</h1>
        <div className="relative w-80">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search name, email, company…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <section className="flex-1 overflow-hidden border-r border-border">
          {loading ? (
            <div className="space-y-2 p-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <LeadsTable
              leads={filteredLeads}
              selectedId={selectedLeadId}
              onSelect={setSelectedLeadId}
            />
          )}
        </section>

        <aside className="w-[420px] overflow-hidden bg-muted/30">
          {selectedLeadId && details ? (
            <LeadDetailPanel
              details={details}
              loading={detailsLoading}
              onStatusChange={changeStatus}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <div className="text-center">
                <User className="mx-auto h-12 w-12 opacity-30" />
                <p className="mt-2">Select a lead to view details</p>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function LeadsTable({
  leads,
  selectedId,
  onSelect
}: {
  leads: LeadRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <ScrollArea className="h-full">
      <Table>
        <TableHeader className="sticky top-0 bg-card">
          <TableRow>
            <TableHead>Lead</TableHead>
            <TableHead>Company</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Score</TableHead>
            <TableHead>Last Activity</TableHead>
            <TableHead>Source</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                No leads found
              </TableCell>
            </TableRow>
          ) : (
            leads.map((lead) => (
              <TableRow
                key={lead.id}
                className={cn(
                  "cursor-pointer transition-colors",
                  lead.id === selectedId && "bg-primary/5"
                )}
                onClick={() => onSelect(lead.id)}
              >
                <TableCell>
                  <div className="font-medium">
                    {lead.contact.firstName || lead.contact.lastName
                      ? `${lead.contact.firstName ?? ""} ${lead.contact.lastName ?? ""}`.trim()
                      : lead.contact.email || "Unknown"}
                  </div>
                  <div className="text-sm text-muted-foreground">{lead.contact.email}</div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {lead.contact.companyName || "—"}
                </TableCell>
                <TableCell>
                  <StatusBadge status={lead.status} />
                </TableCell>
                <TableCell>
                  <span className="font-mono text-sm">{lead.score}</span>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {lead.lastActivity ? (
                    <div>
                      <span className="capitalize">{friendlyActivityLabel(lead.lastActivity.type)}</span>
                      <div className="text-xs">
                        {new Date(lead.lastActivity.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  ) : (
                    "No activity"
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{lead.source}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}

function StatusBadge({ status }: { status: LeadStatus }) {
  const variants: Record<LeadStatus, string> = {
    new: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    working: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    qualified: "bg-green-500/10 text-green-500 border-green-500/20",
    unqualified: "bg-red-500/10 text-red-500 border-red-500/20",
    converted: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  };

  return (
    <Badge variant="outline" className={cn("capitalize", variants[status])}>
      {status}
    </Badge>
  );
}

function LeadDetailPanel({
  details,
  loading,
  onStatusChange
}: {
  details: LeadDetailsResponse;
  loading: boolean;
  onStatusChange: (status: LeadStatus) => Promise<void>;
}) {
  const { lead, contact, campaign, activities } = details;

  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-6">
        {/* Contact Header */}
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">
            {contact.firstName || contact.lastName
              ? `${contact.firstName ?? ""} ${contact.lastName ?? ""}`.trim()
              : contact.email}
          </h2>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {contact.companyName && (
              <span className="flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5" />
                {contact.companyName}
              </span>
            )}
            {contact.roleTitle && (
              <span>· {contact.roleTitle}</span>
            )}
          </div>
          <div className="space-y-1 text-sm">
            {contact.email && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-3.5 w-3.5" />
                {contact.email}
              </div>
            )}
            {contact.phone && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-3.5 w-3.5" />
                {contact.phone}
              </div>
            )}
          </div>
        </div>

        {/* Lead Meta */}
        <Card>
          <CardContent className="grid grid-cols-2 gap-4 pt-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <Select
                value={lead.status}
                onValueChange={(value) => onStatusChange(value as LeadStatus)}
                disabled={loading}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="working">Working</SelectItem>
                  <SelectItem value="qualified">Qualified</SelectItem>
                  <SelectItem value="unqualified">Unqualified</SelectItem>
                  <SelectItem value="converted">Converted</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Score</label>
              <div className="mt-1 flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                <span className="text-lg font-semibold">{lead.score}</span>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Source</label>
              <div className="mt-1 text-sm">{lead.source}</div>
            </div>
            {campaign && (
              <div>
                <label className="text-xs font-medium text-muted-foreground">Campaign</label>
                <div className="mt-1 text-sm">{campaign.name}</div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Activity Timeline */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Activity Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : activities.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <MessageSquare className="mx-auto h-8 w-8 opacity-30" />
                <p className="mt-2 text-sm">No activity yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {activities.map((act) => (
                  <div
                    key={act.id}
                    className="relative border-l-2 border-border pl-4 pb-4 last:pb-0"
                  >
                    <div className="absolute -left-1.5 top-0 h-3 w-3 rounded-full border-2 border-background bg-primary" />
                    <div className="text-xs text-muted-foreground">
                      {new Date(act.createdAt).toLocaleString()}
                    </div>
                    <div className="mt-1 font-medium text-sm">
                      {friendlyActivityLabel(act.type)}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {renderActivityMetaSummary(act.type, act.meta)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}

function friendlyActivityLabel(type: string): string {
  switch (type) {
    case "landing_form_submit":
      return "Form submitted";
    case "email_sent":
      return "Email sent";
    case "email_open":
      return "Email opened";
    case "email_reply":
      return "Email replied";
    case "sms_sent":
      return "SMS sent";
    case "sms_reply":
      return "SMS reply";
    case "voice_call":
      return "AI voice call";
    case "meeting_booked":
      return "Meeting booked";
    case "status_change":
      return "Status changed";
    default:
      return type.replace(/_/g, " ");
  }
}

function renderActivityMetaSummary(type: string, meta: Record<string, any>) {
  if (type === "landing_form_submit") {
    return (
      <>
        Source: {meta.utm?.utm_source || "direct"} 
        {meta.landing_page_id && <> · Page: {meta.landing_page_id.slice(0, 8)}...</>}
      </>
    );
  }

  if (type === "email_sent") {
    return meta.subject ? <>Subject: {meta.subject}</> : null;
  }

  if (type === "voice_call") {
    return (
      <>
        {meta.outcome && <>Outcome: {meta.outcome}</>}
        {meta.agent_id && <> · Agent: {meta.agent_id.slice(0, 8)}...</>}
      </>
    );
  }

  if (type === "status_change") {
    return (
      <>
        {meta.previous_status && <>{meta.previous_status} → </>}
        {meta.new_status}
      </>
    );
  }

  return null;
}

export default LeadsPage;
