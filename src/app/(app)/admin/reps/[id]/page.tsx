import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import { resendInvite, saveRepCompanies, saveRepDetails, setRepActive } from "../../actions";

export const metadata = { title: "Salesperson" };

export default async function RepPage({ params, searchParams }: PageProps<"/admin/reps/[id]">) {
  const { id } = await params;
  const { invited } = await searchParams;
  const me = await requireAdmin();
  const supabase = await createClient();

  const [{ data: person }, { data: companies }, { data: links }, { count }] = await Promise.all([
    supabase.from("profiles").select("id, account_id, role, full_name, email, phone, active").eq("id", id).maybeSingle(),
    supabase.from("companies").select("id, name").eq("account_id", me.account_id).is("archived_at", null).order("name"),
    supabase.from("company_reps").select("company_id").eq("user_id", id),
    supabase.from("customers").select("id", { count: "exact", head: true }).eq("owner_id", id),
  ]);
  if (!person) notFound();
  const p = person as Profile;
  const assigned = new Set((links ?? []).map((l) => l.company_id as string));
  const isMe = p.id === me.id;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <Link href="/admin/reps" className="text-sm font-semibold text-text-muted hover:text-text">Salespeople</Link>
        <h2 className="text-xl font-bold">{p.full_name || p.email}</h2>
        <p className="text-text-muted">{p.email}, {count ?? 0} customers</p>
      </div>

      {invited && (
        <p role="status" className="rounded-lg bg-surface-2 px-3 py-2">Invite sent to {p.email}.</p>
      )}
      {!p.active && (
        <p className="rounded-lg bg-danger-bg px-3 py-2 text-danger">Deactivated. They can&apos;t sign in or see any customers.</p>
      )}

      <form action={saveRepCompanies.bind(null, p.id)} className="rounded-xl border border-border bg-surface p-4">
        <fieldset>
          <legend className="mb-2 text-lg font-bold">Companies</legend>
          <div className="space-y-1">
            {(companies ?? []).map((c) => (
              <label key={c.id} className="flex min-h-12 items-center gap-3 rounded-lg px-1">
                <input type="checkbox" name="company_ids" value={c.id} defaultChecked={assigned.has(c.id)} className="h-5 w-5 accent-[var(--primary)]" />
                {c.name}
              </label>
            ))}
          </div>
        </fieldset>
        <button className="btn btn-primary mt-3">Save companies</button>
      </form>

      <form action={saveRepDetails.bind(null, p.id)} className="space-y-3 rounded-xl border border-border bg-surface p-4">
        <h3 className="text-lg font-bold">Details</h3>
        <div>
          <label className="label" htmlFor="full_name">Name</label>
          <input id="full_name" name="full_name" defaultValue={p.full_name} required className="field" />
        </div>
        <div>
          <label className="label" htmlFor="phone">Phone</label>
          <input id="phone" name="phone" type="tel" defaultValue={p.phone ?? ""} className="field" />
        </div>
        <button className="btn btn-quiet">Save details</button>
      </form>

      {!isMe && (
        <div className="flex flex-wrap gap-3">
          {p.active && (
            <form action={resendInvite.bind(null, p.id)}>
              <button className="btn btn-quiet">Email a new sign-in link</button>
            </form>
          )}
          <form action={setRepActive.bind(null, p.id, !p.active)}>
            <button className={`btn ${p.active ? "border border-danger text-danger" : "btn-primary"}`}>
              {p.active ? "Deactivate" : "Reactivate"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
