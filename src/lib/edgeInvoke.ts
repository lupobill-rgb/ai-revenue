import { supabase } from "@/integrations/supabase/client";

function summarizeEdgeInvokeError(fn: string, error: any) {
  const status =
    error?.status ??
    error?.statusCode ??
    error?.context?.status ??
    error?.context?.response?.status ??
    error?.context?.statusCode ??
    null;

  const details =
    error?.details ??
    error?.context?.body ??
    error?.context?.responseText ??
    error?.context?.response?.body ??
    error?.context?.response?.statusText ??
    null;

  const base = `[${fn}] Edge Function failed`;
  const parts = [
    status ? `status=${status}` : null,
    error?.message ? `message=${String(error.message)}` : null,
    details ? `details=${typeof details === "string" ? details : JSON.stringify(details)}` : null,
  ].filter(Boolean);

  return `${base}${parts.length ? ` (${parts.join(", ")})` : ""}`;
}

export async function invokeEdge<T>(fn: string, body: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(fn, { body });
  if (error) {
    // eslint-disable-next-line no-console
    console.error("[edge] invoke failed", { fn, error });
    throw new Error(summarizeEdgeInvokeError(fn, error));
  }
  return data as T;
}

