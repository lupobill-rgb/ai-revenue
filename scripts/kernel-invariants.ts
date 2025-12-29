import fs from "node:fs";
import path from "node:path";

type Violation = {
  rule: string;
  file: string;
  detail: string;
};

const REPO_ROOT = path.resolve(process.cwd());

const IGNORE_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".turbo",
  ".next",
  "coverage",
]);

function walk(dirAbs: string): string[] {
  const out: string[] = [];
  const entries = fs.readdirSync(dirAbs, { withFileTypes: true });
  for (const e of entries) {
    if (e.isDirectory()) {
      if (IGNORE_DIRS.has(e.name)) continue;
      out.push(...walk(path.join(dirAbs, e.name)));
    } else {
      out.push(path.join(dirAbs, e.name));
    }
  }
  return out;
}

function rel(pAbs: string) {
  return path.relative(REPO_ROOT, pAbs).replace(/\\/g, "/");
}

function read(pAbs: string) {
  return fs.readFileSync(pAbs, "utf8");
}

function getImports(source: string): string[] {
  // Very small import parser: covers `import ... from "x"` and `export ... from "x"`
  const imports: string[] = [];
  const re = /^\s*(?:import|export)\s+(?:type\s+)?[\s\S]*?\sfrom\s+["']([^"']+)["']\s*;?/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) imports.push(m[1]);
  return imports;
}

function isTsLike(fileRel: string) {
  return fileRel.endsWith(".ts") || fileRel.endsWith(".tsx");
}

function isSql(fileRel: string) {
  return fileRel.endsWith(".sql");
}

function startsWithAny(fileRel: string, prefixes: string[]) {
  return prefixes.some((p) => fileRel.startsWith(p));
}

// ---- Rule config ----

const POLICY_PREFIX = "supabase/functions/_shared/revenue_os_kernel/policies/";

const FORBIDDEN_POLICY_IMPORT_PATTERNS: Array<{ name: string; re: RegExp }> = [
  // Policies must not import the dispatcher (control-plane separation).
  { name: "dispatcher", re: /revenue_os_kernel\/dispatcher|(?:^|\/)dispatcher(?:\.ts)?$/i },
  // Policies must not touch persistence/side-effect surfaces.
  { name: "channel_outbox", re: /channel_outbox/i },
  { name: "tasks", re: /(?:^|\/)tasks(?:\/|$)/i },
  // External providers / side-effect channels.
  { name: "twilio", re: /twilio/i },
  { name: "resend", re: /resend/i },
  { name: "email", re: /\bemail\b/i },
  { name: "sms", re: /\bsms\b/i },
  { name: "voice", re: /\bvoice\b/i },
];

const MODULE_ENTRYPOINT_PREFIXES = [
  "supabase/functions/lead-capture/",
  "supabase/functions/landing-form-submit/",
  "supabase/functions/outbound-booking-webhook/",
  "supabase/functions/revenue-os-guard-deal-update/",
  "supabase/functions/revenue-os-guard-send-invoice/",
  "supabase/functions/revenue-os-signal-usage-threshold/",
  "supabase/functions/revenue-os-signal-usage-threshold/",
  "supabase/functions/revenue-os-signal-usage-threshold/",
];

const DISPATCHER_FILE = "supabase/functions/_shared/revenue_os_kernel/dispatcher.ts";

const ALLOWED_OUTBOX_WRITERS_PREFIXES = [
  DISPATCHER_FILE,
  // Migrations may legitimately reference channel_outbox (DDL/data backfills).
  "supabase/migrations/",
  // Execution Kernel / outbox contract (existing production runtime)
  "supabase/functions/_shared/outbox-contract.ts",
  "supabase/functions/run-job-queue/",
  "supabase/functions/process-scheduled-emails/",
  "supabase/functions/channel-outbox-webhook/",
  "supabase/functions/email-deploy/",
  "supabase/functions/vapi-outbound-call/",
  "supabase/functions/execute-voice-campaign/",
  "supabase/functions/campaign-schedule-outbox/",
  // QA / infra tools
  "supabase/functions/qa-execution-cert/",
  "supabase/functions/infrastructure-test-runner/",
  "supabase/functions/slo-monitor/",
];

const OUTBOX_WRITE_PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: "postgrest_insert", re: /\.from\(\s*["']channel_outbox["']\s*\)\s*\.insert\(/g },
  { name: "postgrest_upsert", re: /\.from\(\s*["']channel_outbox["']\s*\)\s*\.upsert\(/g },
  { name: "postgrest_update", re: /\.from\(\s*["']channel_outbox["']\s*\)\s*\.update\(/g },
  { name: "postgrest_delete", re: /\.from\(\s*["']channel_outbox["']\s*\)\s*\.delete\(/g },
  { name: "sql_insert", re: /\bINSERT\s+INTO\s+(?:public\.)?channel_outbox\b/gi },
  { name: "sql_update", re: /\bUPDATE\s+(?:public\.)?channel_outbox\b/gi },
];

// ---- Rules ----

function rulePoliciesNoSideEffectImports(files: string[]): Violation[] {
  const violations: Violation[] = [];

  for (const fileRel of files) {
    if (!fileRel.startsWith(POLICY_PREFIX)) continue;
    if (!isTsLike(fileRel)) continue;

    const src = read(path.join(REPO_ROOT, fileRel));
    const imports = getImports(src).join("\n").toLowerCase();

    for (const pat of FORBIDDEN_POLICY_IMPORT_PATTERNS) {
      if (pat.re.test(imports)) {
        violations.push({
          rule: "policy_no_side_effect_imports",
          file: fileRel,
          detail: `imports match forbidden pattern ${JSON.stringify(pat.name)}`,
        });
      }
    }

    // Also block accidental direct client usage or network calls even without imports.
    const forbiddenBodyTokens = ["supabase.functions.invoke", ".from(\"channel_outbox\")", ".from('channel_outbox')", "fetch("];
    for (const tok of forbiddenBodyTokens) {
      if (src.includes(tok)) {
        violations.push({
          rule: "policy_no_side_effects_in_body",
          file: fileRel,
          detail: `contains forbidden token ${JSON.stringify(tok)}`,
        });
      }
    }
  }

  return violations;
}

function ruleEntrypointsNoDispatcherImport(files: string[]): Violation[] {
  const violations: Violation[] = [];
  const entrypointFiles = files.filter((f) => f.endsWith("/index.ts") && startsWithAny(f, MODULE_ENTRYPOINT_PREFIXES));

  for (const fileRel of entrypointFiles) {
    const src = read(path.join(REPO_ROOT, fileRel));
    const imports = getImports(src).join("\n");
    if (imports.includes("revenue_os_kernel/dispatcher") || imports.includes("./dispatcher") || imports.includes("../dispatcher")) {
      violations.push({
        rule: "entrypoints_do_not_import_dispatcher",
        file: fileRel,
        detail: "module entrypoint imports dispatcher directly",
      });
    }
  }

  // Also ensure frontend doesn’t import it.
  const frontendFiles = files.filter((f) => (f.startsWith("src/") && isTsLike(f)));
  for (const fileRel of frontendFiles) {
    const src = read(path.join(REPO_ROOT, fileRel));
    if (src.includes("revenue_os_kernel/dispatcher")) {
      violations.push({
        rule: "frontend_do_not_import_dispatcher",
        file: fileRel,
        detail: "frontend imports dispatcher directly",
      });
    }
  }

  return violations;
}

function ruleOnlyAllowedFilesWriteOutbox(files: string[]): Violation[] {
  const violations: Violation[] = [];

  for (const fileRel of files) {
    if (!(isTsLike(fileRel) || isSql(fileRel))) continue;

    const src = read(path.join(REPO_ROOT, fileRel));

    const wroteOutbox = OUTBOX_WRITE_PATTERNS.some((p) => p.re.test(src));
    if (!wroteOutbox) continue;

    const allowed =
      fileRel === DISPATCHER_FILE ||
      startsWithAny(fileRel, ALLOWED_OUTBOX_WRITERS_PREFIXES);

    if (!allowed) {
      violations.push({
        rule: "only_dispatcher_or_allowlist_writes_channel_outbox",
        file: fileRel,
        detail: "writes to channel_outbox outside dispatcher/allowlist",
      });
    }
  }

  return violations;
}

function printViolations(violations: Violation[]) {
  const byRule = new Map<string, Violation[]>();
  for (const v of violations) {
    const arr = byRule.get(v.rule) || [];
    arr.push(v);
    byRule.set(v.rule, arr);
  }

  for (const [rule, vs] of byRule.entries()) {
    console.error(`\n❌ ${rule} (${vs.length})`);
    for (const v of vs) {
      console.error(`- ${v.file}: ${v.detail}`);
    }
  }
}

function main() {
  const allAbs = walk(REPO_ROOT);
  const files = allAbs.map(rel);

  const violations: Violation[] = [
    ...rulePoliciesNoSideEffectImports(files),
    ...ruleEntrypointsNoDispatcherImport(files),
    ...ruleOnlyAllowedFilesWriteOutbox(files),
  ];

  if (violations.length > 0) {
    console.error("\nRevenue OS Kernel invariants FAILED. Fix violations before merging.\n");
    printViolations(violations);
    console.error("\nRULES (non-negotiable): modules emit events; kernel decides; dispatcher acts; policies never execute.\n");
    process.exit(1);
  }

  console.log("✅ Revenue OS Kernel invariants PASSED");
}

main();


