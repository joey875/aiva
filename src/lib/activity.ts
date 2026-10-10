import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isAdmin, type Profile } from "@/lib/types";

export async function logActivity(
  supabase: SupabaseClient,
  profile: Profile,
  entry: { company_id: string; customer_id: string; kind: string; summary: string; data?: Record<string, unknown> },
) {
  await supabase.from("activity_log").insert({
    ...entry,
    data: entry.data ?? {},
    actor_id: profile.id,
    actor_type: isAdmin(profile) ? "admin" : "rep",
  });
  await supabase.from("customers").update({ last_activity_at: new Date().toISOString() }).eq("id", entry.customer_id);
}
