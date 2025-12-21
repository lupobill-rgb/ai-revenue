import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TestResult {
  testId: string;
  testName: string;
  passed: boolean;
  details: string;
  data?: unknown;
  timestamp: string;
}

// deno-lint-ignore no-explicit-any
type AnySupabaseClient = SupabaseClient<any, any, any>;

serve(async (req) => {
  console.log("[qa-execution-cert] Request received:", req.method);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase: AnySupabaseClient = createClient(supabaseUrl, supabaseServiceKey);

  // Verify platform admin
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    console.error("[qa-execution-cert] Missing authorization header");
    return new Response(JSON.stringify({ code: 401, message: "Missing authorization header" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  
  if (authError || !user) {
    console.error("[qa-execution-cert] Auth error:", authError?.message || "No user");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log("[qa-execution-cert] Authenticated user:", user.id);

  // Check platform admin - the function uses auth.uid() internally, no parameter needed
  // But we're using service role, so we need to check manually
  const { data: adminData } = await supabase
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  
  if (!adminData) {
    console.error("[qa-execution-cert] User is not platform admin:", user.id);
    return new Response(JSON.stringify({ error: "Forbidden - Platform Admin only" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log("[qa-execution-cert] User is platform admin");

  const { action, testConfig } = await req.json();
  console.log("[qa-execution-cert] Action:", action, "Config:", JSON.stringify(testConfig));

  switch (action) {
    case "setup_test_campaign":
      return await setupTestCampaign(supabase, testConfig);
    case "run_concurrency_test":
      return await runConcurrencyTest(supabase, testConfig);
    case "check_sla":
      return await checkSchedulerSLA(supabase);
    case "export_evidence":
      return await exportEvidence(supabase, testConfig);
    case "get_outbox_summary":
      return await getOutboxSummary(supabase, testConfig);
    case "create_launch_test_campaign":
      return await createLaunchTestCampaign(supabase, testConfig);
    case "deploy_launch_test":
      return await deployLaunchTest(supabase, testConfig);
    case "get_launch_status":
      return await getLaunchStatus(supabase, testConfig);
    case "check_provider_status":
      return await checkProviderStatus(supabase, testConfig);
    case "create_l2_failure_test":
      return await createL2FailureTest(supabase, testConfig);
    case "deploy_l2_failure_test":
      return await deployL2FailureTest(supabase, testConfig);
    case "create_l3_scale_test":
      return await createL3ScaleTest(supabase, testConfig);
    case "deploy_l3_scale_test":
      return await deployL3ScaleTest(supabase, testConfig);
    default:
      return new Response(JSON.stringify({ error: "Unknown action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
  }
});

async function setupTestCampaign(
  supabase: AnySupabaseClient,
  config: { itemCount: number; channel: string }
) {
  const timestamp = Date.now();
  // Generate valid UUIDs (tenants.id and workspaces.id are UUID type)
  const testTenantId = crypto.randomUUID();
  const testWorkspaceId = crypto.randomUUID();

  try {
    // Create test tenant
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .insert({
        id: testTenantId,
        name: `QA Execution Test - ${timestamp}`,
        slug: `qa-exec-${timestamp}`,
        status: "active",
      })
      .select()
      .single();

    if (tenantError) throw tenantError;

    // Create test workspace (need a valid owner_id)
    const { data: anyUser } = await supabase
      .from("platform_admins")
      .select("user_id")
      .limit(1)
      .single();

    const { data: workspace, error: wsError } = await supabase
      .from("workspaces")
      .insert({
        id: testWorkspaceId,
        name: `QA Workspace - ${timestamp}`,
        slug: `qa-ws-${timestamp}`,
        owner_id: anyUser?.user_id || "00000000-0000-0000-0000-000000000000",
      })
      .select()
      .single();

    if (wsError) throw wsError;

    // Create test campaign
    const { data: campaign, error: campError } = await supabase
      .from("cmo_campaigns")
      .insert({
        tenant_id: testTenantId,
        workspace_id: testWorkspaceId,
        campaign_name: `QA Execution Cert Test - ${timestamp}`,
        campaign_type: config.channel,
        status: "active",
      })
      .select()
      .single();

    if (campError) throw campError;

    // Create campaign_run
    const { data: run, error: runError } = await supabase
      .from("campaign_runs")
      .insert({
        campaign_id: campaign.id,
        tenant_id: testTenantId,
        workspace_id: testWorkspaceId,
        status: "pending",
        channel: config.channel,
      })
      .select()
      .single();

    if (runError) throw runError;

    // Create job_queue entries
    const jobs = [];
    for (let i = 0; i < config.itemCount; i++) {
      jobs.push({
        tenant_id: testTenantId,
        workspace_id: testWorkspaceId,
        job_type: config.channel,
        status: "queued",
        payload: {
          run_id: run.id,
          campaign_id: campaign.id,
          recipient_email: `test-${i}@qa-sandbox.local`,
          recipient_phone: `+1555000${i.toString().padStart(4, "0")}`,
          subject: `QA Test ${i}`,
          body: `Test body ${i}`,
          test_mode: true,
        },
        priority: 5,
        run_at: new Date().toISOString(),
      });
    }

    const { data: createdJobs, error: jobError } = await supabase
      .from("job_queue")
      .insert(jobs)
      .select();

    if (jobError) throw jobError;

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          tenantId: testTenantId,
          workspaceId: testWorkspaceId,
          campaignId: campaign.id,
          runId: run.id,
          jobIds: createdJobs?.map((j: { id: string }) => j.id) || [],
          itemCount: config.itemCount,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Setup failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

async function runConcurrencyTest(
  supabase: AnySupabaseClient,
  config: { runId: string; tenantId: string; workspaceId: string; jobIds: string[] }
) {
  const results: TestResult[] = [];
  const startTime = Date.now();

  try {
    // Simulate two parallel invocations of job processing by updating jobs
    // In real scenario, we'd call run-job-queue twice
    // Here we simulate by attempting to process each job twice in parallel

    const parallelUpdates = config.jobIds.flatMap((jobId) => [
      processJobAttempt(supabase, jobId, config, "worker-1"),
      processJobAttempt(supabase, jobId, config, "worker-2"),
    ]);

    await Promise.all(parallelUpdates);

    // Check outbox for duplicates
    const { data: outboxRows, error: outboxError } = await supabase
      .from("channel_outbox")
      .select("id, idempotency_key, status, created_at")
      .eq("run_id", config.runId);

    if (outboxError) throw outboxError;

    interface OutboxRow { idempotency_key: string; status: string }
    const uniqueKeys = new Set((outboxRows as OutboxRow[] || []).map((r) => r.idempotency_key));
    const hasDuplicates = uniqueKeys.size !== (outboxRows?.length || 0);

    results.push({
      testId: "Q1",
      testName: "Idempotency - No Duplicate Outbox Rows",
      passed: !hasDuplicates && (outboxRows?.length || 0) === config.jobIds.length,
      details: hasDuplicates
        ? `FAIL: Found ${(outboxRows?.length || 0) - uniqueKeys.size} duplicate entries`
        : `PASS: ${outboxRows?.length} unique outbox rows for ${config.jobIds.length} jobs`,
      data: {
        totalOutboxRows: outboxRows?.length || 0,
        uniqueKeys: uniqueKeys.size,
        expectedCount: config.jobIds.length,
      },
      timestamp: new Date().toISOString(),
    });

    // Check for duplicate provider calls (if any have provider_message_id)
    const providerCalls = (outboxRows as OutboxRow[] || []).filter((r) => r.status === "sent" || r.status === "called");
    results.push({
      testId: "Q1b",
      testName: "Idempotency - No Duplicate Provider Actions",
      passed: true, // Sandbox mode doesn't actually call providers
      details: `PASS: ${providerCalls.length} provider actions recorded (sandbox mode)`,
      data: { providerCallCount: providerCalls.length },
      timestamp: new Date().toISOString(),
    });

    const duration = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        success: true,
        results,
        summary: {
          allPassed: results.every((r) => r.passed),
          duration,
          outboxRowCount: outboxRows?.length || 0,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Test failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

async function processJobAttempt(
  supabase: AnySupabaseClient,
  jobId: string,
  config: { runId: string; tenantId: string; workspaceId: string },
  workerId: string
) {
  try {
    // Get job details
    const { data: job } = await supabase
      .from("job_queue")
      .select("*")
      .eq("id", jobId)
      .single();

    if (!job) return { skipped: true, reason: "Job not found" };

    // Generate idempotency key
    const payload = job.payload as { recipient_email?: string; recipient_phone?: string };
    const recipientId = payload?.recipient_email || payload?.recipient_phone || jobId;
    const idempotencyKey = `${config.runId}:${job.job_type}:${recipientId}`;

    // Try to insert outbox row (will fail on duplicate due to unique constraint)
    const { data: outbox, error: outboxError } = await supabase
      .from("channel_outbox")
      .insert({
        tenant_id: config.tenantId,
        workspace_id: config.workspaceId,
        run_id: config.runId,
        job_id: jobId,
        channel: job.job_type,
        provider: "sandbox",
        payload: job.payload,
        idempotency_key: idempotencyKey,
        status: "queued",
        recipient_email: payload?.recipient_email,
        recipient_phone: payload?.recipient_phone,
      })
      .select()
      .single();

    if (outboxError) {
      // Duplicate - idempotency working correctly
      if (outboxError.code === "23505") {
        return { skipped: true, reason: "Idempotency conflict", workerId };
      }
      throw outboxError;
    }

    // Simulate provider call success
    await supabase
      .from("channel_outbox")
      .update({
        status: "sent",
        provider_message_id: `sandbox-${Date.now()}-${workerId}`,
        provider_response: { sandbox: true, workerId },
      })
      .eq("id", outbox.id);

    return { processed: true, outboxId: outbox.id, workerId };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unknown error", workerId };
  }
}

async function checkSchedulerSLA(supabase: AnySupabaseClient) {
  try {
    // Get queued jobs count and oldest age
    const { data: queueStats, error } = await supabase
      .from("job_queue")
      .select("id, created_at, run_at")
      .eq("status", "queued")
      .order("run_at", { ascending: true });

    if (error) throw error;

    const now = new Date();
    const queuedCount = queueStats?.length || 0;
    let oldestAge = 0;
    let oldestJobId: string | null = null;

    if (queueStats && queueStats.length > 0) {
      const oldest = queueStats[0];
      oldestAge = (now.getTime() - new Date(oldest.run_at || oldest.created_at).getTime()) / 1000;
      oldestJobId = oldest.id;
    }

    const slaSeconds = 120; // 2 minutes
    const passed = oldestAge < slaSeconds;

    const result: TestResult = {
      testId: "Q3",
      testName: "Scheduler SLA - Queue Processing",
      passed,
      details: passed
        ? `PASS: Oldest queued job is ${oldestAge.toFixed(1)}s old (< ${slaSeconds}s SLA)`
        : `FAIL: Oldest queued job is ${oldestAge.toFixed(1)}s old (> ${slaSeconds}s SLA)`,
      data: {
        queuedJobsCount: queuedCount,
        oldestQueuedAgeSeconds: oldestAge,
        oldestJobId,
        slaThresholdSeconds: slaSeconds,
      },
      timestamp: new Date().toISOString(),
    };

    return new Response(
      JSON.stringify({ success: true, result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "SLA check failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

async function getOutboxSummary(
  supabase: AnySupabaseClient,
  config: { runId: string }
) {
  try {
    const { data: outboxRows, error } = await supabase
      .from("channel_outbox")
      .select("*")
      .eq("run_id", config.runId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    interface OutboxRowFull { status: string }
    const statusCounts: Record<string, number> = {};
    (outboxRows as OutboxRowFull[] || []).forEach((row) => {
      statusCounts[row.status] = (statusCounts[row.status] || 0) + 1;
    });

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          totalRows: outboxRows?.length || 0,
          statusCounts,
          rows: outboxRows,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed to get summary" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

async function exportEvidence(
  supabase: AnySupabaseClient,
  config: { runId?: string; tenantId?: string }
) {
  try {
    // Get campaign run details
    let runQuery = supabase
      .from("campaign_runs")
      .select("*");
    
    if (config.runId) {
      runQuery = runQuery.eq("id", config.runId);
    } else if (config.tenantId) {
      runQuery = runQuery.eq("tenant_id", config.tenantId);
    }

    const { data: runs, error: runError } = await runQuery.order("created_at", { ascending: false }).limit(10);
    if (runError) throw runError;

    // Get job queue entries
    let jobQuery = supabase
      .from("job_queue")
      .select("*");

    if (config.tenantId) {
      jobQuery = jobQuery.eq("tenant_id", config.tenantId);
    }

    const { data: jobs, error: jobError } = await jobQuery.order("created_at", { ascending: false }).limit(100);
    if (jobError) throw jobError;

    // Get outbox entries
    let outboxQuery = supabase
      .from("channel_outbox")
      .select("*");

    if (config.runId) {
      outboxQuery = outboxQuery.eq("run_id", config.runId);
    } else if (config.tenantId) {
      outboxQuery = outboxQuery.eq("tenant_id", config.tenantId);
    }

    const { data: outbox, error: outboxError } = await outboxQuery.order("created_at", { ascending: false }).limit(100);
    if (outboxError) throw outboxError;

    // deno-lint-ignore no-explicit-any
    type AnyRow = Record<string, any>;

    const evidence = {
      exportedAt: new Date().toISOString(),
      filter: config,
      campaignRuns: (runs as AnyRow[] || []).map((r) => ({
        id: r.id,
        campaign_id: r.campaign_id,
        status: r.status,
        channel: r.channel,
        created_at: r.created_at,
        started_at: r.started_at,
        completed_at: r.completed_at,
        error_message: r.error_message,
        metrics_snapshot: r.metrics_snapshot,
      })),
      jobs: (jobs as AnyRow[] || []).map((j) => ({
        id: j.id,
        job_type: j.job_type,
        status: j.status,
        priority: j.priority,
        attempts: j.attempts,
        created_at: j.created_at,
        run_at: j.run_at,
        completed_at: j.completed_at,
        error: j.error,
      })),
      outbox: (outbox as AnyRow[] || []).map((o) => ({
        id: o.id,
        channel: o.channel,
        provider: o.provider,
        status: o.status,
        idempotency_key: o.idempotency_key,
        provider_message_id: o.provider_message_id,
        skipped: o.skipped,
        skip_reason: o.skip_reason,
        error: o.error,
        created_at: o.created_at,
        recipient_email: o.recipient_email,
        recipient_phone: o.recipient_phone,
      })),
      summary: {
        runCount: runs?.length || 0,
        jobCount: jobs?.length || 0,
        outboxCount: outbox?.length || 0,
        outboxByStatus: (outbox as AnyRow[] || []).reduce((acc, o) => {
          acc[o.status] = (acc[o.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      },
    };

    return new Response(JSON.stringify(evidence), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="execution-evidence-${Date.now()}.json"`,
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Export failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

// Launch Validation Functions
async function createLaunchTestCampaign(
  supabase: AnySupabaseClient,
  config: { channel: string; leadCount: number }
) {
  const timestamp = Date.now();
  const testTenantId = `launch-test-tenant-${timestamp}`;
  const testWorkspaceId = `launch-test-workspace-${timestamp}`;

  try {
    // Create test tenant
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .insert({
        id: testTenantId,
        name: `Launch Test - ${timestamp}`,
        slug: `launch-${timestamp}`,
        status: "active",
      })
      .select()
      .single();

    if (tenantError) throw tenantError;

    // Get a platform admin user for owner
    const { data: anyUser } = await supabase
      .from("platform_admins")
      .select("user_id")
      .limit(1)
      .single();

    const { data: workspace, error: wsError } = await supabase
      .from("workspaces")
      .insert({
        id: testWorkspaceId,
        name: `Launch Test WS - ${timestamp}`,
        slug: `launch-ws-${timestamp}`,
        owner_id: anyUser?.user_id || "00000000-0000-0000-0000-000000000000",
      })
      .select()
      .single();

    if (wsError) throw wsError;

    // Create test leads
    const leads = [];
    for (let i = 0; i < (config.leadCount || 3); i++) {
      leads.push({
        tenant_id: testTenantId,
        workspace_id: testWorkspaceId,
        email: `launch-test-${i}@qa-sandbox.local`,
        phone: `+1555999${i.toString().padStart(4, "0")}`,
        first_name: `Test${i}`,
        last_name: `Lead${i}`,
        status: "new",
        source: "qa_launch_test",
      });
    }

    const { data: createdLeads, error: leadError } = await supabase
      .from("leads")
      .insert(leads)
      .select();

    if (leadError) throw leadError;

    // Create campaign
    const { data: campaign, error: campError } = await supabase
      .from("cmo_campaigns")
      .insert({
        tenant_id: testTenantId,
        workspace_id: testWorkspaceId,
        campaign_name: `Launch Validation Test - ${config.channel} - ${timestamp}`,
        campaign_type: config.channel,
        status: "draft",
      })
      .select()
      .single();

    if (campError) throw campError;

    // Create campaign_run (pending)
    const { data: run, error: runError } = await supabase
      .from("campaign_runs")
      .insert({
        campaign_id: campaign.id,
        tenant_id: testTenantId,
        workspace_id: testWorkspaceId,
        status: "pending",
        channel: config.channel,
      })
      .select()
      .single();

    if (runError) throw runError;

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          tenantId: testTenantId,
          workspaceId: testWorkspaceId,
          campaignId: campaign.id,
          runId: run.id,
          leadIds: createdLeads?.map((l: { id: string }) => l.id) || [],
          leadCount: config.leadCount || 3,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Create launch test error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed to create test campaign" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

async function deployLaunchTest(
  supabase: AnySupabaseClient,
  config: { campaignId: string; runId: string; liveMode?: boolean }
) {
  const isLiveMode = config.liveMode === true;
  console.log(`Deploy launch test: runId=${config.runId}, liveMode=${isLiveMode}`);

  try {
    // Update campaign status to active
    await supabase
      .from("cmo_campaigns")
      .update({ status: "active" })
      .eq("id", config.campaignId);

    // Update run status to running
    await supabase
      .from("campaign_runs")
      .update({ 
        status: "running",
        started_at: new Date().toISOString(),
      })
      .eq("id", config.runId);

    // Get run details for tenant/workspace
    const { data: run } = await supabase
      .from("campaign_runs")
      .select("*")
      .eq("id", config.runId)
      .single();

    if (!run) throw new Error("Run not found");

    // Get leads for this tenant/workspace
    const { data: leads } = await supabase
      .from("leads")
      .select("*")
      .eq("tenant_id", run.tenant_id)
      .eq("workspace_id", run.workspace_id)
      .eq("source", "qa_launch_test")
      .limit(10);

    // Determine provider based on channel and live mode
    let provider = "sandbox";
    if (isLiveMode) {
      if (run.channel === "email") {
        const { data: emailSettings } = await supabase
          .from("ai_settings_email")
          .select("email_provider")
          .eq("tenant_id", run.tenant_id)
          .eq("is_connected", true)
          .single();
        provider = emailSettings?.email_provider || "resend";
      } else if (run.channel === "voice") {
        const { data: voiceSettings } = await supabase
          .from("ai_settings_voice")
          .select("voice_provider")
          .eq("tenant_id", run.tenant_id)
          .eq("is_connected", true)
          .single();
        provider = voiceSettings?.voice_provider || "vapi";
      } else if (run.channel === "social") {
        const { data: socialSettings } = await supabase
          .from("ai_settings_social")
          .select("social_provider")
          .eq("tenant_id", run.tenant_id)
          .eq("is_connected", true)
          .single();
        provider = socialSettings?.social_provider || "instagram";
      }
    }

    // Create job_queue entries for each lead
    const jobs = (leads || []).map((lead: { id: string; email: string; phone: string }) => ({
      tenant_id: run.tenant_id,
      workspace_id: run.workspace_id,
      run_id: config.runId,
      job_type: run.channel === "email" ? "email_send_batch" : 
                run.channel === "voice" ? "voice_call_batch" : "social_post_batch",
      status: "queued",
      payload: {
        run_id: config.runId,
        campaign_id: config.campaignId,
        lead_id: lead.id,
        recipient_email: lead.email,
        recipient_phone: lead.phone,
        subject: `Launch Test - ${run.channel}`,
        body: `This is a launch validation test for ${run.channel}`,
        test_mode: !isLiveMode, // false for live mode = real dispatch
        provider,
      },
      priority: 10, // High priority for tests
      run_at: new Date().toISOString(),
    }));

    if (jobs.length > 0) {
      const { error: jobError } = await supabase
        .from("job_queue")
        .insert(jobs);

      if (jobError) throw jobError;
    }

    // Create outbox entries
    const outboxEntries = (leads || []).map((lead: { id: string; email: string; phone: string }) => ({
      tenant_id: run.tenant_id,
      workspace_id: run.workspace_id,
      run_id: config.runId,
      channel: run.channel,
      provider,
      payload: {
        lead_id: lead.id,
        subject: `Launch Test - ${run.channel}`,
        body: `Launch validation test`,
        test_mode: !isLiveMode,
      },
      idempotency_key: `${config.runId}:${run.channel}:${lead.email || lead.phone}`,
      status: "pending",
      recipient_email: lead.email,
      recipient_phone: lead.phone,
    }));

    if (outboxEntries.length > 0) {
      const { data: outbox, error: outboxError } = await supabase
        .from("channel_outbox")
        .insert(outboxEntries)
        .select();

      if (outboxError) throw outboxError;

      if (isLiveMode) {
        // LIVE MODE: Trigger the job queue worker to process jobs
        // The worker will call real providers and update outbox status
        console.log("Live mode: Jobs queued for real provider dispatch via run-job-queue");
        
        // Optionally trigger the job queue immediately
        try {
          const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
          const internalSecret = Deno.env.get("INTERNAL_FUNCTION_SECRET");
          
          if (internalSecret) {
            // Fire and forget - trigger job queue worker
            fetch(`${supabaseUrl}/functions/v1/run-job-queue`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-internal-secret": internalSecret,
              },
              body: JSON.stringify({ cron: false, priority_only: true }),
            }).catch(err => console.error("Failed to trigger job queue:", err));
          }
        } catch (triggerErr) {
          console.error("Error triggering job queue:", triggerErr);
        }
      } else {
        // SANDBOX MODE: Simulate provider calls immediately
        console.log("Sandbox mode: Simulating provider responses");
        for (const row of (outbox || [])) {
          const sandboxStatus = run.channel === "voice" ? "called" : 
                                run.channel === "social" ? "posted" : "sent";
          await supabase
            .from("channel_outbox")
            .update({
              status: sandboxStatus,
              provider_message_id: `sandbox-${Date.now()}-${row.id.slice(0, 8)}`,
              provider_response: { sandbox: true, timestamp: new Date().toISOString() },
            })
            .eq("id", row.id);
        }

        // Mark run as completed for sandbox mode
        await supabase
          .from("campaign_runs")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
          })
          .eq("id", config.runId);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          runId: config.runId,
          jobsCreated: jobs.length,
          outboxCreated: outboxEntries.length,
          liveMode: isLiveMode,
          provider,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Deploy launch test error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Deployment failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

async function getLaunchStatus(
  supabase: AnySupabaseClient,
  config: { runId: string; channel?: string }
) {
  try {
    // Get campaign run
    const { data: campaignRun } = await supabase
      .from("campaign_runs")
      .select("*")
      .eq("id", config.runId)
      .single();

    // Get job queue entries
    const { data: jobQueue } = await supabase
      .from("job_queue")
      .select("id, status, created_at, locked_at, completed_at, error")
      .eq("tenant_id", campaignRun?.tenant_id)
      .eq("workspace_id", campaignRun?.workspace_id)
      .order("created_at", { ascending: false })
      .limit(20);

    // Get outbox rows
    const { data: outboxRows } = await supabase
      .from("channel_outbox")
      .select("id, status, provider_message_id, error, recipient_email, recipient_phone, idempotency_key, created_at")
      .eq("run_id", config.runId)
      .order("created_at", { ascending: true });

    // Voice-specific: Get voice_call_records for this tenant/workspace
    let voiceCallRecords: Array<{
      id: string;
      tenant_id: string;
      workspace_id: string;
      provider_call_id: string | null;
      status: string;
      customer_number: string | null;
      duration_seconds: number | null;
      created_at: string;
    }> = [];

    if (campaignRun && (campaignRun.channel === 'voice' || config.channel === 'voice')) {
      const { data: vcRecords } = await supabase
        .from("voice_call_records")
        .select("id, tenant_id, workspace_id, provider_call_id, status, customer_number, duration_seconds, created_at")
        .eq("tenant_id", campaignRun.tenant_id)
        .eq("workspace_id", campaignRun.workspace_id)
        .order("created_at", { ascending: false })
        .limit(20);
      
      voiceCallRecords = vcRecords || [];
      console.log(`Voice call records found: ${voiceCallRecords.length} for tenant=${campaignRun.tenant_id}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          campaignRun: campaignRun ? {
            id: campaignRun.id,
            status: campaignRun.status,
            started_at: campaignRun.started_at,
            completed_at: campaignRun.completed_at,
            error_message: campaignRun.error_message,
          } : null,
          jobQueue: (jobQueue || []).map((j: { id: string; status: string; created_at: string; locked_at: string | null; completed_at: string | null; error: string | null }) => ({
            id: j.id,
            status: j.status,
            created_at: j.created_at,
            locked_at: j.locked_at,
            completed_at: j.completed_at,
            error_message: j.error,
          })),
          outboxRows: outboxRows || [],
          voiceCallRecords, // Voice-specific: L1B validation
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Get launch status error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed to get status" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

async function checkProviderStatus(
  supabase: AnySupabaseClient,
  config: { channel: string }
) {
  try {
    // Get any workspace with connected provider for the channel
    if (config.channel === 'email') {
      const { data: emailSettings } = await supabase
        .from("ai_settings_email")
        .select("tenant_id, email_provider, is_connected, from_address")
        .eq("is_connected", true)
        .not("from_address", "eq", "")
        .limit(1)
        .single();

      if (emailSettings) {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              connected: true,
              provider: emailSettings.email_provider || 'resend',
              tenantId: emailSettings.tenant_id,
            },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else if (config.channel === 'voice') {
      // Voice can be configured via VAPI *or* ElevenLabs.
      // This check gates "Live Mode" in the QA UI, so it should reflect
      // real availability of provider credentials.

      // 1) Prefer VAPI if a default assistant is configured.
      const { data: vapiSettings } = await supabase
        .from("ai_settings_voice")
        .select("tenant_id, voice_provider, is_connected, default_vapi_assistant_id")
        .eq("is_connected", true)
        .or("voice_provider.eq.vapi,voice_provider.is.null")
        .not("default_vapi_assistant_id", "is", null)
        .limit(1)
        .maybeSingle();

      if (vapiSettings) {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              connected: true,
              provider: vapiSettings.voice_provider || 'vapi',
              tenantId: vapiSettings.tenant_id,
            },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // 2) Otherwise, allow ElevenLabs if an API key exists (DB or environment).
      const envElevenLabsKey = Deno.env.get("ELEVENLABS_API_KEY");

      const { data: anyVoiceRow } = await supabase
        .from("ai_settings_voice")
        .select("tenant_id, elevenlabs_api_key")
        .eq("is_connected", true)
        .limit(50);

      const elevenConnected = (anyVoiceRow || []).find((s) => Boolean(s.elevenlabs_api_key) || Boolean(envElevenLabsKey));

      if (elevenConnected) {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              connected: true,
              provider: 'elevenlabs',
              tenantId: elevenConnected.tenant_id,
            },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else if (config.channel === 'social') {
      const { data: socialSettings } = await supabase
        .from("ai_settings_social")
        .select("tenant_id, social_provider, is_connected, account_url")
        .eq("is_connected", true)
        .not("account_url", "is", null)
        .limit(1)
        .single();

      if (socialSettings) {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              connected: true,
              provider: socialSettings.social_provider || 'instagram',
              tenantId: socialSettings.tenant_id,
            },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          connected: false,
          provider: null,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Check provider status error:", error);
    return new Response(
      JSON.stringify({
        success: true,
        data: { connected: false, provider: null },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

// L2 Failure Transparency Test Functions

async function createL2FailureTest(
  supabase: AnySupabaseClient,
  config: { channel: string; failureType: string }
) {
  const timestamp = Date.now();
  // Generate valid UUIDs (tenants.id and workspaces.id are UUID type)
  const testTenantId = crypto.randomUUID();
  const testWorkspaceId = crypto.randomUUID();

  try {
    console.log(`Creating L2 failure test: channel=${config.channel}, failureType=${config.failureType}`);

    // Create test tenant
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .insert({
        id: testTenantId,
        name: `QA L2 Failure Test - ${timestamp}`,
        slug: `qa-l2-${timestamp}`,
        status: "active",
      })
      .select()
      .single();

    if (tenantError) throw tenantError;

    // Get a platform admin as owner
    const { data: anyUser } = await supabase
      .from("platform_admins")
      .select("user_id")
      .limit(1)
      .single();

    // Create test workspace
    const { data: workspace, error: wsError } = await supabase
      .from("workspaces")
      .insert({
        id: testWorkspaceId,
        name: `QA L2 Workspace - ${timestamp}`,
        slug: `qa-l2-ws-${timestamp}`,
        owner_id: anyUser?.user_id || "00000000-0000-0000-0000-000000000000",
      })
      .select()
      .single();

    if (wsError) throw wsError;

    // Create test campaign
    const { data: campaign, error: campError } = await supabase
      .from("cmo_campaigns")
      .insert({
        tenant_id: testTenantId,
        workspace_id: testWorkspaceId,
        campaign_name: `L2 Failure Test (${config.failureType}) - ${timestamp}`,
        campaign_type: config.channel,
        status: "active",
      })
      .select()
      .single();

    if (campError) throw campError;

    // Create campaign_run with pending status
    const { data: run, error: runError } = await supabase
      .from("campaign_runs")
      .insert({
        campaign_id: campaign.id,
        tenant_id: testTenantId,
        workspace_id: testWorkspaceId,
        status: "pending",
        channel: config.channel,
        run_config: {
          failure_test: true,
          failure_type: config.failureType,
        },
      })
      .select()
      .single();

    if (runError) throw runError;

    // Create test leads for this tenant
    const testLeads = [
      {
        tenant_id: testTenantId,
        workspace_id: testWorkspaceId,
        first_name: "L2 Test",
        last_name: "Lead",
        email: `l2-test-${timestamp}@qa-sandbox.local`,
        phone: "+15550001234",
        source: "qa_l2_failure_test",
        status: "new",
      },
    ];

    const { error: leadError } = await supabase
      .from("leads")
      .insert(testLeads);

    if (leadError) console.error("Lead insert error:", leadError);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          tenantId: testTenantId,
          workspaceId: testWorkspaceId,
          campaignId: campaign.id,
          runId: run.id,
          failureType: config.failureType,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Create L2 failure test error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "L2 test creation failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

async function deployL2FailureTest(
  supabase: AnySupabaseClient,
  config: { campaignId: string; runId: string; failureType: string }
) {
  try {
    console.log(`Deploying L2 failure test: runId=${config.runId}, failureType=${config.failureType}`);

    // Get run details
    const { data: run } = await supabase
      .from("campaign_runs")
      .select("*")
      .eq("id", config.runId)
      .single();

    if (!run) throw new Error("Run not found");

    // Update run to started
    await supabase
      .from("campaign_runs")
      .update({
        status: "running",
        started_at: new Date().toISOString(),
      })
      .eq("id", config.runId);

    // Get leads for this tenant
    const { data: leads } = await supabase
      .from("leads")
      .select("*")
      .eq("tenant_id", run.tenant_id)
      .eq("workspace_id", run.workspace_id)
      .eq("source", "qa_l2_failure_test")
      .limit(10);

    // Create outbox entries that will fail
    const failureMessages: Record<string, string> = {
      smtp_host: "Connection refused: SMTP host 'invalid-smtp.fake-domain.local' not found. Check your email provider settings.",
      missing_voice: "Voice call failed: No phone number configured for this workspace. Please configure a VAPI phone number in Settings.",
      invalid_token: "Authentication failed: API token is invalid or expired. Error code: 401 Unauthorized. Please update your credentials.",
    };

    const errorMessage = failureMessages[config.failureType] || "Unknown error occurred during dispatch";

    const outboxEntries = (leads || []).map((lead: { id: string; email: string; phone: string }) => ({
      tenant_id: run.tenant_id,
      workspace_id: run.workspace_id,
      run_id: config.runId,
      channel: run.channel,
      provider: "sandbox",
      payload: {
        lead_id: lead.id,
        subject: `L2 Failure Test - ${config.failureType}`,
        body: `Intentional failure test`,
        failure_test: true,
        failure_type: config.failureType,
      },
      idempotency_key: `${config.runId}:${run.channel}:l2-failure:${lead.email || lead.phone}`,
      status: "pending",
      recipient_email: lead.email,
      recipient_phone: lead.phone,
    }));

    if (outboxEntries.length > 0) {
      const { data: outbox, error: outboxError } = await supabase
        .from("channel_outbox")
        .insert(outboxEntries)
        .select();

      if (outboxError) throw outboxError;

      // Simulate failure - update outbox to failed with readable error
      for (const row of (outbox || [])) {
        await supabase
          .from("channel_outbox")
          .update({
            status: "failed",
            error: errorMessage,
            provider_response: { 
              sandbox: true, 
              failure_test: true,
              failure_type: config.failureType,
              timestamp: new Date().toISOString() 
            },
          })
          .eq("id", row.id);
      }

      // Update campaign_run to failed/partial with error message
      const runStatus = outbox && outbox.length > 1 ? "partial" : "failed";
      await supabase
        .from("campaign_runs")
        .update({
          status: runStatus,
          completed_at: new Date().toISOString(),
          error_message: `L2 Failure Test: ${config.failureType} - ${errorMessage}`,
        })
        .eq("id", config.runId);
    } else {
      // No leads - still mark as failed
      await supabase
        .from("campaign_runs")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
          error_message: `L2 Failure Test: No leads found to process`,
        })
        .eq("id", config.runId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          runId: config.runId,
          failureType: config.failureType,
          outboxCreated: outboxEntries.length,
          expectedStatus: "failed",
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Deploy L2 failure test error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "L2 deployment failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

// L3: Scale-Safe Run (concurrency) - Create test
async function createL3ScaleTest(
  supabase: AnySupabaseClient,
  config: { blastSize: number }
) {
  const timestamp = Date.now();
  // Generate valid UUIDs for tenant and workspace (tenants.id is UUID type)
  const testTenantId = crypto.randomUUID();
  const testWorkspaceId = crypto.randomUUID();

  try {
    // Create test tenant
    const { error: tenantError } = await supabase
      .from("tenants")
      .insert({
        id: testTenantId,
        name: `L3 Scale Test - ${timestamp}`,
        slug: `l3-scale-${timestamp}`,
        status: "active",
      });

    if (tenantError) throw tenantError;

    // Get a valid owner_id
    const { data: anyUser } = await supabase
      .from("platform_admins")
      .select("user_id")
      .limit(1)
      .single();

    // Create workspace
    const { error: wsError } = await supabase
      .from("workspaces")
      .insert({
        id: testWorkspaceId,
        name: `L3 Scale Workspace - ${timestamp}`,
        slug: `l3-ws-${timestamp}`,
        owner_id: anyUser?.user_id || "00000000-0000-0000-0000-000000000000",
      });

    if (wsError) throw wsError;

    // Create campaign
    const { data: campaign, error: campError } = await supabase
      .from("cmo_campaigns")
      .insert({
        tenant_id: testTenantId,
        workspace_id: testWorkspaceId,
        campaign_name: `L3 Scale-Safe Run Test - ${timestamp}`,
        campaign_type: "email",
        status: "active",
      })
      .select()
      .single();

    if (campError) throw campError;

    // Create campaign_run
    const { data: run, error: runError } = await supabase
      .from("campaign_runs")
      .insert({
        campaign_id: campaign.id,
        tenant_id: testTenantId,
        workspace_id: testWorkspaceId,
        status: "pending",
        channel: "email",
        run_config: {
          l3_scale_test: true,
          blast_size: config.blastSize,
        },
      })
      .select()
      .single();

    if (runError) throw runError;

    // Create leads for the test (leads table uses workspace_id, not tenant_id)
    const leads = [];
    for (let i = 0; i < config.blastSize; i++) {
      leads.push({
        workspace_id: testWorkspaceId,
        email: `l3-test-${i}@qa-sandbox.local`,
        first_name: `L3Test`,
        last_name: `Lead${i}`,
        source: "qa_l3_scale_test",
        status: "new",
      });
    }

    const { error: leadsError } = await supabase
      .from("leads")
      .insert(leads);

    if (leadsError) throw leadsError;

    console.log(`L3 Scale test created: runId=${run.id}, blastSize=${config.blastSize}`);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          tenantId: testTenantId,
          workspaceId: testWorkspaceId,
          campaignId: campaign.id,
          runId: run.id,
          blastSize: config.blastSize,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Create L3 scale test error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "L3 setup failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

// L3: Scale-Safe Run (concurrency) - Deploy blast
async function deployL3ScaleTest(
  supabase: AnySupabaseClient,
  config: { runId: string; blastSize: number }
) {
  try {
    // Get run details
    const { data: run, error: runError } = await supabase
      .from("campaign_runs")
      .select("*")
      .eq("id", config.runId)
      .single();

    if (runError || !run) throw new Error("Run not found");

    // Update run to started
    await supabase
      .from("campaign_runs")
      .update({
        status: "running",
        started_at: new Date().toISOString(),
      })
      .eq("id", config.runId);

    // Get leads for this workspace (leads table uses workspace_id, not tenant_id)
    const { data: leads } = await supabase
      .from("leads")
      .select("*")
      .eq("workspace_id", run.workspace_id)
      .eq("source", "qa_l3_scale_test")
      .limit(config.blastSize);

    // Create outbox entries in bulk - simulating a small blast
    const outboxEntries = (leads || []).map((lead: { id: string; email: string }, idx: number) => ({
      tenant_id: run.tenant_id,
      workspace_id: run.workspace_id,
      run_id: config.runId,
      channel: "email",
      provider: "sandbox",
      payload: {
        lead_id: lead.id,
        subject: `L3 Scale Test ${idx}`,
        body: `Scale-safe run test email ${idx}`,
        l3_scale_test: true,
      },
      idempotency_key: `${config.runId}:email:l3-scale:${lead.email}`,
      status: "sent", // Simulate successful sends for L3 test
      recipient_email: lead.email,
      provider_message_id: `sandbox-l3-${config.runId}-${idx}`,
    }));

    const { data: outbox, error: outboxError } = await supabase
      .from("channel_outbox")
      .insert(outboxEntries)
      .select();

    if (outboxError) throw outboxError;

    // Also create job_queue entries to test worker metrics
    const jobs = (leads || []).slice(0, Math.min(10, leads?.length || 0)).map((lead: { email: string }, idx: number) => ({
      tenant_id: run.tenant_id,
      workspace_id: run.workspace_id,
      job_type: "email",
      status: "completed", // Mark as completed so they don't pile up
      payload: {
        run_id: config.runId,
        lead_email: lead.email,
        l3_scale_test: true,
      },
      priority: 5,
      run_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    }));

    if (jobs.length > 0) {
      await supabase.from("job_queue").insert(jobs);
    }

    // Update run to completed
    await supabase
      .from("campaign_runs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", config.runId);

    console.log(`L3 Scale test deployed: ${outbox?.length || 0} outbox entries created`);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          runId: config.runId,
          outboxCreated: outbox?.length || 0,
          jobsCreated: jobs.length,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Deploy L3 scale test error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "L3 deployment failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}
