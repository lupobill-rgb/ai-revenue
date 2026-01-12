import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Phone, PhoneOff, Mic, MicOff, RefreshCw, AlertCircle, Loader2, Plus, Trash2, Edit, PhoneCall, Clock, BarChart3, Users, PhoneIncoming, PhoneOutgoing, Play, Pause, Volume2, ChevronDown, ChevronUp, MessageSquare, Zap, CheckCircle2, XCircle, Database, Settings } from "lucide-react";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useVapiConversation } from "@/hooks/useVapiConversation";
import { useVoiceDataQualityStatus } from "@/hooks/useVoiceDataQualityStatus";
import { useWorkspaceContext } from "@/contexts/WorkspaceContext";
import { DataQualityBanner } from "@/components/DataQualityBadge";
import { VoiceSetupStatusSimple } from "@/components/VoiceSetupStatusSimple";
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
import { normalizeError } from "@/lib/normalizeError";
import { getVoiceBannerType, shouldDisableVoiceActions, type VoiceBannerInput } from "@/lib/voiceBannerLogic";

// VAPI removed - using ElevenLabs directly
const VAPI_PUBLIC_KEY = import.meta.env.VITE_VAPI_PUBLIC_KEY || "";

interface ElevenLabsAgent {
  agent_id: string;
  name: string;
  created_at?: string;
  first_message?: string;
  system_prompt?: string;
}

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
  const navigate = useNavigate();
  const [assistants, setAssistants] = useState<VapiAssistant[]>([]);
  const [phoneNumbers, setPhoneNumbers] = useState<VapiPhoneNumber[]>([]);
  const [calls, setCalls] = useState<VapiCall[]>([]);
  const [analytics, setAnalytics] = useState<VapiAnalytics | null>(null);
  const [selectedAssistantId, setSelectedAssistantId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [activeTab, setActiveTab] = useState("call");
  
  // Track paywall/upgrade-required errors separately for first-class UI
  const [upgradeRequired, setUpgradeRequired] = useState(false);
  // Track statusCode for banner logic
  const [errorStatusCode, setErrorStatusCode] = useState<number | null>(null);
  
  // CANONICAL VOICE DATA QUALITY GATING (uses dedicated hook)
  const { workspaceId, toggleDemoMode } = useWorkspaceContext();
  const { 
    status: voiceDataQualityStatus, 
    isDemoMode: demoMode, 
    voiceConnected, 
    canShowVoiceMetrics: canShowVoiceKPIs 
  } = useVoiceDataQualityStatus(workspaceId);

  // Banner logic using pure helper function
  const bannerInput: VoiceBannerInput = {
    demoMode,
    voiceConnected,
    statusCode: errorStatusCode,
  };
  const bannerType = getVoiceBannerType(bannerInput);
  const voiceActionsDisabled = shouldDisableVoiceActions(bannerInput);

  // GATING RULES (NON-NEGOTIABLE):
  // - demoMode = false: NEVER use SAMPLE_* under any condition
  // - demoMode = true: SAMPLE_* allowed only when real data is absent
  const showSamples = demoMode === true;

  // When upgrade required in live mode, also show zeros/empty
  const effectiveVoiceConnected = voiceConnected && !upgradeRequired;

  const ZERO_ANALYTICS: VapiAnalytics = {
    totalCalls: 0,
    completedCalls: 0,
    totalDurationMinutes: 0,
    averageCallDuration: 0,
    callsByType: {},
    callsByStatus: {},
  };

  const displayAnalytics: VapiAnalytics = useMemo(() => {
    // Demo mode: sample only if analytics is null/undefined
    if (showSamples) return analytics ?? SAMPLE_ANALYTICS;

    // Live mode: disconnected or upgrade required => zeros
    if (!effectiveVoiceConnected) return ZERO_ANALYTICS;

    // Live mode + connected: real only, but never null in UI
    return analytics ?? ZERO_ANALYTICS;
  }, [showSamples, effectiveVoiceConnected, analytics]);

  const displayCalls = showSamples
    ? (calls.length ? calls : SAMPLE_CALLS)
    : (effectiveVoiceConnected ? calls : []);

  const displayAssistants = showSamples
    ? (assistants.length ? assistants : SAMPLE_ASSISTANTS)
    : (effectiveVoiceConnected ? assistants : []);

  const displayPhoneNumbers = showSamples
    ? (phoneNumbers.length ? phoneNumbers : SAMPLE_PHONE_NUMBERS)
    : (effectiveVoiceConnected ? phoneNumbers : []);

  // Legacy banner trigger (kept for reference, now using bannerType)
  const showVoiceSetupBanner = !demoMode && !voiceConnected;

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

  // Auto-provisioning state
  const [isAutoProvisioning, setIsAutoProvisioning] = useState(false);
  const [hasCheckedProvisioning, setHasCheckedProvisioning] = useState(false);

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

  // VAPI conversation hook disabled - using ElevenLabs direct API calls
  // Keep these as stubs for backward compatibility
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState<any>("");
  const error = null;
  const startCall = async (assistantId?: string) => {
    console.log('VAPI startCall disabled - use ElevenLabs direct integration');
    toast.info('Voice calling via ElevenLabs - use campaign execution instead');
  };
  const endCall = () => {
    console.log('VAPI endCall disabled');
  };
  const setVolume = (vol: number) => {
    console.log('VAPI setVolume disabled');
  };
  
  /* Old VAPI hook - kept for reference
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
    onError: (message) => {
      if (!message.toLowerCase().includes('upgrade')) {
        toast.error(message);
      }
    },
    onErrorPayload: (payload) => {
      setErrorStatusCode(payload.statusCode);
      if (payload.statusCode === 402) {
        setUpgradeRequired(true);
      }
    },
  });
  */

  const fetchAllData = async () => {
    setIsLoading(true);
    setUpgradeRequired(false); // Reset on refetch
    setErrorStatusCode(null); // Reset status code
    try {
      // CRITICAL: Build leads query with workspace_id filter to prevent cross-workspace data leak
      let leadsQuery = supabase
        .from('leads')
        .select('id, first_name, last_name, phone, company, status')
        .not('phone', 'is', null)
        .limit(100);
      
      if (workspaceId) {
        leadsQuery = leadsQuery.eq('workspace_id', workspaceId);
      }
      
      const [assistantsRes, phoneNumbersRes, callsRes, analyticsRes, leadsRes, campaignsRes] = await Promise.all([
        // Using ElevenLabs directly instead of VAPI
        supabase.functions.invoke('elevenlabs-list-agents'),
        // Keeping phone numbers and calls for now (can be removed later)
        supabase.functions.invoke('vapi-list-phone-numbers'),
        supabase.functions.invoke('vapi-list-calls', { body: { limit: 50 } }),
        supabase.functions.invoke('vapi-analytics'),
        leadsQuery,
        supabase.from('assets').select('id, name, status, goal, content, created_at').eq('type', 'voice').in('status', ['approved', 'review']).order('created_at', { ascending: false }),
      ]);

      // Check for 402/paywall errors in any response
      const checkPaywall = (res: any): number | null => {
        const code = res?.error?.statusCode ?? res?.data?.statusCode ?? null;
        if (code === 402) {
          setUpgradeRequired(true);
          setErrorStatusCode(402);
        }
        return code;
      };

      // Check all responses for paywall
      [assistantsRes, phoneNumbersRes, callsRes, analyticsRes].forEach(checkPaywall);

      // Handle ElevenLabs agents response
      if (assistantsRes.data?.agents) {
        // Convert ElevenLabs agents to assistant format
        const elevenLabsAgents = assistantsRes.data.agents.map((agent: any) => ({
          id: agent.id || agent.agent_id, // Support both 'id' and 'agent_id' fields
          name: agent.name || 'Unnamed Agent',
          firstMessage: agent.first_message || '',
          model: 'elevenlabs',
          voice: 'elevenlabs',
          createdAt: agent.created_at || new Date().toISOString(),
        }));
        
        console.log('✅ Loaded ElevenLabs agents:', elevenLabsAgents);
        
        setAssistants(elevenLabsAgents);
        
        // Check if current selected assistant still exists
        const currentAssistantExists = selectedAssistantId && 
          elevenLabsAgents.some((a: VapiAssistant) => a.id === selectedAssistantId);
        
        // Auto-select first assistant if none selected OR current one doesn't exist
        if (elevenLabsAgents.length > 0) {
          if (!selectedAssistantId || !currentAssistantExists) {
            setSelectedAssistantId(elevenLabsAgents[0].id);
            if (!currentAssistantExists && selectedAssistantId) {
              console.log('Previously selected assistant no longer exists, switching to:', elevenLabsAgents[0].name);
            }
          }
        } else {
          // No assistants available, clear selection
          setSelectedAssistantId("");
        }
      } else if (assistantsRes.data?.assistants) {
        // Fallback: Handle old VAPI format if still present
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
    } catch (error: any) {
      console.error('Error fetching Vapi data:', error);
      const statusCode = error?.statusCode ?? null;
      setErrorStatusCode(statusCode);
      
      // Check if catch block error is 402
      if (statusCode === 402 || normalizeError(error).toLowerCase().includes('upgrade')) {
        setUpgradeRequired(true);
        setErrorStatusCode(402);
      } else {
        toast.error('Failed to load voice agent data');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-provision agents if none exist
  const checkAndProvisionAgents = async () => {
    console.log('🔍 checkAndProvisionAgents called', {
      workspaceId,
      hasCheckedProvisioning,
      isAutoProvisioning
    });

    if (!workspaceId) {
      console.warn('⚠️ No workspaceId available yet');
      return;
    }

    if (hasCheckedProvisioning) {
      console.log('ℹ️ Already checked provisioning, skipping');
      return;
    }

    if (isAutoProvisioning) {
      console.log('ℹ️ Already provisioning, skipping');
      return;
    }

    setHasCheckedProvisioning(true);
    console.log('🚀 Starting auto-provision check for workspace:', workspaceId);

    try {
      // Check if workspace has any agents
      const { data: existingAgents, error: checkError } = await supabase
        .from('voice_agents')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('status', 'active');

      console.log('📊 Check results:', {
        existingAgents,
        error: checkError,
        count: existingAgents?.length || 0
      });

      if (checkError) {
        console.error('❌ Error checking agents:', checkError);
        // If table doesn't exist, try to provision anyway
        if (checkError.code !== 'PGRST116') {
          // Not a "table doesn't exist" error, so skip provisioning
          return;
        }
        console.log('📝 Table might not exist, will try to provision anyway');
      }

      // If agents exist, no need to provision
      if (existingAgents && existingAgents.length > 0) {
        console.log('✅ Agents already exist, skipping auto-provision');
        toast.success(`Found ${existingAgents.length} existing voice agents`, { duration: 2000 });
        return;
      }

      // No agents found - auto-provision them!
      console.log('🤖 No agents found, auto-provisioning now...');
      setIsAutoProvisioning(true);
      
      toast.loading('Creating voice agents...', { id: 'auto-provision' });

      const { data: provisionData, error: provisionError } = await supabase.functions.invoke(
        'elevenlabs-auto-provision',
        {
          body: { workspace_id: workspaceId },
        }
      );

      console.log('📦 Provision response:', { provisionData, provisionError });

      if (provisionError) {
        console.error('❌ Auto-provision error:', provisionError);
        toast.error('Failed to create voice agents. Please try again.', { id: 'auto-provision' });
        return;
      }

      if (provisionData?.success) {
        const agentCount = provisionData.agents?.length || 0;
        console.log(`✅ Auto-provisioned ${agentCount} agents successfully!`);
        
        toast.success(
          `🎉 Voice agents created! ${agentCount} agents ready to call.`,
          { id: 'auto-provision', duration: 5000 }
        );

        // Refresh data to show new agents
        console.log('🔄 Refreshing data to show new agents...');
        await fetchAllData();
      } else {
        console.warn('⚠️ Auto-provision returned but not successful:', provisionData);
        toast.info('Voice agents setup in progress...', { id: 'auto-provision' });
      }
    } catch (error) {
      console.error('💥 Exception during auto-provision:', error);
      toast.error(`Setup error: ${error instanceof Error ? error.message : 'Unknown error'}`, { id: 'auto-provision' });
    } finally {
      setIsAutoProvisioning(false);
      console.log('✓ Auto-provision check complete');
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  useEffect(() => {
    if (workspaceId && !isLoading && !hasCheckedProvisioning) {
      checkAndProvisionAgents();
    }
  }, [workspaceId, isLoading, hasCheckedProvisioning]);

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
              model: newAssistant.model,
              messages: [{ role: "system", content: newAssistant.systemPrompt }],
            },
            voice: { voiceId: newAssistant.voice },
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
              model: editingAssistant.model,
              messages: [{ role: "system", content: editingAssistant.systemPrompt }],
            },
            voice: { voiceId: editingAssistant.voice },
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

  const selectedAssistant = displayAssistants.find(a => a.id === selectedAssistantId);

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

  // VAPI check removed - using ElevenLabs directly
  // ElevenLabs API key is configured in Supabase secrets

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

          {/* Banner rendering using pure helper logic */}
          {bannerType === 'UPGRADE_REQUIRED' && (
            <Alert className="mb-6 border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-800 dark:text-amber-200">Upgrade Required</AlertTitle>
              <AlertDescription className="text-amber-700 dark:text-amber-300">
                <p className="mb-3">Your plan doesn't include Voice Agents or you hit a usage limit.</p>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    onClick={() => navigate('/settings')}
                    className="bg-amber-600 hover:bg-amber-700"
                  >
                    View Plans
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => navigate('/settings/integrations')}
                    className="border-amber-500 text-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900"
                  >
                    <Settings className="h-4 w-4 mr-1" />
                    Connect Keys
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Generic error alert (non-402 errors) */}
          {error && bannerType !== 'UPGRADE_REQUIRED' && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Voice Data Quality Banner - using bannerType */}
          {bannerType === 'DEMO_MODE' && (
            <DataQualityBanner status="DEMO_MODE" />
          )}
          
          {/* Smart Voice Setup Status - Simplified version */}
          <VoiceSetupStatusSimple />

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
              <TabsTrigger value="agents" className="gap-2">
                <Users className="h-4 w-4" />
                Agents ({displayAssistants.length})
              </TabsTrigger>
              <TabsTrigger value="phones" className="gap-2">
                <Phone className="h-4 w-4" />
                Numbers ({displayPhoneNumbers.length})
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-2">
                <Clock className="h-4 w-4" />
                History ({displayCalls.length})
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
                              {displayAssistants.map((a) => (
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
                              {displayPhoneNumbers.map((p) => (
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
                    <div className="space-y-3">
                      <Label>Choose Your Agent</Label>
                      {displayAssistants.length === 0 ? (
                        <div className="text-center py-6 text-muted-foreground text-sm">
                          No agents available. Go to the Agents tab to create one.
                        </div>
                      ) : (
                        <div className="grid gap-3">
                          {displayAssistants.map((a) => (
                            <div
                              key={a.id}
                              onClick={() => status !== 'connected' && setSelectedAssistantId(a.id)}
                              className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
                                selectedAssistantId === a.id 
                                  ? 'border-primary bg-primary/5 shadow-sm' 
                                  : 'border-border hover:border-primary/50 hover:bg-accent'
                              } ${status === 'connected' ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              <div className="flex items-start gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                  selectedAssistantId === a.id ? 'bg-primary text-primary-foreground' : 'bg-muted'
                                }`}>
                                  <Phone className="h-5 w-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-medium text-sm">{a.name}</h4>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {a.firstMessage ? a.firstMessage.substring(0, 60) + (a.firstMessage.length > 60 ? '...' : '') : 'Ready to call'}
                                  </p>
                                  <div className="flex gap-2 mt-2">
                                    <Badge variant="outline" className="text-xs">
                                      {a.model === 'elevenlabs' ? 'ElevenLabs' : a.model}
                                    </Badge>
                                    {selectedAssistantId === a.id && (
                                      <Badge variant="default" className="text-xs">
                                        <CheckCircle2 className="h-3 w-3 mr-1" />
                                        Selected
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
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
                  ) : displayAssistants.length === 0 ? (
                    <div className="flex flex-col items-center gap-4 py-8">
                      <p className="text-center text-muted-foreground">No voice agents found</p>
                      <Button
                        onClick={() => {
                          setHasCheckedProvisioning(false);
                          checkAndProvisionAgents();
                        }}
                        disabled={isAutoProvisioning}
                        className="gap-2"
                      >
                        {isAutoProvisioning ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Creating Agents...
                          </>
                        ) : (
                          <>
                            <Zap className="h-4 w-4" />
                            Create Default Agents
                          </>
                        )}
                      </Button>
                      <p className="text-xs text-muted-foreground">This will create 3 ready-to-use voice agents</p>
                    </div>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {displayAssistants.map((a) => (
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
                  {displayPhoneNumbers.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No phone numbers configured. Contact support to add numbers.</p>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {displayPhoneNumbers.map((p) => (
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

            {/* Call History Tab */}
            <TabsContent value="history">
              <Card>
                <CardHeader>
                  <CardTitle>Call History</CardTitle>
                  <CardDescription>Recent voice agent calls - click a row to view transcript</CardDescription>
                </CardHeader>
                <CardContent>
                  {displayCalls.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No calls yet</p>
                  ) : (
                    <div className="space-y-2">
                      {displayCalls.map((call) => (
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
              <AnalyticsCharts analytics={displayAnalytics} calls={displayCalls} />
            </TabsContent>
          </Tabs>
        </main>
        <Footer />
      </div>
    </ProtectedRoute>
  );
};

export default VoiceAgents;
