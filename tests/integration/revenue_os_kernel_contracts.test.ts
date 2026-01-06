import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "..", "..");

describe("Revenue OS Kernel contracts are frozen + versioned", () => {
  it("contract version constant matches docs", () => {
    const typesPath = path.join(REPO_ROOT, "supabase/functions/_shared/revenue_os_kernel/types.ts");
    const docsPath = path.join(REPO_ROOT, "docs/REVENUE_OS_KERNEL_CONTRACTS.md");

    const types = fs.readFileSync(typesPath, "utf8");
    const docs = fs.readFileSync(docsPath, "utf8");

    const m = types.match(/REVENUE_OS_KERNEL_CONTRACT_VERSION\s*=\s*["'](v\d+)["']/);
    expect(m).toBeTruthy();

    const version = m![1];
    expect(docs).toMatch(new RegExp(String.raw`\*\*Contract version:\*\*\s+\`${version}\``));
  });

  it("docs reference kernel tables", () => {
    const docsPath = path.join(REPO_ROOT, "docs/REVENUE_OS_KERNEL_CONTRACTS.md");
    const docs = fs.readFileSync(docsPath, "utf8");

    expect(docs).toContain("kernel_events");
    expect(docs).toContain("kernel_decisions");
    expect(docs).toContain("kernel_actions");
  });

  it("event-bus inserts to kernel_events table (not agent_runs)", () => {
    const eventBusPath = path.join(REPO_ROOT, "supabase/functions/_shared/revenue_os_kernel/event-bus.ts");
    const eventBus = fs.readFileSync(eventBusPath, "utf8");

    expect(eventBus).toContain('.from("kernel_events")');
    expect(eventBus).not.toContain('.from("agent_runs")');
  });

  it("orchestrator emits to kernel_events with payload_json (OS v1 contract)", () => {
    const orchestratorPath = path.join(REPO_ROOT, "supabase/functions/cmo-campaign-orchestrate/index.ts");
    const orchestrator = fs.readFileSync(orchestratorPath, "utf8");

    // Must insert into kernel_events table
    expect(orchestrator).toContain(".from('kernel_events')");
    // Must use payload_json column (not event_json)
    expect(orchestrator).toContain("payload_json:");
    // Must include workspace_id in payload for context
    expect(orchestrator).toContain("workspace_id: workspaceId");
  });

  it("correlation_id is request-level unique (includes requestId and action)", () => {
    const orchestratorPath = path.join(REPO_ROOT, "supabase/functions/cmo-campaign-orchestrate/index.ts");
    const orchestrator = fs.readFileSync(orchestratorPath, "utf8");

    // correlation_id must include requestId for unique tracing per request
    expect(orchestrator).toMatch(/correlationId\s*=\s*`campaign_\$\{campaignId\}_\$\{eventType\}_\$\{action\}_\$\{requestId\}`/);
    // requestId must be generated per invocation
    expect(orchestrator).toContain("crypto.randomUUID()");
  });

  it("idempotency_key uses action-level daily dedup (blocks same action same day)", () => {
    const orchestratorPath = path.join(REPO_ROOT, "supabase/functions/cmo-campaign-orchestrate/index.ts");
    const orchestrator = fs.readFileSync(orchestratorPath, "utf8");

    // Idempotency key must include action for action-level dedup
    expect(orchestrator).toMatch(/makeIdempotencyKey\(\[[\s\S]*?action[\s\S]*?\]\)/);
    // Must use daily granularity (occurredAt.slice(0, 10))
    expect(orchestrator).toContain("occurredAt.slice(0, 10)");
    // Must NOT use correlationId for dedup (only idempotency_key)
    expect(orchestrator).toContain("idempotency_key: idempotencyKey");
  });

  it("tenant_id and workspace_id are kept separate (identity boundary)", () => {
    const orchestratorPath = path.join(REPO_ROOT, "supabase/functions/cmo-campaign-orchestrate/index.ts");
    const orchestrator = fs.readFileSync(orchestratorPath, "utf8");

    // tenantId is the ownership boundary (inserted into tenant_id column)
    expect(orchestrator).toContain("tenant_id: tenantId");
    // workspace_id goes into payload, NOT into tenant_id
    expect(orchestrator).toMatch(/payload_json:\s*\{[\s\S]*?workspace_id:\s*workspaceId/);
  });

  it("handles idempotency conflict (23505) as duplicate suppressed", () => {
    const orchestratorPath = path.join(REPO_ROOT, "supabase/functions/cmo-campaign-orchestrate/index.ts");
    const orchestrator = fs.readFileSync(orchestratorPath, "utf8");

    // Must handle unique_violation error code
    expect(orchestrator).toContain("insertError?.code === '23505'");
    // Must return inserted: false on conflict
    expect(orchestrator).toContain("inserted: false");
  });
});

