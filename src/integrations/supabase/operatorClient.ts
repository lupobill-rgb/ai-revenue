import { createClient } from "@supabase/supabase-js";

// Operator UI uses tables that may not be present in the generated Database types yet.
// We intentionally use an untyped client here to avoid type drift blocking the UI.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabaseOperator = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});

