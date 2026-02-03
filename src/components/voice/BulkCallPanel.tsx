/**
 * Bulk Call Panel
 * Shows progress and per-lead outcomes for bulk calling
 */

import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, Phone, Zap, CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { VoicePhoneNumber } from '@/hooks/useVoiceData';

interface Lead {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  company: string | null;
  status: string;
}

interface Assistant {
  id: string;
  name: string;
}

interface BulkCallStatus {
  leadId: string;
  status: 'pending' | 'queued' | 'calling' | 'completed' | 'failed';
  outcome?: string;
  error?: string;
  callId?: string;
}

interface BulkCallPanelProps {
  leads: Lead[];
  assistants: Assistant[];
  phoneNumbers: VoicePhoneNumber[];
  tenantId: string;
  workspaceId: string;
  onCallComplete?: (results: BulkCallStatus[]) => void;
  createCallRecord: (data: any) => Promise<any>;
}

export function BulkCallPanel({
  leads,
  assistants,
  phoneNumbers,
  tenantId,
  workspaceId,
  onCallComplete,
  createCallRecord,
}: BulkCallPanelProps) {
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [assistantId, setAssistantId] = useState<string>('');
  const [phoneNumberId, setPhoneNumberId] = useState<string>(phoneNumbers[0]?.id || '');
  const [isBulkCalling, setIsBulkCalling] = useState(false);
  const [callStatuses, setCallStatuses] = useState<Map<string, BulkCallStatus>>(new Map());

  const toggleLeadSelection = (leadId: string) => {
    setSelectedLeadIds(prev => {
      const next = new Set(prev);
      if (next.has(leadId)) {
        next.delete(leadId);
      } else {
        next.add(leadId);
      }
      return next;
    });
  };

  const selectAllLeads = () => {
    if (selectedLeadIds.size === leads.filter(l => l.phone).length) {
      setSelectedLeadIds(new Set());
    } else {
      setSelectedLeadIds(new Set(leads.filter(l => l.phone).map(l => l.id)));
    }
  };

  const handleBulkCall = useCallback(async () => {
    if (selectedLeadIds.size === 0 || !assistantId || !phoneNumberId) {
      toast.error('Please select leads, an agent, and a phone number');
      return;
    }

    setIsBulkCalling(true);
    const selectedLeads = leads.filter(l => selectedLeadIds.has(l.id) && l.phone);
    
    // Initialize statuses
    const initialStatuses = new Map<string, BulkCallStatus>();
    selectedLeads.forEach(lead => {
      initialStatuses.set(lead.id, { leadId: lead.id, status: 'pending' });
    });
    setCallStatuses(initialStatuses);

    const results: BulkCallStatus[] = [];

    // Process calls sequentially with delay
    for (const lead of selectedLeads) {
      if (!lead.phone) continue;

      // Update status to queued then calling
      setCallStatuses(prev => {
        const next = new Map(prev);
        next.set(lead.id, { leadId: lead.id, status: 'queued' });
        return next;
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      setCallStatuses(prev => {
        const next = new Map(prev);
        next.set(lead.id, { leadId: lead.id, status: 'calling' });
        return next;
      });

      try {
        // Create call record in database first
        const callRecord = await createCallRecord({
          lead_id: lead.id,
          phone_number_id: phoneNumberId,
          call_type: 'outbound',
          status: 'queued',
          customer_number: lead.phone,
          customer_name: `${lead.first_name} ${lead.last_name}`,
        });

        // Invoke the outbound call via ElevenLabs
        const { data, error } = await supabase.functions.invoke('elevenlabs-make-call', {
          body: {
            agent_id: assistantId,
            phone_number: lead.phone,
            lead_data: {
              id: lead.id,
              name: `${lead.first_name} ${lead.last_name}`,
              company: lead.company,
            },
          },
        });

        if (error || data?.error) {
          throw new Error(data?.error || error?.message || 'Call failed');
        }

        const status: BulkCallStatus = { 
          leadId: lead.id, 
          status: 'completed',
          callId: data?.callId,
        };
        
        setCallStatuses(prev => {
          const next = new Map(prev);
          next.set(lead.id, status);
          return next;
        });
        
        results.push(status);

        // Add delay between calls to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        const status: BulkCallStatus = { 
          leadId: lead.id, 
          status: 'failed', 
          error: error instanceof Error ? error.message : 'Failed to initiate call',
        };
        
        setCallStatuses(prev => {
          const next = new Map(prev);
          next.set(lead.id, status);
          return next;
        });
        
        results.push(status);
      }
    }

    setIsBulkCalling(false);
    
    const completed = results.filter(r => r.status === 'completed').length;
    const failed = results.filter(r => r.status === 'failed').length;
    
    toast.success(`Bulk calling completed: ${completed} successful, ${failed} failed`);
    onCallComplete?.(results);
  }, [selectedLeadIds, assistantId, phoneNumberId, leads, createCallRecord, onCallComplete]);

  const completedCount = Array.from(callStatuses.values()).filter(s => s.status === 'completed').length;
  const failedCount = Array.from(callStatuses.values()).filter(s => s.status === 'failed').length;
  const pendingCount = Array.from(callStatuses.values()).filter(s => s.status === 'pending' || s.status === 'queued').length;
  const totalCalls = callStatuses.size;
  const progress = totalCalls > 0 ? ((completedCount + failedCount) / totalCalls) * 100 : 0;

  const leadsWithPhone = leads.filter(l => l.phone);

  if (phoneNumbers.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">No phone number configured</p>
          <p className="text-sm text-muted-foreground mt-1">
            Add a phone number in the Numbers tab to start bulk calling
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Select Leads</CardTitle>
              <CardDescription>Choose leads with phone numbers for bulk calling</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={selectAllLeads} disabled={isBulkCalling}>
              {selectedLeadIds.size === leadsWithPhone.length ? 'Deselect All' : 'Select All'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {leadsWithPhone.length === 0 ? (
            <div className="text-center py-8">
              <Phone className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No leads with phone numbers found</p>
              <p className="text-sm text-muted-foreground mt-1">Add leads with phone numbers in the CRM first</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {leadsWithPhone.map((lead) => {
                  const callStatus = callStatuses.get(lead.id);
                  return (
                    <div
                      key={lead.id}
                      className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                        selectedLeadIds.has(lead.id) ? 'border-primary bg-primary/5' : 'border-border'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={selectedLeadIds.has(lead.id)}
                          onCheckedChange={() => toggleLeadSelection(lead.id)}
                          disabled={isBulkCalling}
                        />
                        <div>
                          <p className="font-medium">{lead.first_name} {lead.last_name}</p>
                          <p className="text-sm text-muted-foreground">{lead.phone}</p>
                          {lead.company && (
                            <p className="text-xs text-muted-foreground">{lead.company}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="capitalize">{lead.status}</Badge>
                        {callStatus && (
                          <div className="flex items-center gap-1">
                            {callStatus.status === 'pending' && <Clock className="h-4 w-4 text-muted-foreground" />}
                            {callStatus.status === 'queued' && <Clock className="h-4 w-4 text-yellow-500" />}
                            {callStatus.status === 'calling' && <Loader2 className="h-4 w-4 text-primary animate-spin" />}
                            {callStatus.status === 'completed' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                            {callStatus.status === 'failed' && (
                              <div className="flex items-center gap-1" title={callStatus.error}>
                                <XCircle className="h-4 w-4 text-destructive" />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Call Settings</CardTitle>
          <CardDescription>Configure bulk call parameters</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Voice Agent</Label>
            <Select value={assistantId} onValueChange={setAssistantId} disabled={isBulkCalling}>
              <SelectTrigger>
                <SelectValue placeholder="Select an agent" />
              </SelectTrigger>
              <SelectContent>
                {assistants.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>From Phone Number</Label>
            <Select value={phoneNumberId} onValueChange={setPhoneNumberId} disabled={isBulkCalling}>
              <SelectTrigger>
                <SelectValue placeholder="Select a phone number" />
              </SelectTrigger>
              <SelectContent>
                {phoneNumbers.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.phone_number} ({p.display_name})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="pt-4 border-t">
            <div className="flex items-center justify-between text-sm mb-4">
              <span className="text-muted-foreground">Selected leads:</span>
              <span className="font-medium">{selectedLeadIds.size}</span>
            </div>
            
            <Button 
              className="w-full" 
              onClick={handleBulkCall}
              disabled={isBulkCalling || selectedLeadIds.size === 0 || !assistantId || !phoneNumberId}
            >
              {isBulkCalling ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Calling...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  Start Bulk Calls
                </>
              )}
            </Button>
          </div>

          {callStatuses.size > 0 && (
            <div className="pt-4 border-t space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Call Progress</p>
                <span className="text-xs text-muted-foreground">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
              <div className="text-sm text-muted-foreground space-y-1">
                <div className="flex justify-between">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-green-500" /> Completed:
                  </span>
                  <span>{completedCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="flex items-center gap-1">
                    <XCircle className="h-3 w-3 text-destructive" /> Failed:
                  </span>
                  <span>{failedCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-muted-foreground" /> Pending:
                  </span>
                  <span>{pendingCount}</span>
                </div>
              </div>

              {/* Show failures with reasons */}
              {failedCount > 0 && (
                <div className="pt-2 border-t">
                  <p className="text-xs font-medium text-destructive mb-2">Failed Calls:</p>
                  <div className="space-y-1 max-h-24 overflow-y-auto">
                    {Array.from(callStatuses.values())
                      .filter(s => s.status === 'failed')
                      .map(s => {
                        const lead = leads.find(l => l.id === s.leadId);
                        return (
                          <p key={s.leadId} className="text-xs text-muted-foreground">
                            {lead?.first_name} {lead?.last_name}: {s.error || 'Unknown error'}
                          </p>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
