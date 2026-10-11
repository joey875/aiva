import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { InviteForm } from "./invite-form";

export const metadata = { title: "Add salesperson" };

export default async function NewRepPage() {
  const me = await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase.from("companies").select("id, name").eq("account_id", me.account_id).is("archived_at", null).order("name");

  return (
    <div className="mx-auto max-w-xl">
      <h2 className="mb-1 text-xl font-bold">Add salesperson</h2>
      <p className="mb-5 text-text-muted">They&apos;ll get an email invite with a link to sign in.</p>
      <InviteForm companies={(data ?? []) as { id: string; name: string }[]} />
    </div>
  );
}
