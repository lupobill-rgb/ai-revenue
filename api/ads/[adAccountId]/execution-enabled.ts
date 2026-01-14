import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export const config = {
  api: {
    bodyParser: true,
  },
};

const BodySchema = z.object({
  enabled: z.boolean(),
});

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function getBearerToken(req: any): string {
  const raw = req.headers?.authorization || req.headers?.Authorization;
  if (!raw || typeof raw !== "string") throw new Error("Missing Authorization header");
  if (!raw.startsWith("Bearer ")) throw new Error("Invalid Authorization header");
  return raw.slice(7);
}

function supabaseService() {
  const url = requireEnv("SUPABASE_URL");
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== "PUT") return res.status(405).json({ error: "Method not allowed" });

    const adAccountId = String(req.query?.adAccountId || "");
    if (!adAccountId) return res.status(400).json({ error: "Missing adAccountId" });

    const body = BodySchema.parse(req.body);
    const token = getBearerToken(req);

    const supabase = supabaseService();

    const { data: userResp, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userResp?.user) return res.status(401).json({ error: "Unauthorized" });

    const userId = userResp.user.id;

    // Admin-only: platform admins only.
    const { data: adminRow, error: adminErr } = await supabase
      .from("platform_admins")
      .select("user_id, is_active")
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle();
    if (adminErr) return res.status(500).json({ error: adminErr.message });
    if (!adminRow) return res.status(403).json({ error: "Forbidden" });

    const { data: updated, error: updErr } = await supabase
      .from("ad_accounts")
      .update({ execution_enabled: body.enabled })
      .eq("id", adAccountId)
      .select("id, execution_enabled")
      .maybeSingle();
    if (updErr) return res.status(500).json({ error: updErr.message });
    if (!updated) return res.status(404).json({ error: "Not found" });

    return res.status(200).json({ ok: true, adAccount: updated });
  } catch (err: any) {
    const msg = err?.message ? String(err.message) : "Unknown error";
    const code =
      msg.includes("Missing Authorization") || msg.includes("Invalid Authorization") ? 401 :
      msg === "Forbidden" ? 403 :
      msg.startsWith("Missing required env var") ? 500 :
      500;
    return res.status(code).json({ ok: false, error: msg });
  }
}

