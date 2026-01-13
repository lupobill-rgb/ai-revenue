import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

// This repo historically used VITE_SUPABASE_PUBLISHABLE_KEY for the Supabase anon key.
// Prefer VITE_SUPABASE_ANON_KEY if present, but keep a safe fallback to avoid breaking existing setups.
export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// In-memory storage (works when localStorage / site data is blocked).
// Note: session will NOT persist across reloads (by design).
const memoryStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
  };
})();

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: memoryStorage,
    persistSession: true,
    autoRefreshToken: true,
    // Prevent stale cross-project / cross-origin session collisions during local dev.
    // (Supabase otherwise uses sb-<project-ref> keys which can linger across setups.)
    storageKey: "sb-ai-revenue-local",
    detectSessionInUrl: true,
  },
});

