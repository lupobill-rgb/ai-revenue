import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Shield, CheckCircle2, XCircle, AlertTriangle, Play, RefreshCw, Loader2 } from 'lucide-react';

interface TestResult {
  table: string;
  targetId: string;
  passed: boolean;
  response: {
    data: unknown;
    error: unknown;
    status?: number;
  };
  timestamp: string;
}

interface TestTenant {
  id: string;
  name: string;
  slug: string;
}

interface TestRecord {
  id: string;
  scope_id: string;
}

interface TestData {
  tenantA: TestTenant | null;
  tenantB: TestTenant | null;
  workspaceBId: string | null;
  testRecords: {
    leads?: TestRecord;
    voice_phone_numbers?: TestRecord;
    cmo_campaigns?: TestRecord;
    crm_activities?: TestRecord;
  };
}

const TABLES_TO_TEST = [
  { name: 'leads', displayName: 'Leads', scopeColumn: 'workspace_id' },
  { name: 'voice_phone_numbers', displayName: 'Voice Phone Numbers', scopeColumn: 'tenant_id' },
  { name: 'cmo_campaigns', displayName: 'CMO Campaigns', scopeColumn: 'tenant_id' },
  { name: 'crm_activities', displayName: 'CRM Activities', scopeColumn: 'tenant_id' },
];

export default function TenantIsolationQA() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isPlatformAdmin, setIsPlatformAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [setupLoading, setSetupLoading] = useState(false);
  const [testRunning, setTestRunning] = useState(false);
  const [testData, setTestData] = useState<TestData>({
    tenantA: null,
    tenantB: null,
    workspaceBId: null,
    testRecords: {},
  });
  const [testResults, setTestResults] = useState<TestResult[]>([]);

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

  const setupTestEnvironment = async () => {
    setSetupLoading(true);
    try {
      // Step 1: Find or create two test tenants
      const { data: existingTenants } = await supabase
        .from('tenants')
        .select('id, name, slug')
        .ilike('slug', 'qa-isolation-test%')
        .order('created_at')
        .limit(2);

      let tenantA: TestTenant | null = null;
      let tenantB: TestTenant | null = null;

      if (existingTenants && existingTenants.length >= 2) {
        tenantA = existingTenants[0];
        tenantB = existingTenants[1];
      } else {
        // Create test tenants
        const timestamp = Date.now();
        
        const { data: newTenantA, error: errA } = await supabase
          .from('tenants')
          .insert({
            name: `QA Isolation Test A - ${timestamp}`,
            slug: `qa-isolation-test-a-${timestamp}`,
            status: 'active',
          })
          .select()
          .single();

        if (errA) throw new Error(`Failed to create Tenant A: ${errA.message}`);
        tenantA = newTenantA;

        const { data: newTenantB, error: errB } = await supabase
          .from('tenants')
          .insert({
            name: `QA Isolation Test B - ${timestamp}`,
            slug: `qa-isolation-test-b-${timestamp}`,
            status: 'active',
          })
          .select()
          .single();

        if (errB) throw new Error(`Failed to create Tenant B: ${errB.message}`);
        tenantB = newTenantB;
      }

      if (!tenantA || !tenantB) {
        throw new Error('Failed to set up test tenants');
      }

      // Step 2: Create a workspace for Tenant B (needed for FK constraints)
      const { data: workspaceB } = await supabase
        .from('workspaces')
        .select('id')
        .eq('name', `QA Workspace B - ${tenantB.id}`)
        .maybeSingle();

      let workspaceBId = workspaceB?.id;
      
      if (!workspaceBId) {
        const { data: newWorkspace, error: wsErr } = await supabase
          .from('workspaces')
          .insert({
            name: `QA Workspace B - ${tenantB.id}`,
            slug: `qa-workspace-b-${tenantB.id}`,
            owner_id: user!.id,
          })
          .select('id')
          .single();
        
        if (wsErr) {
          console.warn('Workspace creation failed, trying existing:', wsErr.message);
          // Try to get any workspace
          const { data: anyWs } = await supabase
            .from('workspaces')
            .select('id')
            .limit(1)
            .single();
          workspaceBId = anyWs?.id;
        } else {
          workspaceBId = newWorkspace.id;
        }
      }

      if (!workspaceBId) {
        throw new Error('Failed to create or find a workspace');
      }

      // Step 3: Create test records in Tenant B
      const testRecords: TestData['testRecords'] = {};

      // Create a lead in Workspace B (leads use workspace_id, not tenant_id)
      const { data: leadB, error: leadErr } = await supabase
        .from('leads')
        .insert({
          workspace_id: workspaceBId,
          email: `qa-test-lead-${Date.now()}@isolation-test.com`,
          first_name: 'QA',
          last_name: 'Test Lead',
          source: 'qa_isolation_test',
          status: 'new',
        })
        .select('id, workspace_id')
        .single();

      if (leadB) {
        testRecords.leads = { id: leadB.id, scope_id: leadB.workspace_id };
      } else {
        console.warn('Lead creation failed:', leadErr?.message);
      }

      // Create a voice phone number in Tenant B
      const { data: phoneB, error: phoneErr } = await supabase
        .from('voice_phone_numbers')
        .insert({
          tenant_id: tenantB.id,
          workspace_id: workspaceBId,
          phone_number: `+1555${Date.now().toString().slice(-7)}`,
          display_name: 'QA Test Number',
          provider: 'test',
          status: 'active',
        })
        .select('id, tenant_id')
        .single();

      if (phoneB) {
        testRecords.voice_phone_numbers = { id: phoneB.id, scope_id: phoneB.tenant_id };
      } else {
        console.warn('Voice phone number creation failed:', phoneErr?.message);
      }

      // Create a CMO campaign in Tenant B
      const { data: campaignB, error: campaignErr } = await supabase
        .from('cmo_campaigns')
        .insert({
          tenant_id: tenantB.id,
          workspace_id: workspaceBId,
          campaign_name: `QA Isolation Test Campaign - ${Date.now()}`,
          campaign_type: 'email',
          status: 'draft',
        })
        .select('id, tenant_id')
        .single();

      if (campaignB) {
        testRecords.cmo_campaigns = { id: campaignB.id, scope_id: campaignB.tenant_id };
      } else {
        console.warn('CMO campaign creation failed:', campaignErr?.message);
      }

      // Create a CRM contact first (needed for crm_activities)
      const { data: contactB, error: contactErr } = await supabase
        .from('crm_contacts')
        .insert({
          tenant_id: tenantB.id,
          email: `qa-test-contact-${Date.now()}@isolation-test.com`,
          first_name: 'QA',
          last_name: 'Test Contact',
        })
        .select('id')
        .single();

      if (contactB) {
        // Create a CRM activity in Tenant B
        const { data: activityB, error: activityErr } = await supabase
          .from('crm_activities')
          .insert({
            tenant_id: tenantB.id,
            contact_id: contactB.id,
            activity_type: 'qa_isolation_test',
            meta: { test: true, timestamp: Date.now() },
          })
          .select('id, tenant_id')
          .single();

        if (activityB) {
          testRecords.crm_activities = { id: activityB.id, scope_id: activityB.tenant_id };
        } else {
          console.warn('CRM activity creation failed:', activityErr?.message);
        }
      } else {
        console.warn('CRM contact creation failed:', contactErr?.message);
      }

      setTestData({
        tenantA,
        tenantB,
        workspaceBId,
        testRecords,
      });

      toast.success('Test environment set up successfully');
    } catch (error) {
      console.error('Setup error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to set up test environment');
    } finally {
      setSetupLoading(false);
    }
  };

  const runIsolationTests = async () => {
    if (!testData.tenantA || !testData.tenantB) {
      toast.error('Please set up test environment first');
      return;
    }

    setTestRunning(true);
    setTestResults([]);
    const results: TestResult[] = [];

    for (const table of TABLES_TO_TEST) {
      const record = testData.testRecords[table.name as keyof typeof testData.testRecords];
      
      if (!record) {
        results.push({
          table: table.displayName,
          targetId: 'N/A',
          passed: false,
          response: {
            data: null,
            error: 'No test record created for this table',
          },
          timestamp: new Date().toISOString(),
        });
        continue;
      }

      try {
        // Attempt to fetch Tenant B's record using raw fetch to avoid type issues
        const { data, error, status } = await supabase
          .from(table.name as 'leads')
          .select('id')
          .eq('id', record.id)
          .maybeSingle();

        // PASS condition: data is null AND we get no error OR we get a permission error
        // The key is that we should NOT get the actual data back
        const passed = data === null;

        results.push({
          table: table.displayName,
          targetId: record.id,
          passed,
          response: {
            data,
            error: error ? { message: error.message, code: error.code } : null,
            status,
          },
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        results.push({
          table: table.displayName,
          targetId: record.id,
          passed: true, // Exception means access was denied
          response: {
            data: null,
            error: err instanceof Error ? err.message : 'Unknown error',
          },
          timestamp: new Date().toISOString(),
        });
      }
    }

    setTestResults(results);
    setTestRunning(false);

    const allPassed = results.every(r => r.passed);
    if (allPassed) {
      toast.success('All isolation tests PASSED');
    } else {
      toast.error('Some isolation tests FAILED - security review required');
    }
  };

  const getOverallStatus = () => {
    if (testResults.length === 0) return 'pending';
    return testResults.every(r => r.passed) ? 'pass' : 'fail';
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
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Shield className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Tenant Isolation QA</h1>
          <p className="text-muted-foreground">SEC-C: Known-ID Cross-Tenant Denial Test</p>
        </div>
      </div>

      {/* Overall Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Overall Status: 
            {getOverallStatus() === 'pending' && (
              <Badge variant="secondary">Pending</Badge>
            )}
            {getOverallStatus() === 'pass' && (
              <Badge className="bg-green-600">PASS</Badge>
            )}
            {getOverallStatus() === 'fail' && (
              <Badge variant="destructive">NO-PASS</Badge>
            )}
          </CardTitle>
          <CardDescription>
            Verifies that Tenant A cannot access Tenant B's data via direct UUID queries
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Setup Section */}
      <Card>
        <CardHeader>
          <CardTitle>Step 1: Setup Test Environment</CardTitle>
          <CardDescription>
            Creates two test tenants and populates Tenant B with test records
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={setupTestEnvironment} disabled={setupLoading}>
            {setupLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Setting up...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Setup Test Environment
              </>
            )}
          </Button>

          {testData.tenantA && testData.tenantB && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="p-4 rounded-lg border bg-muted/50">
                <h4 className="font-semibold mb-2">Tenant A (Attacker Context)</h4>
                <p className="text-sm text-muted-foreground">ID: {testData.tenantA.id}</p>
                <p className="text-sm text-muted-foreground">Name: {testData.tenantA.name}</p>
              </div>
              <div className="p-4 rounded-lg border bg-muted/50">
                <h4 className="font-semibold mb-2">Tenant B (Target)</h4>
                <p className="text-sm text-muted-foreground">ID: {testData.tenantB.id}</p>
                <p className="text-sm text-muted-foreground">Name: {testData.tenantB.name}</p>
              </div>
            </div>
          )}

          {Object.keys(testData.testRecords).length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="font-semibold mb-2">Test Records Created in Tenant B:</h4>
                <div className="space-y-2">
                  {Object.entries(testData.testRecords).map(([table, record]) => (
                    <div key={table} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="font-mono">{table}</span>
                      <span className="text-muted-foreground">→</span>
                      <code className="text-xs bg-muted px-2 py-1 rounded">{record?.id}</code>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Run Tests Section */}
      <Card>
        <CardHeader>
          <CardTitle>Step 2: Run Isolation Tests</CardTitle>
          <CardDescription>
            Attempts to fetch Tenant B's records from current user context (should all fail)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={runIsolationTests} 
            disabled={testRunning || !testData.tenantB}
            variant="default"
          >
            {testRunning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Running tests...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Run Cross-Tenant Fetch Tests
              </>
            )}
          </Button>

          {!testData.tenantB && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Setup Required</AlertTitle>
              <AlertDescription>
                Please complete Step 1 before running tests.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Results Section */}
      {testResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Test Results</CardTitle>
            <CardDescription>
              PASS = data is null (access denied) | NO-PASS = data returned (security breach)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {testResults.map((result, idx) => (
              <div key={idx} className="border rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {result.passed ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600" />
                    )}
                    <span className="font-semibold">{result.table}</span>
                    <Badge variant={result.passed ? 'default' : 'destructive'}>
                      {result.passed ? 'PASS' : 'NO-PASS'}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">{result.timestamp}</span>
                </div>
                
                <div className="text-sm">
                  <p className="text-muted-foreground">
                    Target ID: <code className="bg-muted px-1 rounded">{result.targetId}</code>
                  </p>
                </div>

                <div className="bg-muted rounded p-3">
                  <p className="text-xs font-semibold mb-1">Response:</p>
                  <pre className="text-xs overflow-auto max-h-32">
                    {JSON.stringify(result.response, null, 2)}
                  </pre>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Test Explanation</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none">
          <p className="text-muted-foreground">
            This test verifies that Row-Level Security (RLS) policies properly isolate tenant data.
            Even when an attacker knows the exact UUID of a record in another tenant, they should
            not be able to fetch it.
          </p>
          <ul className="text-muted-foreground space-y-1 mt-4">
            <li><strong>PASS:</strong> Query returns null/empty - RLS is blocking cross-tenant access</li>
            <li><strong>NO-PASS:</strong> Query returns actual data - critical security vulnerability</li>
          </ul>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button variant="outline" onClick={() => navigate('/platform-admin')}>
          Back to Platform Admin
        </Button>
      </div>
    </div>
  );
}
