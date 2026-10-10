import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * Service-role client. Bypasses RLS. Server-only, and only for:
 * inviting users, checking whether an email may sign in, and other
 * operations that must happen before a user has a session.
 */
export function createAdminClient() {
  if (!env.serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
