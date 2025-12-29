import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "..", "..");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

function read(p: string) {
  return fs.readFileSync(p, "utf8");
}

function rel(p: string) {
  return path.relative(REPO_ROOT, p).replace(/\\/g, "/");
}

describe("Revenue OS Kernel invariants (policy purity + control-plane boundaries)", () => {
  it("policies do not import/perform side effects (email/sms/tasks/outbox/network)", () => {
    const policiesDir = path.join(REPO_ROOT, "supabase", "functions", "_shared", "revenue_os_kernel", "policies");
    const policyFiles = walk(policiesDir).filter((p) => p.endsWith(".ts"));

    const violations: string[] = [];
    for (const file of policyFiles) {
      const txt = read(file);
      const r = rel(file);

      // Policies may only be pure decision logic. Block common side-effect surfaces.
      const forbidden = [
        "channel_outbox",
        ".from(\"channel_outbox\")",
        ".from('channel_outbox')",
        ".from(\"tasks\")",
        ".from('tasks')",
        "supabase.functions.invoke",
        "createClient(",
        "fetch(",
        "Deno.env",
      ];

      for (const f of forbidden) {
        if (txt.includes(f)) violations.push(`${r}: contains forbidden token ${JSON.stringify(f)}`);
      }
    }

    expect(violations).toEqual([]);
  });

  it("only dispatcher touches outbox/tasks within revenue_os_kernel shared runtime", () => {
    const baseDir = path.join(REPO_ROOT, "supabase", "functions", "_shared", "revenue_os_kernel");
    const files = walk(baseDir).filter((p) => p.endsWith(".ts"));
    const dispatcher = path.join(baseDir, "dispatcher.ts");

    const violations: string[] = [];
    for (const file of files) {
      if (file === dispatcher) continue;
      const txt = read(file);
      const r = rel(file);
      if (txt.includes("channel_outbox") || txt.includes(".from(\"tasks\")") || txt.includes(".from('tasks')")) {
        violations.push(`${r}: revenue_os_kernel non-dispatcher references outbox/tasks`);
      }
    }
    expect(violations).toEqual([]);
  });

  it("no frontend code imports the Revenue OS dispatcher directly", () => {
    const srcDir = path.join(REPO_ROOT, "src");
    const files = walk(srcDir).filter((p) => p.endsWith(".ts") || p.endsWith(".tsx"));
    const violations: string[] = [];

    for (const file of files) {
      const txt = read(file);
      const r = rel(file);
      if (txt.includes("revenue_os_kernel/dispatcher")) violations.push(`${r}: imports dispatcher`);
    }

    expect(violations).toEqual([]);
  });
});


