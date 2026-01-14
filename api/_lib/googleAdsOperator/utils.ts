import crypto from "node:crypto";

export function stableSha256(input: string): string {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

export function toIsoDate(d: Date): string {
  // YYYY-MM-DD in UTC
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function lookbackRangeUtc(lookbackDays: number, now: Date = new Date()): { start: string; end: string } {
  // Inclusive range [start, end]
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - Math.max(1, lookbackDays) + 1);
  return { start: toIsoDate(start), end: toIsoDate(end) };
}

export function safeNumber(v: unknown): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : 0;
}

