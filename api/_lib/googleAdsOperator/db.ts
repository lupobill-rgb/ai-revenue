import { createClient } from "@supabase/supabase-js";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export function supabaseAdmin() {
  const url = requireEnv("SUPABASE_URL");
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

export type ActionEventInsert = {
  workspace_id: string;
  ad_account_id: string;
  proposal_id?: string | null;
  event_type:
    | "proposal_created"
    | "governor_blocked"
    | "queued_for_approval"
    | "approved"
    | "rejected"
    | "execution_started"
    | "execution_succeeded"
    | "execution_failed"
    | "verification_succeeded"
    | "verification_failed"
    | "reverted"
    | "note";
  actor_type: "ai" | "human" | "system";
  actor_id?: string | null;
  run_id?: string | null;
  message: string;
  details?: Record<string, unknown>;
};

