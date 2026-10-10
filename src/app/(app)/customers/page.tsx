import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCompanyContext, getStages } from "@/lib/companies";
import { getPeopleNames } from "@/lib/people";
import { relativeDay } from "@/lib/time";
import { customerName, isAdmin, type Customer } from "@/lib/types";
import { EmptyState } from "@/components/empty-state";

export const metadata = { title: "Customers" };

export default async function CustomersPage({ searchParams }: PageProps<"/customers">) {
  const { profile, current } = await getCompanyContext();
  if (!current) return <EmptyState title="No company assigned yet" body="Ask your admin to add you to a company." />;

  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const stageFilter = typeof sp.stage === "string" ? sp.stage : "";

  const supabase = await createClient();
  const stages = await getStages(current.id);
  let query = supabase
    .from("customers")
    .select("id, business_name, contact_name, phone, city, stage_id, owner_id, next_step, next_step_at, interest_level")
    .eq("company_id", current.id)
    .order("updated_at", { ascending: false })
    .limit(200);
  if (stageFilter) query = query.eq("stage_id", stageFilter);
  if (q) {
    const safe = q.replace(/[%,()]/g, " ");
    query = query.or(
      ["business_name", "contact_name", "phone", "email", "city"].map((c) => `${c}.ilike.%${safe}%`).join(","),
    );
  }
  const { data } = await query;
  const customers = (data ?? []) as Customer[];
  const stageName = new Map(stages.map((s) => [s.id, s.name]));
  const names = isAdmin(profile) ? await getPeopleNames() : null;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
        <Link href="/customers/new" className="btn btn-primary">Add customer</Link>
      </div>

      <form className="mb-5 grid gap-2 sm:grid-cols-[1fr_14rem_auto]" role="search">
        <label className="sr-only" htmlFor="q">Search customers</label>
        <input id="q" name="q" type="search" defaultValue={q} placeholder="Search name, phone, email, city" className="field" />
        <label className="sr-only" htmlFor="stage">Filter by stage</label>
        <select id="stage" name="stage" defaultValue={stageFilter} className="field">
          <option value="">All stages</option>
          {stages.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <button className="btn btn-quiet">Search</button>
      </form>

      {customers.length === 0 ? (
        q || stageFilter ? (
          <EmptyState title="No matches" body="Try a different name or clear the stage filter." />
        ) : (
          <EmptyState title="No customers yet" body={`Add your first ${current.name} customer to start the pipeline.`} href="/customers/new" cta="Add customer" />
        )
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {customers.map((c) => {
            const overdue = c.next_step_at && new Date(c.next_step_at) < new Date();
            return (
              <li key={c.id}>
                <Link href={`/customers/${c.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{customerName(c)}</p>
                    <p className="truncate text-sm text-ink-soft">
                      {[c.business_name && c.contact_name, c.city, names?.get(c.owner_id)].filter(Boolean).join(", ")}
                    </p>
                    {c.next_step && (
                      <p className={`mt-0.5 truncate text-sm ${overdue ? "font-semibold text-attention" : "text-ink-soft"}`}>
                        {c.next_step_at ? `${relativeDay(c.next_step_at)}: ` : ""}
                        {c.next_step}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold text-ink-soft">
                    {c.stage_id ? stageName.get(c.stage_id) : "No stage"}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
