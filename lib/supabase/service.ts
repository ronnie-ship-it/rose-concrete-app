import { createClient as createServiceClient } from "@supabase/supabase-js";

/**
 * Server-only client that uses the SUPABASE_SERVICE_ROLE_KEY. Bypasses RLS.
 *
 * Use this ONLY for trusted server flows that have already validated their
 * own authorization (e.g. matching a public_token from a URL). NEVER call
 * this from a client component or pass the result to one.
 */
export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase service role env vars missing — check .env.local."
    );
  }
  return createServiceClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
