import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin, type Profile } from "@/lib/types";

/** The signed-in user's profile, or null. Cached per request. */
export const getProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id, account_id, role, full_name, email, phone, active")
    .eq("id", user.id)
    .maybeSingle();

  return data && data.active ? (data as Profile) : null;
});

export async function requireProfile(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/login?error=no_access");
  return profile;
}

export async function requireAdmin(): Promise<Profile> {
  const profile = await requireProfile();
  if (!isAdmin(profile)) redirect("/");
  return profile;
}
