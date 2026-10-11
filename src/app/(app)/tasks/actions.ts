"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCompanyContext } from "@/lib/companies";
import { localToISO } from "@/lib/time";

export type FormState = { error?: string };

export async function createTask(_: FormState, formData: FormData): Promise<FormState> {
  const { profile, current } = await getCompanyContext();
  if (!current) return { error: "Pick a company first." };

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Add a title for this task." };
  const dueLocal = String(formData.get("due_at") ?? "").trim();

  const supabase = await createClient();
  const { error } = await supabase.from("tasks").insert({
    company_id: current.id,
    rep_id: profile.id,
    type: "follow_up",
    title: title.slice(0, 500),
    due_at: dueLocal ? localToISO(dueLocal) : null,
    status: "open",
    created_by: "rep",
  });
  if (error) return { error: "Couldn't save this task." };

  revalidatePath("/tasks");
  revalidatePath("/");
  return {};
}

export async function toggleTask(id: string, done: boolean) {
  const supabase = await createClient();
  await supabase
    .from("tasks")
    .update({ status: done ? "done" : "open", completed_at: done ? new Date().toISOString() : null })
    .eq("id", id);
  revalidatePath("/tasks");
  revalidatePath("/");
}
