import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Company } from "@/lib/types";
import { setCompanyArchived, updateCompany } from "../actions";
import { NewCompanyForm } from "./new-company-form";

export const metadata = { title: "Companies" };

export default async function CompaniesPage() {
  const me = await requireAdmin();
  const supabase = await createClient();
  const [{ data }, { data: assignments }, { data: customers }] = await Promise.all([
    supabase.from("companies").select("id, account_id, name, brand_color, archived_at").eq("account_id", me.account_id).order("name"),
    supabase.from("company_reps").select("company_id").eq("account_id", me.account_id),
    supabase.from("customers").select("company_id").eq("account_id", me.account_id),
  ]);
  const companies = (data ?? []) as Company[];
  const count = (rows: { company_id: string }[] | null, id: string) => (rows ?? []).filter((r) => r.company_id === id).length;
  const active = companies.filter((c) => !c.archived_at);
  const archived = companies.filter((c) => c.archived_at);

  return (
    <div className="space-y-8">
      <ul className="space-y-3">
        {active.map((c) => (
          <li key={c.id} className="rounded-xl border border-line bg-surface p-4">
            <form action={updateCompany.bind(null, c.id)} className="flex flex-wrap items-end gap-3">
              <span aria-hidden className="h-12 w-2 rounded-full" style={{ background: c.brand_color ?? "var(--ava)" }} />
              <div className="min-w-48 flex-1">
                <label className="label" htmlFor={`name-${c.id}`}>Name</label>
                <input id={`name-${c.id}`} name="name" defaultValue={c.name} className="field" required />
              </div>
              <div>
                <label className="label" htmlFor={`color-${c.id}`}>Color</label>
                <input id={`color-${c.id}`} name="brand_color" type="color" defaultValue={c.brand_color ?? "#0e7c7b"} className="h-12 w-16 cursor-pointer rounded-lg border border-line bg-surface p-1" />
              </div>
              <button className="btn btn-quiet">Save</button>
            </form>
            <div className="mt-3 flex items-center justify-between gap-3 text-sm text-ink-soft">
              <span>
                {count(assignments, c.id)} salespeople, {count(customers, c.id)} customers
              </span>
              <form action={setCompanyArchived.bind(null, c.id, true)}>
                <button className="min-h-11 px-2 font-semibold text-danger hover:underline">Archive</button>
              </form>
            </div>
          </li>
        ))}
      </ul>

      <section aria-labelledby="add-company" className="rounded-xl border border-dashed border-line p-4">
        <h2 id="add-company" className="mb-3 text-lg font-bold">Add a company</h2>
        <NewCompanyForm />
      </section>

      {archived.length > 0 && (
        <section aria-labelledby="archived">
          <h2 id="archived" className="mb-2 text-lg font-bold">Archived</h2>
          <p className="mb-3 text-sm text-ink-soft">Archived companies are hidden from salespeople. Their customers are kept.</p>
          <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
            {archived.map((c) => (
              <li key={c.id} className="flex items-center justify-between px-4 py-2">
                <span>{c.name}</span>
                <form action={setCompanyArchived.bind(null, c.id, false)}>
                  <button className="min-h-11 px-2 font-semibold text-ava hover:underline">Restore</button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
