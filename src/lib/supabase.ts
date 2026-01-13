import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

// This repo historically used VITE_SUPABASE_PUBLISHABLE_KEY for the Supabase anon key.
// Prefer VITE_SUPABASE_ANON_KEY if present, but keep a safe fallback to avoid breaking existing setups.
export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});

