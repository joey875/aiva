import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { COMPANY_COOKIE } from "@/lib/companies";
import type { Company, Profile } from "@/lib/types";

export type VoiceContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  profile: Profile;
  companies: Company[];
  current: Company | null;
};

/**
 * Same shape as getCompanyContext(), but returns null instead of redirecting -
 * an API route needs a 401 JSON response, not a Next.js redirect.
 */
export async function getVoiceContext(): Promise<VoiceContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("id, account_id, role, full_name, email, phone, active")
    .eq("id", user.id)
    .maybeSingle();
  if (!profileRow || !profileRow.active) return null;
  const profile = profileRow as Profile;

  const { data: companyRows } = await supabase
    .from("companies")
    .select("id, account_id, name, brand_color, archived_at")
    .eq("account_id", profile.account_id)
    .is("archived_at", null)
    .order("name");
  const companies = (companyRows ?? []) as Company[];
  const wanted = (await cookies()).get(COMPANY_COOKIE)?.value;
  const current = companies.find((c) => c.id === wanted) ?? companies[0] ?? null;

  return { supabase, profile, companies, current };
}
