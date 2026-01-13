import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";

type InvokeEdgeArgs = {
  fn: string;
  body?: unknown;
};

export async function invokeEdgeAuthed<T>({ fn, body }: InvokeEdgeArgs): Promise<T> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;

  const token = data.session?.access_token;
  if (!token) throw new Error(`[${fn}] No session token`);

  const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`[${fn}] ${res.status}: ${text || "(empty body)"}`);

  if (!text) return {} as T;
  return JSON.parse(text) as T;
}

