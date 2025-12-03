import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Phone, PhoneOff, Mic, MicOff, RefreshCw, AlertCircle, Loader2, Plus, Trash2, Edit, PhoneCall, Clock, BarChart3, Users, PhoneIncoming, PhoneOutgoing, Play, Pause, Volume2, ChevronDown, ChevronUp, MessageSquare, Zap, CheckCircle2, XCircle, Database } from "lucide-react";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useVapiConversation } from "@/hooks/useVapiConversation";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from "recharts";

const VAPI_PUBLIC_KEY = import.meta.env.VITE_VAPI_PUBLIC_KEY || "";

interface VapiAssistant {
  id: string;
  name: string;
  firstMessage?: string;
  model?: string;
  voice?: string;
  createdAt?: string;
}

interface VapiPhoneNumber {
  id: string;
  number: string;
  name: string;
  provider?: string;
}

interface VapiCall {
  id: string;
  type: string;
  status: string;
  assistantId?: string;
  customer?: { number?: string; name?: string };
  duration?: number;
  cost?: number;
  createdAt: string;
  transcript?: string;
  summary?: string;
  recordingUrl?: string;
}

interface VapiAnalytics {
  totalCalls: number;
  completedCalls: number;
  totalDurationMinutes: number;
  averageCallDuration: number;
  callsByType: Record<string, number>;
  callsByStatus: Record<string, number>;
}

interface Lead {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  company: string | null;
  status: string;
}

interface BulkCallStatus {
  leadId: string;
  status: 'pending' | 'calling' | 'completed' | 'failed';
  error?: string;
}

interface VoiceCampaign {
  id: string;
  name: string;
  status: string;
  goal: string | null;
  content: any;
  created_at: string;
}

const CHART_COLORS = ['#3b82f6', '#22c55e', '#a855f7', '#f97316', '#06b6d4', '#ef4444'];

// Sample data for demo mode
const SAMPLE_ASSISTANTS: VapiAssistant[] = [
  { id: "asst-1", name: "Sales Outreach Agent", firstMessage: "Hi! I'm calling from your marketing platform. Do you have a moment?", model: "gpt-4o", voice: "alloy", createdAt: "2024-11-15" },
  { id: "asst-2", name: "Customer Support Agent", firstMessage: "Hello! How can I help you today?", model: "gpt-4o", voice: "nova", createdAt: "2024-11-18" },
  { id: "asst-3", name: "Appointment Scheduler", firstMessage: "Hi there! I'm calling to help schedule your consultation.", model: "gpt-4o-mini", voice: "shimmer", createdAt: "2024-11-20" },
];

const SAMPLE_PHONE_NUMBERS: VapiPhoneNumber[] = [
  { id: "phone-1", number: "+1 (555) 123-4567", name: "Primary Sales Line", provider: "Twilio" },
  { id: "phone-2", number: "+1 (555) 987-6543", name: "Support Hotline", provider: "Twilio" },
];

const SAMPLE_CALLS: VapiCall[] = [
  { id: "call-1", type: "outboundPhoneCall", status: "ended", assistantId: "asst-1", customer: { number: "+1-555-0101", name: "Sarah Johnson" }, duration: 245, cost: 0.12, createdAt: new Date(Date.now() - 3600000).toISOString(), transcript: "Agent: Hi! I'm calling from your marketing platform...", summary: "Lead was interested in premium features. Scheduled demo for next week." },
  { id: "call-2", type: "outboundPhoneCall", status: "ended", assistantId: "asst-1", customer: { number: "+1-555-0102", name: "Michael Chen" }, duration: 180, cost: 0.09, createdAt: new Date(Date.now() - 7200000).toISOString(), transcript: "Agent: Hello! Do you have a moment to discuss...", summary: "Contact requested callback next month." },
  { id: "call-3", type: "inboundPhoneCall", status: "ended", assistantId: "asst-2", customer: { number: "+1-555-0103", name: "Emily Rodriguez" }, duration: 320, cost: 0.16, createdAt: new Date(Date.now() - 14400000).toISOString(), transcript: "Customer: Hi, I need help with my account...", summary: "Resolved billing inquiry successfully." },
  { id: "call-4", type: "outboundPhoneCall", status: "no-answer", assistantId: "asst-1", customer: { number: "+1-555-0104", name: "David Thompson" }, duration: 0, cost: 0.01, createdAt: new Date(Date.now() - 21600000).toISOString() },
  { id: "call-5", type: "inboundPhoneCall", status: "ended", assistantId: "asst-3", customer: { number: "+1-555-0105", name: "Jennifer Martinez" }, duration: 420, cost: 0.21, createdAt: new Date(Date.now() - 86400000).toISOString(), transcript: "Customer: I'd like to schedule a consultation...", summary: "Appointment booked for Thursday at 2pm." },
];

const SAMPLE_ANALYTICS: VapiAnalytics = {
  totalCalls: 156,
  completedCalls: 128,
  totalDurationMinutes: 892,
  averageCallDuration: 185,
  callsByType: { outboundPhoneCall: 98, inboundPhoneCall: 58 },
  callsByStatus: { ended: 128, "no-answer": 18, busy: 6, failed: 4 },
};

const AnalyticsCharts = ({ analytics, calls }: { analytics: VapiAnalytics | null; calls: VapiCall[] }) => {
  const callsByTypeData = useMemo(() => {
    if (!analytics?.callsByType) return [];
    return Object.entries(analytics.callsByType).map(([name, value]) => ({
      name: name.replace(/([A-Z])/g, ' $1').trim(),
      value,
    }));
  }, [analytics?.callsByType]);

  const callsByStatusData = useMemo(() => {
    if (!analytics?.callsByStatus) return [];
    return Object.entries(analytics.callsByStatus).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
    }));
  }, [analytics?.callsByStatus]);

  const callsOverTimeData = useMemo(() => {
    const last7Days: { date: string; calls: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const dayLabel = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      const dayCalls = calls.filter(c => c.createdAt?.startsWith(dateStr));
      last7Days.push({ date: dayLabel, calls: dayCalls.length });
    }
    return last7Days;
  }, [calls]);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-500/10">
                <PhoneCall className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{analytics?.totalCalls || 0}</p>
                <p className="text-xs text-muted-foreground">Total Calls</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-green-500/10">
                <Phone className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{analytics?.completedCalls || 0}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-purple-500/10">
                <Clock className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{analytics?.totalDurationMinutes || 0}m</p>
                <p className="text-xs text-muted-foreground">Total Duration</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-orange-500/10">
                <BarChart3 className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{analytics?.averageCallDuration || 0}s</p>
                <p className="text-xs text-muted-foreground">Avg Duration</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Line Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Call Volume (Last 7 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={callsOverTimeData} barSize={32}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  allowDecimals={false}
                />
                <Tooltip 
                  cursor={{ fill: 'hsl(var(--muted)/0.3)' }}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--popover))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                    fontSize: '12px'
                  }}
                />
                <Bar dataKey="calls" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Calls" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Breakdown Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">By Type</CardTitle>
          </CardHeader>
          <CardContent>
            {callsByTypeData.length > 0 ? (
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={callsByTypeData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {callsByTypeData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--popover))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px',
                        fontSize: '12px'
                      }}
                    />
                    <Legend 
                      verticalAlign="bottom" 
                      iconType="circle" 
                      iconSize={8}
                      wrapperStyle={{ fontSize: '11px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm text-center py-12">No data</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">By Status</CardTitle>
          </CardHeader>
          <CardContent>
            {callsByStatusData.length > 0 ? (
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={callsByStatusData} layout="vertical" barSize={20}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                    <XAxis 
                      type="number" 
                      axisLine={false} 
                      tickLine={false}
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      allowDecimals={false}
                    />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      axisLine={false} 
                      tickLine={false}
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} 
                      width={70}
                    />
                    <Tooltip 
                      cursor={{ fill: 'hsl(var(--muted)/0.3)' }}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--popover))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px',
                        fontSize: '12px'
                      }}
                    />
                    <Bar dataKey="value" fill="#22c55e" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm text-center py-12">No data</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const VoiceAgents = () => {
  const [assistants, setAssistants] = useState<VapiAssistant[]>([]);
  const [phoneNumbers, setPhoneNumbers] = useState<VapiPhoneNumber[]>([]);
  const [calls, setCalls] = useState<VapiCall[]>([]);
  const [analytics, setAnalytics] = useState<VapiAnalytics | null>(null);
  const [selectedAssistantId, setSelectedAssistantId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [activeTab, setActiveTab] = useState("call");
  const [showSampleData, setShowSampleData] = useState(true);

  // Display data (sample or real)
  const displayAssistants = showSampleData && assistants.length === 0 ? SAMPLE_ASSISTANTS : assistants;
  const displayPhoneNumbers = showSampleData && phoneNumbers.length === 0 ? SAMPLE_PHONE_NUMBERS : phoneNumbers;
  const displayCalls = showSampleData && calls.length === 0 ? SAMPLE_CALLS : calls;
  const displayAnalytics = showSampleData && !analytics ? SAMPLE_ANALYTICS : analytics;

  // Create assistant dialog
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newAssistant, setNewAssistant] = useState({
    name: "",
    firstMessage: "Hello! How can I help you today?",
    systemPrompt: "You are a helpful assistant.",
    model: "gpt-4o",
    voice: "alloy",
  });
  const [isCreating, setIsCreating] = useState(false);

  // Edit assistant dialog
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingAssistant, setEditingAssistant] = useState<{
    id: string;
    name: string;
    firstMessage: string;
    systemPrompt: string;
    model: string;
    voice: string;
  } | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Audio player for recordings
  const [playingCallId, setPlayingCallId] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  // Expanded transcripts
  const [expandedCallIds, setExpandedCallIds] = useState<Set<string>>(new Set());

  // Bulk calling
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [bulkAssistantId, setBulkAssistantId] = useState<string>("");
  const [bulkPhoneNumberId, setBulkPhoneNumberId] = useState<string>("");
  const [isBulkCalling, setIsBulkCalling] = useState(false);
  const [bulkCallStatuses, setBulkCallStatuses] = useState<Map<string, BulkCallStatus>>(new Map());

  // Voice campaigns
  const [voiceCampaigns, setVoiceCampaigns] = useState<VoiceCampaign[]>([]);
  const [executingCampaignId, setExecutingCampaignId] = useState<string | null>(null);
  const [campaignAssistantId, setCampaignAssistantId] = useState<string>("");
  const [campaignPhoneNumberId, setCampaignPhoneNumberId] = useState<string>("");

  const toggleTranscript = (callId: string) => {
    setExpandedCallIds(prev => {
      const next = new Set(prev);
      if (next.has(callId)) {
        next.delete(callId);
      } else {
        next.add(callId);
      }
      return next;
    });
  };

  const handlePlayRecording = (call: VapiCall) => {
    if (!call.recordingUrl) {
      toast.error("No recording available for this call");
      return;
    }

    // If same call is playing, pause it
    if (playingCallId === call.id && audioElement) {
      audioElement.pause();
      setPlayingCallId(null);
      return;
    }

    // Stop current audio if playing
    if (audioElement) {
      audioElement.pause();
    }

    // Create and play new audio
    const audio = new Audio(call.recordingUrl);
    audio.onended = () => {
      setPlayingCallId(null);
    };
    audio.onerror = () => {
      toast.error("Failed to play recording");
      setPlayingCallId(null);
    };
    audio.play();
    setAudioElement(audio);
    setPlayingCallId(call.id);
  };

  const {
    status,
    isSpeaking,
    transcript,
    error,
    startCall,
    endCall,
    setVolume,
  } = useVapiConversation({
    publicKey: VAPI_PUBLIC_KEY,
    onError: (err) => toast.error(err.message || "Voice agent error"),
  });

  const fetchAllData = async () => {
    setIsLoading(true);
    try {
      const [assistantsRes, phoneNumbersRes, callsRes, analyticsRes, leadsRes, campaignsRes] = await Promise.all([
        supabase.functions.invoke('vapi-list-assistants'),
        supabase.functions.invoke('vapi-list-phone-numbers'),
        supabase.functions.invoke('vapi-list-calls', { body: { limit: 50 } }),
        supabase.functions.invoke('vapi-analytics'),
        supabase.from('leads').select('id, first_name, last_name, phone, company, status').not('phone', 'is', null).limit(100),
        supabase.from('assets').select('id, name, status, goal, content, created_at').eq('type', 'voice').in('status', ['approved', 'review']).order('created_at', { ascending: false }),
      ]);

      if (assistantsRes.data?.assistants) {
        setAssistants(assistantsRes.data.assistants);
        if (assistantsRes.data.assistants.length > 0 && !selectedAssistantId) {
          setSelectedAssistantId(assistantsRes.data.assistants[0].id);
        }
      }
      if (phoneNumbersRes.data?.phoneNumbers) {
        setPhoneNumbers(phoneNumbersRes.data.phoneNumbers);
        if (phoneNumbersRes.data.phoneNumbers.length > 0 && !bulkPhoneNumberId) {
          setBulkPhoneNumberId(phoneNumbersRes.data.phoneNumbers[0].id);
        }
      }
      if (callsRes.data?.calls) {
        setCalls(Array.isArray(callsRes.data.calls) ? callsRes.data.calls : []);
      }
      if (analyticsRes.data?.analytics) {
        setAnalytics(analyticsRes.data.analytics);
      }
      if (leadsRes.data) {
        setLeads(leadsRes.data);
      }
      if (campaignsRes.data) {
        setVoiceCampaigns(campaignsRes.data);
      }
    } catch (error) {
      console.error('Error fetching Vapi data:', error);
      toast.error('Failed to load voice agent data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const handleStartCall = async () => {
    if (!selectedAssistantId) {
      toast.error("Please select an assistant first");
      return;
    }
    await startCall(selectedAssistantId);
  };

  const handleEndCall = () => {
    endCall();
    toast.info("Call ended");
    // Refresh calls after ending
    setTimeout(() => {
      supabase.functions.invoke('vapi-list-calls', { body: { limit: 50 } })
        .then(res => {
          if (res.data?.calls) setCalls(res.data.calls);
        });
    }, 2000);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    setVolume(isMuted ? 1 : 0);
  };

  const handleCreateAssistant = async () => {
    if (!newAssistant.name) {
      toast.error("Please enter an assistant name");
      return;
    }

    setIsCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('vapi-manage-assistant', {
        body: {
          action: 'create',
          assistantData: {
            name: newAssistant.name,
            firstMessage: newAssistant.firstMessage,
            model: {
              provider: "openai",
              model: newAssistant.model,
              messages: [{ role: "system", content: newAssistant.systemPrompt }],
            },
            voice: { provider: "openai", voiceId: newAssistant.voice },
          },
        },
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message);
      }

      toast.success("Assistant created successfully");
      setShowCreateDialog(false);
      setNewAssistant({
        name: "",
        firstMessage: "Hello! How can I help you today?",
        systemPrompt: "You are a helpful assistant.",
        model: "gpt-4o",
        voice: "alloy",
      });
      fetchAllData();
    } catch (error) {
      console.error('Error creating assistant:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create assistant');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteAssistant = async (assistantId: string) => {
    if (!confirm("Are you sure you want to delete this assistant?")) return;

    try {
      const { data, error } = await supabase.functions.invoke('vapi-manage-assistant', {
        body: { action: 'delete', assistantId },
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message);
      }

      toast.success("Assistant deleted");
      fetchAllData();
    } catch (error) {
      console.error('Error deleting assistant:', error);
      toast.error('Failed to delete assistant');
    }
  };

  const handleEditAssistant = async (assistant: VapiAssistant) => {
    try {
      // Fetch full assistant details including system prompt
      const { data, error } = await supabase.functions.invoke('vapi-manage-assistant', {
        body: { action: 'get', assistantId: assistant.id },
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message);
      }

      const fullAssistant = data.data;
      setEditingAssistant({
        id: assistant.id,
        name: fullAssistant.name || assistant.name,
        firstMessage: fullAssistant.firstMessage || '',
        systemPrompt: fullAssistant.model?.messages?.[0]?.content || '',
        model: fullAssistant.model?.model || 'gpt-4o',
        voice: fullAssistant.voice?.voiceId || fullAssistant.voice?.voice || 'alloy',
      });
      setShowEditDialog(true);
    } catch (error) {
      console.error('Error fetching assistant details:', error);
      // Fallback to basic info if fetch fails
      setEditingAssistant({
        id: assistant.id,
        name: assistant.name,
        firstMessage: assistant.firstMessage || '',
        systemPrompt: '',
        model: assistant.model || 'gpt-4o',
        voice: assistant.voice || 'alloy',
      });
      setShowEditDialog(true);
    }
  };

  const handleUpdateAssistant = async () => {
    if (!editingAssistant) return;

    setIsUpdating(true);
    try {
      const { data, error } = await supabase.functions.invoke('vapi-manage-assistant', {
        body: {
          action: 'update',
          assistantId: editingAssistant.id,
          assistantData: {
            name: editingAssistant.name,
            firstMessage: editingAssistant.firstMessage,
            model: {
              provider: "openai",
              model: editingAssistant.model,
              messages: [{ role: "system", content: editingAssistant.systemPrompt }],
            },
            voice: { provider: "openai", voiceId: editingAssistant.voice },
          },
        },
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message);
      }

      toast.success("Assistant updated successfully");
      setShowEditDialog(false);
      setEditingAssistant(null);
      fetchAllData();
    } catch (error) {
      console.error('Error updating assistant:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update assistant');
    } finally {
      setIsUpdating(false);
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'connected': return 'bg-green-500';
      case 'connecting': return 'bg-yellow-500';
      case 'disconnected': return 'bg-red-500';
      default: return 'bg-muted';
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const selectedAssistant = assistants.find(a => a.id === selectedAssistantId);

  // Bulk calling functions
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
    if (selectedLeadIds.size === leads.length) {
      setSelectedLeadIds(new Set());
    } else {
      setSelectedLeadIds(new Set(leads.map(l => l.id)));
    }
  };

  const handleBulkCall = async () => {
    if (selectedLeadIds.size === 0) {
      toast.error("Please select at least one lead");
      return;
    }
    if (!bulkAssistantId) {
      toast.error("Please select an assistant");
      return;
    }
    if (!bulkPhoneNumberId) {
      toast.error("Please select a phone number");
      return;
    }

    setIsBulkCalling(true);
    const selectedLeads = leads.filter(l => selectedLeadIds.has(l.id));
    
    // Initialize statuses
    const initialStatuses = new Map<string, BulkCallStatus>();
    selectedLeads.forEach(lead => {
      initialStatuses.set(lead.id, { leadId: lead.id, status: 'pending' });
    });
    setBulkCallStatuses(initialStatuses);

    // Process calls sequentially with delay
    for (const lead of selectedLeads) {
      if (!lead.phone) continue;

      setBulkCallStatuses(prev => {
        const next = new Map(prev);
        next.set(lead.id, { leadId: lead.id, status: 'calling' });
        return next;
      });

      try {
        const { data, error } = await supabase.functions.invoke('vapi-outbound-call', {
          body: {
            assistantId: bulkAssistantId,
            phoneNumberId: bulkPhoneNumberId,
            customerNumber: lead.phone,
            customerName: `${lead.first_name} ${lead.last_name}`,
          },
        });

        if (error || data?.error) {
          throw new Error(data?.error || error?.message);
        }

        setBulkCallStatuses(prev => {
          const next = new Map(prev);
          next.set(lead.id, { leadId: lead.id, status: 'completed' });
          return next;
        });

        // Add delay between calls to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        setBulkCallStatuses(prev => {
          const next = new Map(prev);
          next.set(lead.id, { 
            leadId: lead.id, 
            status: 'failed', 
            error: error instanceof Error ? error.message : 'Failed to initiate call' 
          });
          return next;
        });
      }
    }

    setIsBulkCalling(false);
    toast.success(`Bulk calling completed. ${selectedLeads.length} calls initiated.`);
    
    // Refresh call history
    setTimeout(() => {
      supabase.functions.invoke('vapi-list-calls', { body: { limit: 50 } })
        .then(res => {
          if (res.data?.calls) setCalls(res.data.calls);
        });
    }, 3000);
  };

  const handleExecuteCampaign = async (campaign: VoiceCampaign) => {
    if (!campaignAssistantId) {
      toast.error("Please select an assistant for the campaign");
      return;
    }

    const targetLeads = campaign.content?.target_leads || [];
    if (targetLeads.length === 0) {
      toast.error("No leads linked to this campaign");
      return;
    }

    setExecutingCampaignId(campaign.id);
    toast.info(`Executing voice campaign to ${targetLeads.length} leads...`);

    try {
      const { data, error } = await supabase.functions.invoke('execute-voice-campaign', {
        body: {
          assetId: campaign.id,
          assistantId: campaignAssistantId,
          phoneNumberId: campaignPhoneNumberId || undefined,
        },
      });

      if (error) throw error;

      toast.success(`Campaign executed: ${data.successCount} calls successful, ${data.failCount} failed`);
      
      // Refresh data
      fetchAllData();
    } catch (error) {
      console.error('Campaign execution error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to execute campaign');
    } finally {
      setExecutingCampaignId(null);
    }
  };

  if (!VAPI_PUBLIC_KEY) {
    return (
      <ProtectedRoute>
        <div className="flex min-h-screen flex-col bg-background">
          <NavBar />
          <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Voice agents not configured. Please contact support.
              </AlertDescription>
            </Alert>
          </main>
          <Footer />
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="flex min-h-screen flex-col bg-background">
        <NavBar />
        <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10">
                  <Phone className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-4xl font-bold text-foreground">Voice Agents</h1>
                  <p className="text-sm text-muted-foreground">
                    Manage AI voice agents, calls, and analytics
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={fetchAllData} disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-7">
              <TabsTrigger value="campaigns" className="gap-2">
                <PhoneOutgoing className="h-4 w-4" />
                Campaigns ({voiceCampaigns.length})
              </TabsTrigger>
              <TabsTrigger value="call" className="gap-2">
                <PhoneCall className="h-4 w-4" />
                Live Call
              </TabsTrigger>
              <TabsTrigger value="bulk" className="gap-2">
                <Zap className="h-4 w-4" />
                Bulk Calls
              </TabsTrigger>
              <TabsTrigger value="agents" className="gap-2">
                <Users className="h-4 w-4" />
                Agents ({assistants.length})
              </TabsTrigger>
              <TabsTrigger value="phones" className="gap-2">
                <Phone className="h-4 w-4" />
                Numbers ({phoneNumbers.length})
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-2">
                <Clock className="h-4 w-4" />
                History ({calls.length})
              </TabsTrigger>
              <TabsTrigger value="analytics" className="gap-2">
                <BarChart3 className="h-4 w-4" />
                Analytics
              </TabsTrigger>
            </TabsList>

            {/* Campaigns Tab */}
            <TabsContent value="campaigns">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PhoneOutgoing className="h-5 w-5" />
                    Voice Campaigns from CRM
                  </CardTitle>
                  <CardDescription>
                    Execute approved voice campaigns to call linked CRM leads
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {voiceCampaigns.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Phone className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No voice campaigns found</p>
                      <p className="text-sm mt-2">Create a new campaign to generate voice outreach linked to your CRM leads</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Campaign Settings */}
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Select Agent for Calls</Label>
                          <Select value={campaignAssistantId} onValueChange={setCampaignAssistantId}>
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
                          <Label>Outbound Phone Number (Optional)</Label>
                          <Select value={campaignPhoneNumberId} onValueChange={setCampaignPhoneNumberId}>
                            <SelectTrigger>
                              <SelectValue placeholder="Use default number" />
                            </SelectTrigger>
                            <SelectContent>
                              {phoneNumbers.map((p) => (
                                <SelectItem key={p.id} value={p.id}>{p.number} ({p.name})</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Campaign List */}
                      <div className="space-y-4">
                        {voiceCampaigns.map((campaign) => {
                          const targetLeads = campaign.content?.target_leads || [];
                          const callStatus = campaign.content?.call_status || 'pending';
                          const callsMade = campaign.content?.calls_made || 0;
                          
                          return (
                            <Card key={campaign.id} className="border-border/50">
                              <CardContent className="p-4">
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                      <h4 className="font-medium">{campaign.name}</h4>
                                      <Badge variant={campaign.status === 'approved' ? 'default' : 'secondary'}>
                                        {campaign.status}
                                      </Badge>
                                      {callStatus === 'completed' && (
                                        <Badge variant="outline" className="text-green-600">
                                          <CheckCircle2 className="h-3 w-3 mr-1" />
                                          Executed
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="text-sm text-muted-foreground mb-2">
                                      {campaign.goal || 'No goal specified'}
                                    </p>
                                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                      <span className="flex items-center gap-1">
                                        <Users className="h-3 w-3" />
                                        {targetLeads.length} leads
                                      </span>
                                      {callsMade > 0 && (
                                        <span className="flex items-center gap-1">
                                          <PhoneCall className="h-3 w-3" />
                                          {callsMade} calls made
                                        </span>
                                      )}
                                      <span>
                                        {new Date(campaign.created_at).toLocaleDateString()}
                                      </span>
                                    </div>
                                  </div>
                                  <Button
                                    onClick={() => handleExecuteCampaign(campaign)}
                                    disabled={
                                      executingCampaignId === campaign.id || 
                                      !campaignAssistantId || 
                                      targetLeads.length === 0 ||
                                      campaign.status !== 'approved'
                                    }
                                    size="sm"
                                  >
                                    {executingCampaignId === campaign.id ? (
                                      <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Calling...
                                      </>
                                    ) : (
                                      <>
                                        <PhoneOutgoing className="h-4 w-4 mr-2" />
                                        Execute Calls
                                      </>
                                    )}
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Live Call Tab */}
            <TabsContent value="call">
              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Start Voice Call</CardTitle>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
                        <Badge variant="outline" className="capitalize">{status}</Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <Label>Select Agent</Label>
                      <Select value={selectedAssistantId} onValueChange={setSelectedAssistantId} disabled={status === 'connected'}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select an agent" />
                        </SelectTrigger>
                        <SelectContent>
                          {assistants.map((a) => (
                            <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectedAssistant && (
                        <p className="text-xs text-muted-foreground">
                          Model: {selectedAssistant.model} | Voice: {selectedAssistant.voice}
                        </p>
                      )}
                    </div>

                    <div className="flex justify-center">
                      <div className={`relative w-32 h-32 rounded-full flex items-center justify-center transition-all ${
                        status === 'connected' ? isSpeaking ? 'bg-primary/20 animate-pulse' : 'bg-primary/10' : 'bg-muted'
                      }`}>
                        {status === 'connecting' ? (
                          <Loader2 className="h-12 w-12 text-primary animate-spin" />
                        ) : (
                          <Phone className={`h-12 w-12 ${status === 'connected' ? 'text-primary' : 'text-muted-foreground'}`} />
                        )}
                        {isSpeaking && <div className="absolute inset-0 rounded-full border-4 border-primary animate-ping" />}
                      </div>
                    </div>

                    <p className="text-center text-sm text-muted-foreground">
                      {status === 'connected' ? (isSpeaking ? "Agent speaking..." : "Listening...") 
                        : status === 'connecting' ? "Connecting..." : "Ready"}
                    </p>

                    <div className="flex justify-center gap-3">
                      {status !== 'connected' ? (
                        <Button size="lg" onClick={handleStartCall} disabled={status === 'connecting' || !selectedAssistantId}>
                          {status === 'connecting' ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Phone className="h-5 w-5 mr-2" />}
                          Start Call
                        </Button>
                      ) : (
                        <>
                          <Button size="lg" variant={isMuted ? "secondary" : "outline"} onClick={toggleMute}>
                            {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                          </Button>
                          <Button size="lg" variant="destructive" onClick={handleEndCall}>
                            <PhoneOff className="h-5 w-5 mr-2" />
                            End Call
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Live Transcript</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[350px] w-full rounded-md border p-4">
                      {transcript.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">
                          Transcript will appear here during the call
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {transcript.map((line, i) => (
                            <p key={i} className={`text-sm ${line.startsWith('assistant:') ? 'text-primary' : ''}`}>
                              {line}
                            </p>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Agents Tab */}
            <TabsContent value="agents">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Voice Agents</CardTitle>
                      <CardDescription>Manage your AI voice assistants</CardDescription>
                    </div>
                    <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                      <DialogTrigger asChild>
                        <Button><Plus className="h-4 w-4 mr-2" />Create Agent</Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-lg">
                        <DialogHeader>
                          <DialogTitle>Create Voice Agent</DialogTitle>
                          <DialogDescription>Configure a new AI voice assistant</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label>Name *</Label>
                            <Input value={newAssistant.name} onChange={(e) => setNewAssistant({...newAssistant, name: e.target.value})} placeholder="Sales Agent" />
                          </div>
                          <div className="space-y-2">
                            <Label>First Message</Label>
                            <Input value={newAssistant.firstMessage} onChange={(e) => setNewAssistant({...newAssistant, firstMessage: e.target.value})} />
                          </div>
                          <div className="space-y-2">
                            <Label>System Prompt</Label>
                            <Textarea value={newAssistant.systemPrompt} onChange={(e) => setNewAssistant({...newAssistant, systemPrompt: e.target.value})} rows={3} />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Model</Label>
                              <Select value={newAssistant.model} onValueChange={(v) => setNewAssistant({...newAssistant, model: v})}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                                  <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                                  <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Voice</Label>
                              <Select value={newAssistant.voice} onValueChange={(v) => setNewAssistant({...newAssistant, voice: v})}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="alloy">Alloy</SelectItem>
                                  <SelectItem value="echo">Echo</SelectItem>
                                  <SelectItem value="fable">Fable</SelectItem>
                                  <SelectItem value="onyx">Onyx</SelectItem>
                                  <SelectItem value="nova">Nova</SelectItem>
                                  <SelectItem value="shimmer">Shimmer</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                        <div className="flex justify-end gap-3">
                          <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
                          <Button onClick={handleCreateAssistant} disabled={isCreating}>
                            {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Create
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>

                    {/* Edit Assistant Dialog */}
                    <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
                      <DialogContent className="max-w-lg">
                        <DialogHeader>
                          <DialogTitle>Edit Voice Agent</DialogTitle>
                          <DialogDescription>Update your AI voice assistant configuration</DialogDescription>
                        </DialogHeader>
                        {editingAssistant && (
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label>Name *</Label>
                              <Input 
                                value={editingAssistant.name} 
                                onChange={(e) => setEditingAssistant({...editingAssistant, name: e.target.value})} 
                                placeholder="Sales Agent" 
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>First Message</Label>
                              <Input 
                                value={editingAssistant.firstMessage} 
                                onChange={(e) => setEditingAssistant({...editingAssistant, firstMessage: e.target.value})} 
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>System Prompt</Label>
                              <Textarea 
                                value={editingAssistant.systemPrompt} 
                                onChange={(e) => setEditingAssistant({...editingAssistant, systemPrompt: e.target.value})} 
                                rows={4} 
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Model</Label>
                                <Select value={editingAssistant.model} onValueChange={(v) => setEditingAssistant({...editingAssistant, model: v})}>
                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                                    <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                                    <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label>Voice</Label>
                                <Select value={editingAssistant.voice} onValueChange={(v) => setEditingAssistant({...editingAssistant, voice: v})}>
                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="alloy">Alloy</SelectItem>
                                    <SelectItem value="echo">Echo</SelectItem>
                                    <SelectItem value="fable">Fable</SelectItem>
                                    <SelectItem value="onyx">Onyx</SelectItem>
                                    <SelectItem value="nova">Nova</SelectItem>
                                    <SelectItem value="shimmer">Shimmer</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </div>
                        )}
                        <div className="flex justify-end gap-3">
                          <Button variant="outline" onClick={() => { setShowEditDialog(false); setEditingAssistant(null); }}>Cancel</Button>
                          <Button onClick={handleUpdateAssistant} disabled={isUpdating}>
                            {isUpdating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Save Changes
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                  ) : assistants.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No agents yet. Create your first one!</p>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {assistants.map((a) => (
                        <Card key={a.id} className={`cursor-pointer transition-all hover:border-primary ${selectedAssistantId === a.id ? 'border-primary bg-primary/5' : ''}`}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium truncate">{a.name}</h4>
                                <p className="text-xs text-muted-foreground mt-1">{a.model}</p>
                                <p className="text-xs text-muted-foreground">Voice: {a.voice}</p>
                              </div>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); handleEditAssistant(a); }}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={(e) => { e.stopPropagation(); handleDeleteAssistant(a.id); }}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                            {a.firstMessage && (
                              <p className="text-xs text-muted-foreground mt-2 line-clamp-2">"{a.firstMessage}"</p>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Phone Numbers Tab */}
            <TabsContent value="phones">
              <Card>
                <CardHeader>
                  <CardTitle>Phone Numbers</CardTitle>
                  <CardDescription>Your configured phone numbers for outbound calls</CardDescription>
                </CardHeader>
                <CardContent>
                  {phoneNumbers.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No phone numbers configured. Contact support to add numbers.</p>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {phoneNumbers.map((p) => (
                        <Card key={p.id}>
                          <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                                <Phone className="h-5 w-5 text-primary" />
                              </div>
                              <div>
                                <h4 className="font-medium">{p.number}</h4>
                                <p className="text-xs text-muted-foreground">{p.name || p.provider || 'Phone Number'}</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Bulk Calls Tab */}
            <TabsContent value="bulk">
              <div className="grid gap-6 lg:grid-cols-3">
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Select Leads</CardTitle>
                        <CardDescription>Choose leads with phone numbers for bulk calling</CardDescription>
                      </div>
                      <Button variant="outline" size="sm" onClick={selectAllLeads}>
                        {selectedLeadIds.size === leads.length ? 'Deselect All' : 'Select All'}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {leads.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">No leads with phone numbers found. Add leads in the CRM first.</p>
                    ) : (
                      <ScrollArea className="h-[400px]">
                        <div className="space-y-2">
                          {leads.map((lead) => {
                            const callStatus = bulkCallStatuses.get(lead.id);
                            return (
                              <div
                                key={lead.id}
                                className={`flex items-center justify-between p-3 rounded-lg border ${
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
                                    <>
                                      {callStatus.status === 'pending' && <Clock className="h-4 w-4 text-muted-foreground" />}
                                      {callStatus.status === 'calling' && <Loader2 className="h-4 w-4 text-primary animate-spin" />}
                                      {callStatus.status === 'completed' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                                      {callStatus.status === 'failed' && <XCircle className="h-4 w-4 text-destructive" />}
                                    </>
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
                      <Select value={bulkAssistantId} onValueChange={setBulkAssistantId} disabled={isBulkCalling}>
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
                      <Select value={bulkPhoneNumberId} onValueChange={setBulkPhoneNumberId} disabled={isBulkCalling}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a phone number" />
                        </SelectTrigger>
                        <SelectContent>
                          {phoneNumbers.map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.number}</SelectItem>
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
                        disabled={isBulkCalling || selectedLeadIds.size === 0 || !bulkAssistantId || !bulkPhoneNumberId}
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

                    {bulkCallStatuses.size > 0 && (
                      <div className="pt-4 border-t space-y-2">
                        <p className="text-sm font-medium">Call Progress</p>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <div className="flex justify-between">
                            <span>Completed:</span>
                            <span>{Array.from(bulkCallStatuses.values()).filter(s => s.status === 'completed').length}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Failed:</span>
                            <span>{Array.from(bulkCallStatuses.values()).filter(s => s.status === 'failed').length}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Pending:</span>
                            <span>{Array.from(bulkCallStatuses.values()).filter(s => s.status === 'pending').length}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Call History Tab */}
            <TabsContent value="history">
              <Card>
                <CardHeader>
                  <CardTitle>Call History</CardTitle>
                  <CardDescription>Recent voice agent calls - click a row to view transcript</CardDescription>
                </CardHeader>
                <CardContent>
                  {calls.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No calls yet</p>
                  ) : (
                    <div className="space-y-2">
                      {calls.map((call) => (
                        <Collapsible
                          key={call.id}
                          open={expandedCallIds.has(call.id)}
                          onOpenChange={() => toggleTranscript(call.id)}
                        >
                          <div className="border rounded-lg overflow-hidden">
                            <CollapsibleTrigger asChild>
                              <div className="flex items-center justify-between p-4 hover:bg-muted/50 cursor-pointer">
                                <div className="flex items-center gap-4 flex-1">
                                  <div className="flex items-center gap-2 min-w-[120px]">
                                    {call.type === 'outboundPhoneCall' ? <PhoneOutgoing className="h-4 w-4" /> : call.type === 'inboundPhoneCall' ? <PhoneIncoming className="h-4 w-4" /> : <Phone className="h-4 w-4" />}
                                    <span className="text-sm capitalize">{call.type?.replace(/([A-Z])/g, ' $1').trim() || 'Web'}</span>
                                  </div>
                                  <Badge variant={call.status === 'ended' ? 'default' : 'secondary'} className="capitalize">
                                    {call.status}
                                  </Badge>
                                  <span className="text-sm text-muted-foreground">
                                    {call.customer?.number || call.customer?.name || '-'}
                                  </span>
                                  <span className="text-sm">{formatDuration(call.duration)}</span>
                                  <span className="text-sm text-muted-foreground">
                                    {new Date(call.createdAt).toLocaleDateString()}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  {call.recordingUrl && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 w-8 p-0"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handlePlayRecording(call);
                                      }}
                                    >
                                      {playingCallId === call.id ? (
                                        <Pause className="h-4 w-4 text-primary" />
                                      ) : (
                                        <Play className="h-4 w-4" />
                                      )}
                                    </Button>
                                  )}
                                  {call.transcript && (
                                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                                  )}
                                  {expandedCallIds.has(call.id) ? (
                                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                  )}
                                </div>
                              </div>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className="border-t bg-muted/30 p-4">
                                {call.summary && (
                                  <div className="mb-4">
                                    <p className="text-sm font-medium mb-1">Summary</p>
                                    <p className="text-sm text-muted-foreground">{call.summary}</p>
                                  </div>
                                )}
                                <div>
                                  <p className="text-sm font-medium mb-2">Transcript</p>
                                  {call.transcript ? (
                                    <ScrollArea className="h-[200px] rounded-md border bg-background p-3">
                                      <pre className="text-sm whitespace-pre-wrap font-sans">
                                        {call.transcript}
                                      </pre>
                                    </ScrollArea>
                                  ) : (
                                    <p className="text-sm text-muted-foreground italic">No transcript available for this call</p>
                                  )}
                                </div>
                              </div>
                            </CollapsibleContent>
                          </div>
                        </Collapsible>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Analytics Tab */}
            <TabsContent value="analytics">
              <AnalyticsCharts analytics={analytics} calls={calls} />
            </TabsContent>
          </Tabs>
        </main>
        <Footer />
      </div>
    </ProtectedRoute>
  );
};

export default VoiceAgents;
