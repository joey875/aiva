"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCompanyContext, getStages } from "@/lib/companies";
import { logActivity } from "@/lib/activity";
import { localToISO } from "@/lib/time";
import { isAdmin, type CustomerStatus } from "@/lib/types";

export type FormState = { error?: string };

const STATUSES: CustomerStatus[] = ["lead", "prospect", "active", "won", "lost"];
const text = (f: FormData, k: string) => {
  const v = String(f.get(k) ?? "").trim();
  return v === "" ? null : v;
};

function readCustomer(f: FormData) {
  const interest = Number(f.get("interest_level"));
  const status = String(f.get("status") ?? "lead") as CustomerStatus;
  const nextAt = text(f, "next_step_at");
  return {
    business_name: text(f, "business_name") ?? "",
    contact_name: text(f, "contact_name") ?? "",
    title: text(f, "title"),
    phone: text(f, "phone"),
    email: text(f, "email")?.toLowerCase() ?? null,
    address: text(f, "address"),
    city: text(f, "city"),
    website: text(f, "website"),
    source: text(f, "source"),
    status: STATUSES.includes(status) ? status : "lead",
    stage_id: text(f, "stage_id"),
    interest_level: interest >= 1 && interest <= 10 ? interest : null,
    people_notes: text(f, "people_notes"),
    notes: text(f, "notes"),
    next_step: text(f, "next_step"),
    next_step_at: nextAt ? localToISO(nextAt) : null,
  };
}

export async function createCustomer(_: FormState, formData: FormData): Promise<FormState> {
  const { profile, current } = await getCompanyContext();
  if (!current) return { error: "Pick a company first." };

  const fields = readCustomer(formData);
  if (!fields.business_name && !fields.contact_name) return { error: "Add a business name or a contact name." };

  // Reps always own what they create. Admins can assign an owner.
  const owner = isAdmin(profile) ? (text(formData, "owner_id") ?? profile.id) : profile.id;
  if (!fields.stage_id) fields.stage_id = (await getStages(current.id))[0]?.id ?? null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .insert({ ...fields, company_id: current.id, account_id: current.account_id, owner_id: owner })
    .select("id")
    .single();
  if (error || !data) return { error: "Couldn't save this customer. Check the fields and try again." };

  await logActivity(supabase, profile, {
    company_id: current.id,
    customer_id: data.id,
    kind: "created",
    summary: "Customer added",
  });

  revalidatePath("/customers");
  redirect(`/customers/${data.id}`);
}

export async function updateCustomer(id: string, _: FormState, formData: FormData): Promise<FormState> {
  const { profile } = await getCompanyContext();
  const supabase = await createClient();

  const { data: before } = await supabase.from("customers").select("company_id, stage_id, owner_id").eq("id", id).maybeSingle();
  if (!before) return { error: "This customer isn't available to you." };

  const fields = readCustomer(formData);
  if (!fields.business_name && !fields.contact_name) return { error: "Add a business name or a contact name." };
  const update: Record<string, unknown> = { ...fields };
  if (isAdmin(profile) && text(formData, "owner_id")) update.owner_id = text(formData, "owner_id");

  const { error } = await supabase.from("customers").update(update).eq("id", id);
  if (error) return { error: "Couldn't save changes. Check the fields and try again." };

  await logActivity(supabase, profile, {
    company_id: before.company_id,
    customer_id: id,
    kind: before.stage_id !== fields.stage_id ? "stage_change" : "edited",
    summary: before.stage_id !== fields.stage_id ? "Stage changed" : "Details updated",
  });

  revalidatePath(`/customers/${id}`);
  revalidatePath("/customers");
  redirect(`/customers/${id}`);
}

export async function moveStage(customerId: string, stageId: string) {
  const { profile } = await getCompanyContext();
  const supabase = await createClient();

  const { data: customer } = await supabase
    .from("customers")
    .select("company_id, stage_id")
    .eq("id", customerId)
    .maybeSingle();
  if (!customer || customer.stage_id === stageId) return;

  const stages = await getStages(customer.company_id);
  const from = stages.find((s) => s.id === customer.stage_id);
  const to = stages.find((s) => s.id === stageId);
  if (!to) return;

  const update: Record<string, unknown> = { stage_id: to.id };
  if (to.is_won) update.status = "won";
  else if (to.is_lost) update.status = "lost";

  const { error } = await supabase.from("customers").update(update).eq("id", customerId);
  if (error) return;

  await logActivity(supabase, profile, {
    company_id: customer.company_id,
    customer_id: customerId,
    kind: "stage_change",
    summary: `Moved from ${from?.name ?? "no stage"} to ${to.name}`,
    data: { from: from?.id ?? null, to: to.id },
  });

  revalidatePath("/pipeline");
  revalidatePath(`/customers/${customerId}`);
}

export async function addNote(customerId: string, formData: FormData) {
  const note = String(formData.get("note") ?? "").trim();
  if (!note) return;
  const { profile } = await getCompanyContext();
  const supabase = await createClient();
  const { data: customer } = await supabase.from("customers").select("company_id").eq("id", customerId).maybeSingle();
  if (!customer) return;

  await logActivity(supabase, profile, {
    company_id: customer.company_id,
    customer_id: customerId,
    kind: "note",
    summary: note.slice(0, 2000),
  });
  revalidatePath(`/customers/${customerId}`);
}
