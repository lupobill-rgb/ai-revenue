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
});


