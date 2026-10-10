"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";

export type AdminState = { error?: string; ok?: string };

const HEX = /^#[0-9a-fA-F]{6}$/;
const clean = (v: FormDataEntryValue | null) => String(v ?? "").trim();

async function audit(action: string, target_table: string, target_id: string | null, data: Record<string, unknown> = {}) {
  const profile = await requireAdmin();
  // audit_events is server-written only
  await createAdminClient().from("audit_events").insert({
    account_id: profile.account_id,
    actor_id: profile.id,
    action,
    target_table,
    target_id,
    data,
  });
}

// ---------------- Companies ----------------

export async function createCompany(_: AdminState, formData: FormData): Promise<AdminState> {
  const profile = await requireAdmin();
  const name = clean(formData.get("name"));
  const color = clean(formData.get("brand_color"));
  if (!name) return { error: "Give the company a name." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("companies")
    .insert({ account_id: profile.account_id, name, brand_color: HEX.test(color) ? color : null })
    .select("id")
    .single();
  if (error || !data) return { error: "Couldn't add the company. Try again." };

  await audit("company.created", "companies", data.id, { name });
  revalidatePath("/", "layout");
  return { ok: `${name} added.` };
}

export async function updateCompany(id: string, formData: FormData) {
  await requireAdmin();
  const name = clean(formData.get("name"));
  const color = clean(formData.get("brand_color"));
  if (!name) return;
  const supabase = await createClient();
  await supabase.from("companies").update({ name, brand_color: HEX.test(color) ? color : null }).eq("id", id);
  await audit("company.updated", "companies", id, { name });
  revalidatePath("/", "layout");
}

export async function setCompanyArchived(id: string, archived: boolean) {
  await requireAdmin();
  const supabase = await createClient();
  await supabase.from("companies").update({ archived_at: archived ? new Date().toISOString() : null }).eq("id", id);
  await audit(archived ? "company.archived" : "company.restored", "companies", id);
  revalidatePath("/", "layout");
}

// ---------------- Salespeople ----------------

export async function inviteRep(_: AdminState, formData: FormData): Promise<AdminState> {
  const me = await requireAdmin();
  const full_name = clean(formData.get("full_name"));
  const email = clean(formData.get("email")).toLowerCase();
  const phone = clean(formData.get("phone")) || null;
  const role = clean(formData.get("role")) === "account_admin" ? "account_admin" : "rep";
  const companyIds = formData.getAll("company_ids").map(String);

  if (!full_name) return { error: "Add their name." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address." };

  // Only allow companies the admin can actually see in their own account
  const supabase = await createClient();
  const { data: allowed } = await supabase
    .from("companies")
    .select("id")
    .eq("account_id", me.account_id)
    .in("id", companyIds.length ? companyIds : ["00000000-0000-0000-0000-000000000000"]);
  const validIds = (allowed ?? []).map((c) => c.id as string);

  const admin = createAdminClient();
  const { data: existing } = await admin.from("profiles").select("id").ilike("email", email).maybeSingle();
  if (existing) return { error: "Someone with that email is already set up." };

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${env.siteUrl}/auth/confirm`,
    data: { full_name },
  });
  if (inviteError || !invited.user) {
    return { error: `Couldn't send the invite: ${inviteError?.message ?? "unknown error"}.` };
  }

  const userId = invited.user.id;
  const { error: profileError } = await admin
    .from("profiles")
    .insert({ id: userId, account_id: me.account_id, role, full_name, email, phone });
  if (profileError) {
    await admin.auth.admin.deleteUser(userId);
    return { error: "Couldn't create their profile. Nothing was saved; try again." };
  }

  if (validIds.length) {
    await admin
      .from("company_reps")
      .insert(validIds.map((company_id) => ({ company_id, user_id: userId, account_id: me.account_id })));
  }

  await audit("user.invited", "profiles", userId, { email, role, companies: validIds });
  revalidatePath("/admin/reps");
  redirect(`/admin/reps/${userId}?invited=1`);
}

export async function saveRepCompanies(userId: string, formData: FormData) {
  const me = await requireAdmin();
  const wanted = new Set(formData.getAll("company_ids").map(String));
  const supabase = await createClient();

  const [{ data: companies }, { data: current }] = await Promise.all([
    supabase.from("companies").select("id").eq("account_id", me.account_id),
    supabase.from("company_reps").select("company_id").eq("user_id", userId),
  ]);
  const valid = new Set((companies ?? []).map((c) => c.id as string));
  const have = new Set((current ?? []).map((r) => r.company_id as string));

  const toAdd = [...wanted].filter((id) => valid.has(id) && !have.has(id));
  const toRemove = [...have].filter((id) => !wanted.has(id));

  if (toAdd.length) {
    await supabase.from("company_reps").insert(toAdd.map((company_id) => ({ company_id, user_id: userId, account_id: me.account_id })));
  }
  if (toRemove.length) {
    await supabase.from("company_reps").delete().eq("user_id", userId).in("company_id", toRemove);
  }

  await audit("user.companies_changed", "profiles", userId, { added: toAdd, removed: toRemove });
  revalidatePath(`/admin/reps/${userId}`);
  revalidatePath("/admin/reps");
}

export async function saveRepDetails(userId: string, formData: FormData) {
  await requireAdmin();
  const full_name = clean(formData.get("full_name"));
  const phone = clean(formData.get("phone")) || null;
  if (!full_name) return;
  const supabase = await createClient();
  await supabase.from("profiles").update({ full_name, phone }).eq("id", userId);
  revalidatePath(`/admin/reps/${userId}`);
  revalidatePath("/admin/reps");
}

export async function setRepActive(userId: string, active: boolean) {
  const me = await requireAdmin();
  if (userId === me.id) return; // never lock yourself out
  const supabase = await createClient();
  await supabase.from("profiles").update({ active }).eq("id", userId);
  await audit(active ? "user.reactivated" : "user.deactivated", "profiles", userId);
  revalidatePath(`/admin/reps/${userId}`);
  revalidatePath("/admin/reps");
}

export async function resendInvite(userId: string) {
  const me = await requireAdmin();
  const supabase = await createClient();
  const { data: person } = await supabase.from("profiles").select("email, account_id").eq("id", userId).maybeSingle();
  if (!person || person.account_id !== me.account_id) return;
  // Service client (no browser cookies), so the link works on any device
  await createAdminClient().auth.signInWithOtp({
    email: person.email as string,
    options: { emailRedirectTo: `${env.siteUrl}/auth/confirm`, shouldCreateUser: false },
  });
  await audit("user.link_resent", "profiles", userId);
}
