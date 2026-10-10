import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

/** Salespeople an admin can assign customers to in a company (assigned reps plus the admin). */
export async function getOwnerOptions(companyId: string, me: Profile) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("company_reps")
    .select("user_id, profiles!inner(id, full_name, email, active)")
    .eq("company_id", companyId);

  const options = new Map<string, string>();
  options.set(me.id, `${me.full_name || me.email} (you)`);
  for (const row of (data ?? []) as unknown as { profiles: { id: string; full_name: string; email: string; active: boolean } }[]) {
    if (row.profiles.active && !options.has(row.profiles.id)) {
      options.set(row.profiles.id, row.profiles.full_name || row.profiles.email);
    }
  }
  return [...options].map(([id, name]) => ({ id, name }));
}

/** id -> display name for people the current user can see. */
export async function getPeopleNames(): Promise<Map<string, string>> {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id, full_name, email");
  return new Map((data ?? []).map((p) => [p.id as string, (p.full_name as string) || (p.email as string)]));
}
