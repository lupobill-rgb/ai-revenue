import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import { Search, ExternalLink, Mail, Phone, Building2 } from "lucide-react";

interface CampaignLeadsTabProps {
  campaignId: string;
  tenantId: string;
}

interface Lead {
  id: string;
  status: string;
  score: number;
  source: string;
  created_at: string;
  contact: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
    company_name: string | null;
    role_title: string | null;
  } | null;
}

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-500/10 text-blue-500",
  working: "bg-yellow-500/10 text-yellow-500",
  qualified: "bg-green-500/10 text-green-500",
  unqualified: "bg-muted text-muted-foreground",
  converted: "bg-primary/10 text-primary",
};

export default function CampaignLeadsTab({ campaignId, tenantId }: CampaignLeadsTabProps) {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    const fetchLeads = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from("crm_leads")
          .select(`
            id,
            status,
            score,
            source,
            created_at,
            contact:crm_contacts(
              id,
              first_name,
              last_name,
              email,
              phone,
              company_name,
              role_title
            )
          `)
          .eq("campaign_id", campaignId)
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false });

        if (error) throw error;
        setLeads(data || []);
      } catch (err) {
        console.error("Error fetching leads:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLeads();
  }, [campaignId, tenantId]);

  // Filter leads
  const filteredLeads = leads.filter((lead) => {
    const matchesSearch =
      !search ||
      lead.contact?.first_name?.toLowerCase().includes(search.toLowerCase()) ||
      lead.contact?.last_name?.toLowerCase().includes(search.toLowerCase()) ||
      lead.contact?.email?.toLowerCase().includes(search.toLowerCase()) ||
      lead.contact?.company_name?.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === "all" || lead.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Campaign Leads</CardTitle>
            <CardDescription>{leads.length} leads in this campaign</CardDescription>
          </div>
          <div className="flex gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search leads..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 w-64"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="working">Working</SelectItem>
                <SelectItem value="qualified">Qualified</SelectItem>
                <SelectItem value="unqualified">Unqualified</SelectItem>
                <SelectItem value="converted">Converted</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filteredLeads.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            {leads.length === 0 ? "No leads captured yet" : "No leads match your filters"}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contact</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Added</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLeads.map((lead) => (
                <TableRow 
                  key={lead.id} 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/crm/${lead.id}`)}
                >
                  <TableCell>
                    <div className="space-y-1">
                      <p className="font-medium">
                        {lead.contact?.first_name || ""} {lead.contact?.last_name || ""}
                        {!lead.contact?.first_name && !lead.contact?.last_name && "Unknown"}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {lead.contact?.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {lead.contact.email}
                          </span>
                        )}
                        {lead.contact?.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {lead.contact.phone}
                          </span>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {lead.contact?.company_name && (
                      <div className="flex items-center gap-2">
                        <Building2 className="h-3 w-3 text-muted-foreground" />
                        <span>{lead.contact.company_name}</span>
                      </div>
                    )}
                    {lead.contact?.role_title && (
                      <p className="text-xs text-muted-foreground">{lead.contact.role_title}</p>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={STATUS_COLORS[lead.status] || "bg-muted"}>
                      {lead.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">{lead.score}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">{lead.source}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {new Date(lead.created_at).toLocaleDateString()}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}>
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
