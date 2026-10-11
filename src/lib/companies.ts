import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import type { Company, Stage } from "@/lib/types";

export const COMPANY_COOKIE = "aiva_company";

/**
 * Companies the signed-in user can work in, plus the one currently selected.
 * RLS decides visibility: admins see every company in their account,
 * reps see only the companies they're assigned to.
 */
export const getCompanyContext = cache(async () => {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data } = await supabase
    .from("companies")
    .select("id, account_id, name, archived_at")
    .eq("account_id", profile.account_id)
    .is("archived_at", null)
    .order("name");

  const companies = (data ?? []) as Company[];
  const wanted = (await cookies()).get(COMPANY_COOKIE)?.value;
  const current = companies.find((c) => c.id === wanted) ?? companies[0] ?? null;

  return { profile, companies, current };
});

export async function getStages(companyId: string): Promise<Stage[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("pipeline_stages")
    .select("id, company_id, name, position, is_won, is_lost")
    .eq("company_id", companyId)
    .order("position");
  return (data ?? []) as Stage[];
}
