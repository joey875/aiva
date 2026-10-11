import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export const metadata = { title: "Salespeople" };

const ROLE: Record<string, string> = { super_admin: "Owner", account_admin: "Admin", rep: "Salesperson" };

export default async function RepsPage() {
  const me = await requireAdmin();
  const supabase = await createClient();
  const [{ data: people }, { data: companies }, { data: links }] = await Promise.all([
    supabase.from("profiles").select("id, account_id, role, full_name, email, phone, active").eq("account_id", me.account_id).order("full_name"),
    supabase.from("companies").select("id, name").eq("account_id", me.account_id).is("archived_at", null),
    supabase.from("company_reps").select("company_id, user_id").eq("account_id", me.account_id),
  ]);
  const companyName = new Map((companies ?? []).map((c) => [c.id as string, c.name as string]));
  const list = (people ?? []) as Profile[];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-text-muted">{list.filter((p) => p.active).length} active</p>
        <Link href="/admin/reps/new" className="btn btn-primary">Add salesperson</Link>
      </div>
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
        {list.map((p) => {
          const theirs = (links ?? []).filter((l) => l.user_id === p.id).map((l) => companyName.get(l.company_id)).filter(Boolean);
          return (
            <li key={p.id}>
              <Link href={`/admin/reps/${p.id}`} className={`flex items-center gap-3 px-4 py-3 hover:bg-surface-2 ${p.active ? "" : "opacity-60"}`}>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">
                    {p.full_name || p.email}
                    {p.id === me.id && <span className="font-normal text-text-muted"> (you)</span>}
                  </p>
                  <p className="truncate text-sm text-text-muted">
                    {theirs.length ? theirs.join(", ") : "No companies assigned"}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold text-text-muted">{p.active ? ROLE[p.role] : "Deactivated"}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
