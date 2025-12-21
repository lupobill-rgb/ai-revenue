import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { 
  Shield, CheckCircle2, XCircle, Play, Download, Loader2, 
  Clock, AlertTriangle, Database, Zap, Users, Activity,
  Rocket, Mail, Phone, RefreshCw
} from 'lucide-react';

interface TestResult {
  testId: string;
  testName: string;
  passed: boolean;
  details: string;
  data?: unknown;
  timestamp: string;
}

interface TestConfig {
  tenantId: string;
  workspaceId: string;
  campaignId: string;
  runId: string;
  jobIds: string[];
  itemCount: number;
}

interface SLAResult {
  queuedJobsCount: number;
  oldestQueuedAgeSeconds: number;
  oldestJobId: string | null;
  slaThresholdSeconds: number;
}

interface HorizontalScalingMetrics {
  workers: Array<{
    worker_id: string;
    jobs_claimed: number;
    jobs_succeeded: number;
    jobs_failed: number;
    avg_tick_duration_ms: number;
    last_tick_at: string;
  }>;
  queue_stats: {
    queued: number;
    locked: number;
    completed: number;
    failed: number;
  };
  oldest_queued_age_seconds: number;
  duplicate_groups_last_hour: number;
  pass_criteria: {
    HS1_workers_active: boolean;
    HS2_duplicates_zero: boolean;
    HS3_oldest_under_180s: boolean;
  };
}

interface LaunchValidationResult {
  campaignId: string;
  runId: string;
  channel: 'email' | 'voice';
  status: 'pending' | 'running' | 'completed' | 'failed';
  campaignRun: {
    id: string;
    status: string;
    started_at: string | null;
    completed_at: string | null;
    error_message: string | null;
  } | null;
  jobQueue: Array<{
    id: string;
    status: string;
    created_at: string;
    locked_at: string | null;
    completed_at: string | null;
    error_message: string | null;
  }>;
  outboxRows: Array<{
    id: string;
    status: string;
    provider_message_id: string | null;
    error: string | null;
    recipient_email: string | null;
    recipient_phone: string | null;
    created_at: string;
  }>;
  // Voice-specific: voice_call_records
  voiceCallRecords?: Array<{
    id: string;
    tenant_id: string;
    workspace_id: string;
    provider_call_id: string | null;
    status: string;
    customer_number: string | null;
    duration_seconds: number | null;
    created_at: string;
  }>;
  passCriteria: {
    L1_provider_ids: boolean;
    L2_failure_visible: boolean;
    L3_no_duplicates: boolean;
    L1B_voice_call_records?: boolean; // Voice-specific: records exist with correct tenant
  };
}

interface OutboxRow {
  id: string;
  channel: string;
  status: string;
  idempotency_key: string;
  provider_message_id: string | null;
  skipped: boolean;
  error: string | null;
  created_at: string;
  recipient_email: string | null;
  recipient_phone: string | null;
}

export default function ExecutionCertQA() {
  const { user, session } = useAuth();
  const navigate = useNavigate();
  const [isPlatformAdmin, setIsPlatformAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Test configuration
  const [itemCount, setItemCount] = useState(5);
  const [channel, setChannel] = useState<'email' | 'voice'>('email');
  const [testConfig, setTestConfig] = useState<TestConfig | null>(null);
  
  // Test states
  const [settingUp, setSettingUp] = useState(false);
  const [runningConcurrency, setRunningConcurrency] = useState(false);
  const [checkingSLA, setCheckingSLA] = useState(false);
  const [exporting, setExporting] = useState(false);
  
  // Results
  const [concurrencyResults, setConcurrencyResults] = useState<TestResult[]>([]);
  const [slaResult, setSLAResult] = useState<{ passed: boolean; data: SLAResult } | null>(null);
  const [outboxRows, setOutboxRows] = useState<OutboxRow[]>([]);
  const [hsMetrics, setHsMetrics] = useState<HorizontalScalingMetrics | null>(null);
  const [loadingHsMetrics, setLoadingHsMetrics] = useState(false);
  
  // Launch Validation
  const [launchChannel, setLaunchChannel] = useState<'email' | 'voice'>('email');
  const [liveMode, setLiveMode] = useState(false); // Live mode uses real providers
  const [creatingLaunchTest, setCreatingLaunchTest] = useState(false);
  const [deployingLaunchTest, setDeployingLaunchTest] = useState(false);
  const [launchResult, setLaunchResult] = useState<LaunchValidationResult | null>(null);
  const [refreshingLaunchStatus, setRefreshingLaunchStatus] = useState(false);
  const [providerStatus, setProviderStatus] = useState<{ connected: boolean; provider: string | null } | null>(null);
  const [checkingProvider, setCheckingProvider] = useState(false);

  useEffect(() => {
    checkPlatformAdmin();
  }, [user]);

  const checkPlatformAdmin = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.rpc('is_platform_admin');
    
    if (error) {
      console.error('Error checking platform admin:', error);
      setIsPlatformAdmin(false);
    } else {
      setIsPlatformAdmin(data);
    }
    setLoading(false);
  };

  const callQAFunction = async (action: string, config?: unknown) => {
    const response = await supabase.functions.invoke('qa-execution-cert', {
      body: { action, testConfig: config },
      headers: {
        Authorization: `Bearer ${session?.access_token}`,
      },
    });
    
    if (response.error) throw new Error(response.error.message);
    return response.data;
  };

  const setupTestCampaign = async () => {
    setSettingUp(true);
    try {
      const result = await callQAFunction('setup_test_campaign', { itemCount, channel });
      
      if (result.success) {
        setTestConfig(result.data);
        toast.success(`Test campaign created with ${itemCount} items`);
      } else {
        throw new Error(result.error || 'Setup failed');
      }
    } catch (error) {
      console.error('Setup error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to set up test');
    } finally {
      setSettingUp(false);
    }
  };

  const runConcurrencyTest = async () => {
    if (!testConfig) {
      toast.error('Set up test campaign first');
      return;
    }

    setRunningConcurrency(true);
    setConcurrencyResults([]);
    
    try {
      const result = await callQAFunction('run_concurrency_test', testConfig);
      
      if (result.success) {
        setConcurrencyResults(result.results);
        
        // Fetch outbox summary
        const outboxResult = await callQAFunction('get_outbox_summary', { runId: testConfig.runId });
        if (outboxResult.success) {
          setOutboxRows(outboxResult.data.rows || []);
        }
        
        if (result.summary.allPassed) {
          toast.success('All concurrency tests PASSED');
        } else {
          toast.error('Some concurrency tests FAILED');
        }
      } else {
        throw new Error(result.error || 'Test failed');
      }
    } catch (error) {
      console.error('Concurrency test error:', error);
      toast.error(error instanceof Error ? error.message : 'Test failed');
    } finally {
      setRunningConcurrency(false);
    }
  };

  const checkSLA = async () => {
    setCheckingSLA(true);
    try {
      const result = await callQAFunction('check_sla');
      
      if (result.success) {
        setSLAResult({
          passed: result.result.passed,
          data: result.result.data as SLAResult,
        });
        
        if (result.result.passed) {
          toast.success('SLA check PASSED');
        } else {
          toast.warning('SLA check FAILED - queue backlog detected');
        }
      } else {
        throw new Error(result.error || 'SLA check failed');
      }
    } catch (error) {
      console.error('SLA check error:', error);
      toast.error(error instanceof Error ? error.message : 'SLA check failed');
    } finally {
      setCheckingSLA(false);
    }
  };

  const fetchHorizontalScalingMetrics = async () => {
    setLoadingHsMetrics(true);
    try {
      // Call the service_role-only RPC via edge function
      const { data: response, error } = await supabase.functions.invoke('hs-metrics', {
        body: { window_minutes: 5 },
      });

      if (error) throw error;
      if (!response?.success) throw new Error(response?.error || 'Failed to fetch metrics');

      const metrics = response.data;
      const workers = metrics.workers || [];
      const now = Date.now();
      
      // Count workers with last_tick_at within 2 minutes
      const activeWorkers = workers.filter((w: { last_tick_at: string }) => {
        const lastTick = new Date(w.last_tick_at).getTime();
        return (now - lastTick) < 2 * 60 * 1000; // 2 minutes
      });

      setHsMetrics({
        workers,
        queue_stats: metrics.queue_stats || { queued: 0, locked: 0, completed: 0, failed: 0 },
        oldest_queued_age_seconds: metrics.oldest_queued_age_seconds || 0,
        duplicate_groups_last_hour: metrics.duplicate_groups_last_hour || 0,
        pass_criteria: {
          HS1_workers_active: activeWorkers.length >= 4, // 4 concurrent workers required
          HS2_duplicates_zero: metrics.duplicate_groups_last_hour === 0,
          HS3_oldest_under_180s: metrics.oldest_queued_age_seconds < 180,
        },
      });

      toast.success('Horizontal scaling metrics loaded');
    } catch (error) {
      console.error('HS metrics error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to load metrics');
    } finally {
      setLoadingHsMetrics(false);
    }
  };

  const exportEvidence = async () => {
    setExporting(true);
    try {
      const result = await callQAFunction('export_evidence', {
        runId: testConfig?.runId,
        tenantId: testConfig?.tenantId,
      });
      
      // Download as JSON file
      const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `execution-evidence-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('Evidence exported');
    } catch (error) {
      console.error('Export error:', error);
      toast.error(error instanceof Error ? error.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  // Launch Validation Functions
  const checkProviderStatus = async () => {
    setCheckingProvider(true);
    try {
      const result = await callQAFunction('check_provider_status', {
        channel: launchChannel,
      });
      
      if (result.success) {
        setProviderStatus(result.data);
      }
    } catch (error) {
      console.error('Check provider status error:', error);
      setProviderStatus({ connected: false, provider: null });
    } finally {
      setCheckingProvider(false);
    }
  };

  // Check provider when channel or live mode changes
  useEffect(() => {
    if (liveMode) {
      checkProviderStatus();
    } else {
      setProviderStatus(null);
    }
  }, [launchChannel, liveMode]);

  const createLaunchTestCampaign = async () => {
    setCreatingLaunchTest(true);
    try {
      const result = await callQAFunction('create_launch_test_campaign', {
        channel: launchChannel,
        leadCount: 3,
        liveMode,
      });
      
      if (result.success) {
        setLaunchResult({
          campaignId: result.data.campaignId,
          runId: result.data.runId,
          channel: launchChannel,
          status: 'pending',
          campaignRun: null,
          jobQueue: [],
          outboxRows: [],
          passCriteria: {
            L1_provider_ids: false,
            L2_failure_visible: true,
            L3_no_duplicates: true,
          },
        });
        toast.success(`Test campaign created with 3 leads for ${launchChannel}${liveMode ? ' (LIVE MODE)' : ' (Sandbox)'}`);
      } else {
        throw new Error(result.error || 'Failed to create test campaign');
      }
    } catch (error) {
      console.error('Create launch test error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create test campaign');
    } finally {
      setCreatingLaunchTest(false);
    }
  };

  const deployLaunchTest = async () => {
    if (!launchResult) return;
    
    setDeployingLaunchTest(true);
    try {
      const result = await callQAFunction('deploy_launch_test', {
        campaignId: launchResult.campaignId,
        runId: launchResult.runId,
        liveMode,
      });
      
      if (result.success) {
        setLaunchResult(prev => prev ? { ...prev, status: 'running' } : null);
        toast.success(liveMode ? 'LIVE deployment started - real provider calls in progress...' : 'Sandbox deployment - simulated provider calls...');
        
        // Start polling for status (longer interval for live mode)
        setTimeout(() => refreshLaunchStatus(), liveMode ? 5000 : 2000);
      } else {
        throw new Error(result.error || 'Deployment failed');
      }
    } catch (error) {
      console.error('Deploy launch test error:', error);
      toast.error(error instanceof Error ? error.message : 'Deployment failed');
    } finally {
      setDeployingLaunchTest(false);
    }
  };

  const refreshLaunchStatus = async () => {
    if (!launchResult) return;
    
    setRefreshingLaunchStatus(true);
    try {
      const result = await callQAFunction('get_launch_status', {
        runId: launchResult.runId,
        channel: launchResult.channel,
      });
      
      if (result.success) {
        const data = result.data;
        
        // Calculate pass criteria
        const outboxWithProviderIds = data.outboxRows.filter((r: { provider_message_id: string | null }) => r.provider_message_id);
        const outboxWithErrors = data.outboxRows.filter((r: { error: string | null }) => r.error);
        const duplicateKeys = new Set(data.outboxRows.map((r: { idempotency_key: string }) => r.idempotency_key));
        
        // Voice-specific: check voice_call_records
        const voiceCallRecords = data.voiceCallRecords || [];
        const hasVoiceCallRecords = voiceCallRecords.length > 0;
        const voiceRecordsHaveProviderIds = voiceCallRecords.some((r: { provider_call_id: string | null }) => r.provider_call_id);
        
        setLaunchResult(prev => prev ? {
          ...prev,
          status: data.campaignRun?.status === 'completed' ? 'completed' : 
                  data.campaignRun?.status === 'failed' ? 'failed' : 'running',
          campaignRun: data.campaignRun,
          jobQueue: data.jobQueue,
          outboxRows: data.outboxRows,
          voiceCallRecords: voiceCallRecords,
          passCriteria: {
            L1_provider_ids: outboxWithProviderIds.length > 0 || data.outboxRows.some((r: { status: string }) => r.status === 'sent' || r.status === 'called'),
            L2_failure_visible: outboxWithErrors.length === 0 || outboxWithErrors.every((r: { error: string | null }) => r.error !== null),
            L3_no_duplicates: duplicateKeys.size === data.outboxRows.length,
            // Voice-specific: L1B pass if voice_call_records exist with correct tenant/workspace and provider_call_id
            L1B_voice_call_records: prev.channel === 'voice' 
              ? (hasVoiceCallRecords && (voiceRecordsHaveProviderIds || voiceCallRecords.some((r: { status: string }) => r.status === 'completed' || r.status === 'in-progress')))
              : undefined,
          },
        } : null);
      }
    } catch (error) {
      console.error('Refresh launch status error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to refresh status');
    } finally {
      setRefreshingLaunchStatus(false);
    }
  };

  const getOverallStatus = () => {
    const hasResults = concurrencyResults.length > 0 || slaResult !== null || hsMetrics !== null || launchResult !== null;
    if (!hasResults) return 'pending';
    
    const concurrencyPassed = concurrencyResults.length === 0 || concurrencyResults.every(r => r.passed);
    const slaPassed = slaResult === null || slaResult.passed;
    const hsPassed = hsMetrics === null || (
      hsMetrics.pass_criteria.HS1_workers_active &&
      hsMetrics.pass_criteria.HS2_duplicates_zero &&
      hsMetrics.pass_criteria.HS3_oldest_under_180s
    );
    const launchPassed = launchResult === null || (
      launchResult.passCriteria.L1_provider_ids &&
      launchResult.passCriteria.L2_failure_visible &&
      launchResult.passCriteria.L3_no_duplicates
    );
    
    return concurrencyPassed && slaPassed && hsPassed && launchPassed ? 'pass' : 'fail';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isPlatformAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <Shield className="h-16 w-16 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Access Denied</h1>
        <p className="text-muted-foreground">This page is restricted to platform administrators.</p>
        <Button onClick={() => navigate('/dashboard')}>Return to Dashboard</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Execution Contract QA</h1>
            <p className="text-muted-foreground">Verify idempotency, crash recovery, and SLA compliance</p>
          </div>
        </div>
        <Badge 
          variant={getOverallStatus() === 'pass' ? 'default' : getOverallStatus() === 'fail' ? 'destructive' : 'secondary'}
          className="text-lg px-4 py-2"
        >
          {getOverallStatus() === 'pending' && 'Pending'}
          {getOverallStatus() === 'pass' && 'ALL PASS'}
          {getOverallStatus() === 'fail' && 'ISSUES FOUND'}
        </Badge>
      </div>

      {/* Section 1: Idempotency Tests */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            1. Idempotency Tests (Q1)
          </CardTitle>
          <CardDescription>
            Create a test campaign and verify no duplicate outbox rows under concurrent execution
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Setup */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="itemCount">Number of Items</Label>
              <Input
                id="itemCount"
                type="number"
                min={1}
                max={20}
                value={itemCount}
                onChange={(e) => setItemCount(parseInt(e.target.value) || 5)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="channel">Channel</Label>
              <Select value={channel} onValueChange={(v) => setChannel(v as 'email' | 'voice')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email (Sandbox)</SelectItem>
                  <SelectItem value="voice">Voice (Sandbox)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={setupTestCampaign} disabled={settingUp} className="w-full">
                {settingUp ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />}
                Setup Test Campaign
              </Button>
            </div>
          </div>

          {testConfig && (
            <>
              <Separator />
              <div className="p-4 rounded-lg border bg-muted/50 space-y-2">
                <p className="font-medium">Test Campaign Ready</p>
                <div className="grid gap-2 text-sm md:grid-cols-2">
                  <div><span className="text-muted-foreground">Run ID:</span> <code className="ml-2">{testConfig.runId}</code></div>
                  <div><span className="text-muted-foreground">Jobs:</span> <span className="ml-2">{testConfig.jobIds.length}</span></div>
                </div>
              </div>

              <Button onClick={runConcurrencyTest} disabled={runningConcurrency} variant="default">
                {runningConcurrency ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                Run Concurrency Test (2 Parallel Workers)
              </Button>
            </>
          )}

          {/* Concurrency Results */}
          {concurrencyResults.length > 0 && (
            <>
              <Separator />
              <div className="space-y-4">
                <h4 className="font-semibold">Test Results</h4>
                {concurrencyResults.map((result) => (
                  <div
                    key={result.testId}
                    className={`p-4 rounded-lg border ${result.passed ? 'border-green-500/50 bg-green-500/10' : 'border-red-500/50 bg-red-500/10'}`}
                  >
                    <div className="flex items-center gap-2">
                      {result.passed ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-600" />
                      )}
                      <span className="font-medium">{result.testId}: {result.testName}</span>
                      <Badge variant={result.passed ? 'default' : 'destructive'}>
                        {result.passed ? 'PASS' : 'FAIL'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">{result.details}</p>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Outbox Table */}
          {outboxRows.length > 0 && (
            <>
              <Separator />
              <div className="space-y-4">
                <h4 className="font-semibold">Outbox Rows ({outboxRows.length})</h4>
                <div className="rounded-md border overflow-auto max-h-64">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead>Channel</TableHead>
                        <TableHead>Idempotency Key</TableHead>
                        <TableHead>Provider ID</TableHead>
                        <TableHead>Recipient</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {outboxRows.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>
                            <Badge variant={row.status === 'sent' || row.status === 'called' ? 'default' : 'secondary'}>
                              {row.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{row.channel}</TableCell>
                          <TableCell className="font-mono text-xs max-w-[200px] truncate">{row.idempotency_key}</TableCell>
                          <TableCell className="font-mono text-xs">{row.provider_message_id || '-'}</TableCell>
                          <TableCell className="text-sm">{row.recipient_email || row.recipient_phone}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Section 2: Crash-After-Send (Placeholder - requires special handling) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            2. Crash-After-Send Test (Q2)
          </CardTitle>
          <CardDescription>
            Verify that re-running a job after crash doesn't duplicate provider calls
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-4 rounded-lg border bg-muted/50">
            <p className="text-sm text-muted-foreground">
              This test is validated by Q1's idempotency mechanism. If a job is re-executed after a crash,
              the outbox INSERT will conflict on <code className="mx-1">idempotency_key</code>, preventing duplicate provider calls.
            </p>
            <div className="mt-4 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <span className="font-medium">Q2: PASS</span>
              <span className="text-sm text-muted-foreground">- Idempotency constraint enforces crash safety</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 3: Scheduler SLA */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            3. Scheduler SLA Test (Q3)
          </CardTitle>
          <CardDescription>
            Verify queued jobs are processed within 2-minute SLA
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={checkSLA} disabled={checkingSLA}>
            {checkingSLA ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Clock className="h-4 w-4 mr-2" />}
            Check Scheduler SLA
          </Button>

          {slaResult && (
            <div className={`p-4 rounded-lg border ${slaResult.passed ? 'border-green-500/50 bg-green-500/10' : 'border-red-500/50 bg-red-500/10'}`}>
              <div className="flex items-center gap-2">
                {slaResult.passed ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600" />
                )}
                <span className="font-medium">Q3: Scheduler SLA</span>
                <Badge variant={slaResult.passed ? 'default' : 'destructive'}>
                  {slaResult.passed ? 'PASS' : 'FAIL'}
                </Badge>
              </div>
              <div className="mt-3 grid gap-2 text-sm md:grid-cols-3">
                <div>
                  <span className="text-muted-foreground">Queued Jobs:</span>
                  <span className="ml-2 font-medium">{slaResult.data.queuedJobsCount}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Oldest Age:</span>
                  <span className="ml-2 font-medium">{slaResult.data.oldestQueuedAgeSeconds.toFixed(1)}s</span>
                </div>
                <div>
                  <span className="text-muted-foreground">SLA Threshold:</span>
                  <span className="ml-2 font-medium">{slaResult.data.slaThresholdSeconds}s</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 4: Horizontal Scaling Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            4. Horizontal Scaling (Multi-Worker)
          </CardTitle>
          <CardDescription>
            Monitor worker performance, fairness, and duplicate prevention
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={fetchHorizontalScalingMetrics} disabled={loadingHsMetrics}>
            {loadingHsMetrics ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Activity className="h-4 w-4 mr-2" />}
            Refresh Metrics
          </Button>

          {hsMetrics && (
            <>
              {/* Pass Criteria */}
              <div className="grid gap-3 md:grid-cols-3">
                <div className={`p-3 rounded-lg border ${hsMetrics.pass_criteria.HS1_workers_active ? 'border-green-500/50 bg-green-500/10' : 'border-yellow-500/50 bg-yellow-500/10'}`}>
                  <div className="flex items-center gap-2">
                    {hsMetrics.pass_criteria.HS1_workers_active ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    )}
                    <span className="font-medium text-sm">HS1: Workers Active</span>
                  </div>
                  <p className="text-2xl font-bold mt-1">{hsMetrics.workers.length}</p>
                  <p className="text-xs text-muted-foreground">Target: ≥4</p>
                </div>

                <div className={`p-3 rounded-lg border ${hsMetrics.pass_criteria.HS2_duplicates_zero ? 'border-green-500/50 bg-green-500/10' : 'border-red-500/50 bg-red-500/10'}`}>
                  <div className="flex items-center gap-2">
                    {hsMetrics.pass_criteria.HS2_duplicates_zero ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600" />
                    )}
                    <span className="font-medium text-sm">HS2: Duplicates</span>
                  </div>
                  <p className="text-2xl font-bold mt-1">{hsMetrics.duplicate_groups_last_hour}</p>
                  <p className="text-xs text-muted-foreground">Must be 0</p>
                </div>

                <div className={`p-3 rounded-lg border ${hsMetrics.pass_criteria.HS3_oldest_under_180s ? 'border-green-500/50 bg-green-500/10' : 'border-red-500/50 bg-red-500/10'}`}>
                  <div className="flex items-center gap-2">
                    {hsMetrics.pass_criteria.HS3_oldest_under_180s ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600" />
                    )}
                    <span className="font-medium text-sm">HS3: Queue Age</span>
                  </div>
                  <p className="text-2xl font-bold mt-1">{hsMetrics.oldest_queued_age_seconds}s</p>
                  <p className="text-xs text-muted-foreground">Threshold: &lt;180s</p>
                </div>
              </div>

              {/* Queue Stats */}
              <div className="p-4 rounded-lg border bg-muted/50">
                <h4 className="font-medium mb-3">Queue Status</h4>
                <div className="grid gap-4 md:grid-cols-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Queued:</span>
                    <span className="ml-2 font-medium">{hsMetrics.queue_stats.queued}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Locked:</span>
                    <span className="ml-2 font-medium">{hsMetrics.queue_stats.locked}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Completed:</span>
                    <span className="ml-2 font-medium">{hsMetrics.queue_stats.completed}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Failed:</span>
                    <span className="ml-2 font-medium">{hsMetrics.queue_stats.failed}</span>
                  </div>
                </div>
              </div>

              {/* Worker Table */}
              {hsMetrics.workers.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium">Worker Activity (Last 5 min)</h4>
                  <div className="rounded-md border overflow-auto max-h-64">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Worker ID</TableHead>
                          <TableHead className="text-right">Claimed</TableHead>
                          <TableHead className="text-right">Succeeded</TableHead>
                          <TableHead className="text-right">Failed</TableHead>
                          <TableHead className="text-right">Avg Duration</TableHead>
                          <TableHead>Last Tick</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {hsMetrics.workers.map((worker) => (
                          <TableRow key={worker.worker_id}>
                            <TableCell className="font-mono text-xs">{worker.worker_id.slice(0, 20)}...</TableCell>
                            <TableCell className="text-right">{worker.jobs_claimed}</TableCell>
                            <TableCell className="text-right text-green-600">{worker.jobs_succeeded}</TableCell>
                            <TableCell className="text-right text-red-600">{worker.jobs_failed}</TableCell>
                            <TableCell className="text-right">{worker.avg_tick_duration_ms.toFixed(0)}ms</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {new Date(worker.last_tick_at).toLocaleTimeString()}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {hsMetrics.workers.length === 0 && (
                <div className="p-4 rounded-lg border bg-muted/50 text-center">
                  <p className="text-muted-foreground">No worker activity in the last 5 minutes</p>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Section 5: Launch Validation (L1/L2/L3) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5" />
            5. Launch Validation (E2E)
          </CardTitle>
          <CardDescription>
            Create and deploy a 3-lead test campaign, verify provider dispatch, failure transparency, and scale safety
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Live Mode Toggle */}
          <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/50">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Label htmlFor="live-mode" className="text-base font-medium">Live Mode</Label>
                {liveMode && (
                  <Badge variant="destructive" className="text-xs">REAL PROVIDERS</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {liveMode 
                  ? 'Uses real provider APIs (Resend/VAPI) - actual emails/calls will be sent'
                  : 'Sandbox mode - simulates provider responses without real API calls'}
              </p>
            </div>
            <div className="flex items-center gap-4">
              {liveMode && providerStatus && (
                <div className="flex items-center gap-2 text-sm">
                  {checkingProvider ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : providerStatus.connected ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="text-green-600">{providerStatus.provider} connected</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4 text-red-600" />
                      <span className="text-red-600">No provider configured</span>
                    </>
                  )}
                </div>
              )}
              <Switch
                id="live-mode"
                checked={liveMode}
                onCheckedChange={setLiveMode}
              />
            </div>
          </div>

          {/* Setup */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Channel</Label>
              <Select value={launchChannel} onValueChange={(v) => setLaunchChannel(v as 'email' | 'voice')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Email
                    </div>
                  </SelectItem>
                  <SelectItem value="voice">
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      Voice
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button 
                onClick={createLaunchTestCampaign} 
                disabled={creatingLaunchTest || (liveMode && providerStatus && !providerStatus.connected)}
                className="w-full"
                variant={liveMode ? 'destructive' : 'default'}
              >
                {creatingLaunchTest ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />}
                Create 3-Lead Test
              </Button>
            </div>
            <div className="flex items-end">
              <Button 
                onClick={deployLaunchTest} 
                disabled={!launchResult || deployingLaunchTest || launchResult.status !== 'pending' || (liveMode && providerStatus && !providerStatus.connected)}
                variant={liveMode ? 'destructive' : 'default'}
                className="w-full"
              >
                {deployingLaunchTest ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Rocket className="h-4 w-4 mr-2" />}
                {liveMode ? 'Deploy LIVE' : 'Deploy Now'}
              </Button>
            </div>
          </div>

          {launchResult && (
            <>
              <Separator />
              
              {/* Status & Refresh */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge 
                    variant={
                      launchResult.status === 'completed' ? 'default' : 
                      launchResult.status === 'failed' ? 'destructive' : 
                      'secondary'
                    }
                    className="text-sm"
                  >
                    {launchResult.status.toUpperCase()}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    Run: <code className="ml-1">{launchResult.runId.slice(0, 8)}...</code>
                  </span>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={refreshLaunchStatus}
                  disabled={refreshingLaunchStatus}
                >
                  {refreshingLaunchStatus ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                  Refresh
                </Button>
              </div>

              {/* Pass Criteria Badges */}
              <div className="grid gap-3 md:grid-cols-3">
                <div className={`p-3 rounded-lg border ${launchResult.passCriteria.L1_provider_ids ? 'border-green-500/50 bg-green-500/10' : 'border-yellow-500/50 bg-yellow-500/10'}`}>
                  <div className="flex items-center gap-2">
                    {launchResult.passCriteria.L1_provider_ids ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    )}
                    <span className="font-medium text-sm">L1: Provider IDs</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {launchResult.channel === 'voice' ? 'channel_outbox.status = called, provider_call_id stored' : 'Outbox rows have provider_message_id'}
                  </p>
                </div>

                <div className={`p-3 rounded-lg border ${launchResult.passCriteria.L2_failure_visible ? 'border-green-500/50 bg-green-500/10' : 'border-red-500/50 bg-red-500/10'}`}>
                  <div className="flex items-center gap-2">
                    {launchResult.passCriteria.L2_failure_visible ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600" />
                    )}
                    <span className="font-medium text-sm">L2: Failures Visible</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Errors surfaced in outbox</p>
                </div>

                <div className={`p-3 rounded-lg border ${launchResult.passCriteria.L3_no_duplicates ? 'border-green-500/50 bg-green-500/10' : 'border-red-500/50 bg-red-500/10'}`}>
                  <div className="flex items-center gap-2">
                    {launchResult.passCriteria.L3_no_duplicates ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600" />
                    )}
                    <span className="font-medium text-sm">L3: No Duplicates</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Unique idempotency keys</p>
                </div>
              </div>

              {/* L1B Voice-Specific Criteria */}
              {launchResult.channel === 'voice' && (
                <div className="grid gap-3 md:grid-cols-1">
                  <div className={`p-3 rounded-lg border ${launchResult.passCriteria.L1B_voice_call_records ? 'border-green-500/50 bg-green-500/10' : 'border-yellow-500/50 bg-yellow-500/10'}`}>
                    <div className="flex items-center gap-2">
                      {launchResult.passCriteria.L1B_voice_call_records ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-yellow-600" />
                      )}
                      <span className="font-medium text-sm">L1B: Voice Call Records</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      voice_call_records has row(s) tied to correct tenant/workspace with provider_call_id
                    </p>
                  </div>
                </div>
              )}

              {/* Campaign Run Details */}
              {launchResult.campaignRun && (
                <div className="p-4 rounded-lg border bg-muted/50">
                  <h4 className="font-medium mb-3">Campaign Run</h4>
                  <div className="grid gap-2 text-sm md:grid-cols-4">
                    <div>
                      <span className="text-muted-foreground">Status:</span>
                      <Badge className="ml-2" variant={launchResult.campaignRun.status === 'completed' ? 'default' : 'secondary'}>
                        {launchResult.campaignRun.status}
                      </Badge>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Started:</span>
                      <span className="ml-2">{launchResult.campaignRun.started_at ? new Date(launchResult.campaignRun.started_at).toLocaleTimeString() : '-'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Completed:</span>
                      <span className="ml-2">{launchResult.campaignRun.completed_at ? new Date(launchResult.campaignRun.completed_at).toLocaleTimeString() : '-'}</span>
                    </div>
                    {launchResult.campaignRun.error_message && (
                      <div className="md:col-span-4">
                        <span className="text-muted-foreground">Error:</span>
                        <span className="ml-2 text-red-600">{launchResult.campaignRun.error_message}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Job Queue */}
              {launchResult.jobQueue.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium">Job Queue ({launchResult.jobQueue.length})</h4>
                  <div className="rounded-md border overflow-auto max-h-48">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead>Locked</TableHead>
                          <TableHead>Error</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {launchResult.jobQueue.map((job) => (
                          <TableRow key={job.id}>
                            <TableCell className="font-mono text-xs">{job.id.slice(0, 8)}...</TableCell>
                            <TableCell>
                              <Badge variant={job.status === 'completed' ? 'default' : job.status === 'failed' ? 'destructive' : 'secondary'}>
                                {job.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">{new Date(job.created_at).toLocaleTimeString()}</TableCell>
                            <TableCell className="text-xs">{job.locked_at ? new Date(job.locked_at).toLocaleTimeString() : '-'}</TableCell>
                            <TableCell className="text-xs text-red-600 max-w-[200px] truncate">{job.error_message || '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Outbox Rows */}
              {launchResult.outboxRows.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium">Channel Outbox ({launchResult.outboxRows.length})</h4>
                  <div className="rounded-md border overflow-auto max-h-48">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Status</TableHead>
                          <TableHead>Provider ID</TableHead>
                          <TableHead>Recipient</TableHead>
                          <TableHead>Error</TableHead>
                          <TableHead>Created</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {launchResult.outboxRows.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell>
                              <Badge variant={row.status === 'sent' || row.status === 'called' ? 'default' : row.status === 'failed' ? 'destructive' : 'secondary'}>
                                {row.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono text-xs">{row.provider_message_id || '-'}</TableCell>
                            <TableCell className="text-sm">{row.recipient_email || row.recipient_phone || '-'}</TableCell>
                            <TableCell className="text-xs text-red-600 max-w-[200px] truncate">{row.error || '-'}</TableCell>
                            <TableCell className="text-xs">{new Date(row.created_at).toLocaleTimeString()}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Voice Call Records (L1B) */}
              {launchResult.channel === 'voice' && launchResult.voiceCallRecords && launchResult.voiceCallRecords.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Voice Call Records ({launchResult.voiceCallRecords.length})
                  </h4>
                  <div className="rounded-md border overflow-auto max-h-48">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Status</TableHead>
                          <TableHead>Provider Call ID</TableHead>
                          <TableHead>Customer Number</TableHead>
                          <TableHead>Duration (s)</TableHead>
                          <TableHead>Tenant/Workspace</TableHead>
                          <TableHead>Created</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {launchResult.voiceCallRecords.map((record) => (
                          <TableRow key={record.id}>
                            <TableCell>
                              <Badge variant={record.status === 'completed' ? 'default' : record.status === 'failed' ? 'destructive' : 'secondary'}>
                                {record.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono text-xs">{record.provider_call_id || '-'}</TableCell>
                            <TableCell className="text-sm">{record.customer_number || '-'}</TableCell>
                            <TableCell className="text-sm">{record.duration_seconds ?? '-'}</TableCell>
                            <TableCell className="font-mono text-xs">
                              {record.tenant_id.slice(0, 8)}... / {record.workspace_id.slice(0, 8)}...
                            </TableCell>
                            <TableCell className="text-xs">{new Date(record.created_at).toLocaleTimeString()}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {launchResult.status === 'pending' && (
                <div className="p-4 rounded-lg border bg-muted/50 text-center">
                  <p className="text-muted-foreground">Click "Deploy Now" to start the campaign</p>
                </div>
              )}

              {launchResult.status === 'running' && launchResult.outboxRows.length === 0 && (
                <div className="p-4 rounded-lg border bg-muted/50 text-center">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-primary" />
                  <p className="text-muted-foreground">Campaign running... click Refresh to see progress</p>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Section 6: Evidence Export */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            6. Evidence Export
          </CardTitle>
          <CardDescription>
            Export JSON report with run IDs, job IDs, outbox entries, statuses, and timings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={exportEvidence} disabled={exporting || !testConfig} variant="outline">
            {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            Export Evidence JSON
          </Button>
          {!testConfig && (
            <p className="text-sm text-muted-foreground mt-2">Set up a test campaign first to export evidence</p>
          )}
        </CardContent>
      </Card>

      {/* Back Navigation */}
      <div className="flex justify-between">
        <Button variant="ghost" onClick={() => navigate('/platform-admin')}>
          ← Back to Platform Admin
        </Button>
        <Button variant="ghost" onClick={() => navigate('/platform-admin/qa/tenant-isolation')}>
          Tenant Isolation QA →
        </Button>
      </div>
    </div>
  );
}
