import { makeIdempotencyKey } from "./hash.ts";
import type { KernelDecision, KernelRuntimeContext, RevenueAction } from "./types.ts";

function coalesceTenantToWorkspace(tenant_id: string, workspace_id?: string | null): string {
  return workspace_id || tenant_id;
}

async function insertKernelActionRow(
  supabase: any,
  row: {
    tenant_id: string;
    decision_id: string;
    correlation_id: string;
    action_type: string;
    action_json: Record<string, any>;
    status: "logged" | "executed" | "failed" | "skipped";
    executed_at?: string | null;
    error?: string | null;
  }
): Promise<string> {
  const { data, error } = await supabase
    .from("kernel_actions")
    .insert(row as never)
    .select("id")
    .single();

  if (error || !data?.id) {
    throw new Error(`KERNEL_ACTION_INSERT_FAILED: ${error?.message || "missing id"}`);
  }
  return data.id;
}

async function updateKernelActionRow(
  supabase: any,
  id: string,
  patch: Record<string, any>
): Promise<void> {
  const { error } = await supabase.from("kernel_actions").update(patch as never).eq("id", id);
  if (error) throw new Error(`KERNEL_ACTION_UPDATE_FAILED: ${error.message}`);
}

async function executeOutboundEmail(
  supabase: any,
  tenant_id: string,
  correlation_id: string,
  action: RevenueAction,
  ctx: KernelRuntimeContext
): Promise<Record<string, any>> {
  const meta = action.metadata || {};
  const subject = String(meta.subject || "No subject");
  const html_body = String(meta.html_body || "");
  const to_email = meta.to_email ? String(meta.to_email) : null;

  // If targeting a lead, fetch email + workspace_id
  let recipient_email: string | null = to_email;
  let recipient_id: string | null = null;
  let workspace_id: string | null = tenant_id;

  if (action.target.kind === "lead") {
    recipient_id = action.target.lead_id;
    const { data: lead, error } = await supabase
      .from("leads")
      .select("email, workspace_id")
      .eq("id", recipient_id)
      .single();
    if (error || !lead) throw new Error(`KERNEL_EMAIL_LEAD_LOOKUP_FAILED: ${error?.message || "lead missing"}`);
    recipient_email = lead.email || recipient_email;
    workspace_id = lead.workspace_id || workspace_id;
  }

  if (!recipient_email) {
    throw new Error("KERNEL_EMAIL_MISSING_RECIPIENT: no recipient_email resolved");
  }

  const schedule = (meta.schedule || { when: "now" }) as { when?: string; anchor?: string; minutes_before?: number };
  const nowIso = ctx.now().toISOString();
  let scheduled_at: string | null = nowIso;

  if (schedule.when === "relative") {
    const anchor = schedule.anchor ? Date.parse(String(schedule.anchor)) : NaN;
    const minutesBefore = Number(schedule.minutes_before ?? 0);
    if (Number.isFinite(anchor) && Number.isFinite(minutesBefore) && minutesBefore > 0) {
      const t = new Date(anchor - minutesBefore * 60_000);
      // If already in the past, send now.
      scheduled_at = (t.getTime() > Date.now() ? t : ctx.now()).toISOString();
    }
  }

  const idempotency_key = await makeIdempotencyKey([
    "revenue_os_kernel",
    "OUTBOUND_EMAIL",
    tenant_id,
    correlation_id,
    action.reason_code,
    recipient_email,
    subject,
  ]);

  const outboxInsert = {
    tenant_id,
    workspace_id: coalesceTenantToWorkspace(tenant_id, workspace_id),
    channel: "email",
    provider: "resend",
    idempotency_key,
    status: "scheduled",
    scheduled_at,
    recipient_email,
    recipient_id,
    payload: {
      subject,
      html_body,
      // Optional campaign linkage if present
      campaign_id: meta.campaign_id || null,
      revenue_os: {
        correlation_id,
        reason_code: action.reason_code,
      },
    },
  };

  const { data, error } = await supabase
    .from("channel_outbox")
    .insert(outboxInsert as never)
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      ctx.log("info", "kernel: outbox email idempotent skip", { correlation_id, idempotency_key });
      return { outbox_id: null, idempotency_key, skipped: true };
    }
    throw new Error(`KERNEL_EMAIL_OUTBOX_INSERT_FAILED: ${error.message}`);
  }

  return { outbox_id: data?.id || null, idempotency_key, skipped: false };
}

async function executeTaskCreate(
  supabase: any,
  tenant_id: string,
  correlation_id: string,
  action: RevenueAction,
  ctx: KernelRuntimeContext
): Promise<Record<string, any>> {
  const meta = action.metadata || {};
  const title = String(meta.title || "Follow up");
  const baseDescription = meta.description ? String(meta.description) : "";
  const correlationPrefix = `[correlation_id:${correlation_id}]`;
  const description = `${correlationPrefix} ${baseDescription}`.trim() || correlationPrefix;
  const dueInHours = Number(meta.due_in_hours ?? 24);
  const due_date = new Date(ctx.now().getTime() + dueInHours * 60 * 60 * 1000).toISOString();

  let lead_id: string | null = null;
  let deal_id: string | null = null;
  let workspace_id: string | null = tenant_id;

  if (action.target.kind === "lead") {
    lead_id = action.target.lead_id;
    const { data: lead, error } = await supabase
      .from("leads")
      .select("workspace_id")
      .eq("id", lead_id)
      .single();
    if (error) throw new Error(`KERNEL_TASK_LEAD_LOOKUP_FAILED: ${error.message}`);
    workspace_id = lead?.workspace_id || workspace_id;
  }

  if (action.target.kind === "deal") {
    deal_id = action.target.deal_id;
    const { data: deal, error } = await supabase
      .from("deals")
      .select("workspace_id")
      .eq("id", deal_id)
      .single();
    if (error) throw new Error(`KERNEL_TASK_DEAL_LOOKUP_FAILED: ${error.message}`);
    workspace_id = (deal as any)?.workspace_id || workspace_id;
  }

  // Tasks table does not (currently) include tenant_id; workspace_id is the scope.
  const { data: inserted, error: insertError } = await supabase
    .from("tasks")
    .insert(
      {
        lead_id,
        deal_id,
        title,
        description,
        due_date,
        status: "pending",
        task_type: meta.task_type || "follow_up",
        workspace_id: coalesceTenantToWorkspace(tenant_id, workspace_id),
      } as never
    )
    .select("id")
    .single();

  if (insertError) throw new Error(`KERNEL_TASK_INSERT_FAILED: ${insertError.message}`);

  return { task_id: inserted?.id || null };
}

export async function executeDecision(
  supabase: any,
  decision: KernelDecision,
  ctx: KernelRuntimeContext
): Promise<void> {
  if (decision.decision_type !== "EMIT_ACTIONS") return;

  const actions: RevenueAction[] = Array.isArray(decision.decision_json?.actions)
    ? (decision.decision_json.actions as RevenueAction[])
    : [];

  for (const action of actions) {
    const action_json = {
      ...(action as any),
      _kernel: {
        tenant_id: decision.tenant_id,
        correlation_id: decision.correlation_id,
        decision_id: decision.id,
      },
    };

    const actionRowId = await insertKernelActionRow(supabase, {
      tenant_id: decision.tenant_id,
      decision_id: decision.id!,
      correlation_id: decision.correlation_id,
      action_type: action.type,
      action_json,
      status: ctx.mode === "enforce" ? "logged" : "logged",
    });

    if (ctx.mode !== "enforce") {
      continue;
    }

    try {
      let result: Record<string, any> = {};
      if (action.type === "OUTBOUND_EMAIL") {
        result = await executeOutboundEmail(supabase, decision.tenant_id, decision.correlation_id, action, ctx);
      } else if (action.type === "TASK_CREATE" || action.type === "FOLLOW_UP") {
        result = await executeTaskCreate(supabase, decision.tenant_id, decision.correlation_id, action, ctx);
      } else {
        // Not yet implemented action types remain logged in enforcement mode.
        result = { skipped: true, reason: "action_not_implemented" };
      }

      await updateKernelActionRow(supabase, actionRowId, {
        status: result.skipped ? "skipped" : "executed",
        executed_at: ctx.now().toISOString(),
        action_json: { ...(action_json as any), _result: result },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      await updateKernelActionRow(supabase, actionRowId, {
        status: "failed",
        executed_at: ctx.now().toISOString(),
        error: msg,
      });
      throw e;
    }
  }
}


