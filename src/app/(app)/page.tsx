import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCompanyContext } from "@/lib/companies";
import { formatDateTime, formatTime, relativeDay, todayRange } from "@/lib/time";
import { customerName } from "@/lib/types";
import { EmptyState } from "@/components/empty-state";

export const metadata = { title: "Today" };

type Named = { id: string; business_name: string; contact_name: string } | null;

export default async function TodayPage() {
  const { profile, current } = await getCompanyContext();
  if (!current) return <EmptyState title="No company assigned yet" body="Ask your admin to add you to a company." />;

  const supabase = await createClient();
  const { start, end } = todayRange();
  const now = new Date().toISOString();

  const [appts, tasks, overdueCustomers] = await Promise.all([
    supabase
      .from("appointments")
      .select("id, title, starts_at, location, status, customers(id, business_name, contact_name)")
      .eq("company_id", current.id)
      .gte("starts_at", start)
      .lt("starts_at", end)
      .neq("status", "canceled")
      .order("starts_at"),
    supabase
      .from("tasks")
      .select("id, title, due_at, customers(id, business_name, contact_name)")
      .eq("company_id", current.id)
      .eq("status", "open")
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(50),
    supabase
      .from("customers")
      .select("id, business_name, contact_name, next_step, next_step_at")
      .eq("company_id", current.id)
      .lt("next_step_at", now)
      .not("status", "in", "(won,lost)")
      .order("next_step_at")
      .limit(50),
  ]);

  const allTasks = (tasks.data ?? []) as unknown as { id: string; title: string; due_at: string | null; customers: Named }[];
  const overdueTasks = allTasks.filter((t) => t.due_at && t.due_at < now);
  const openTasks = allTasks.filter((t) => !t.due_at || t.due_at >= now);
  const appointments = (appts.data ?? []) as unknown as { id: string; title: string | null; starts_at: string; location: string | null; customers: Named }[];
  const followUps = overdueCustomers.data ?? [];
  const overdueCount = overdueTasks.length + followUps.length;
  const first = profile.full_name.split(" ")[0];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{first ? `Hi ${first}.` : "Today"}</h1>
        <p className="text-ink-soft">
          {appointments.length === 0 ? "No appointments today" : `${appointments.length} appointment${appointments.length === 1 ? "" : "s"} today`}
          {overdueCount > 0 ? `, ${overdueCount} overdue follow-up${overdueCount === 1 ? "" : "s"}.` : "."}
        </p>
      </div>

      {overdueCount > 0 && (
        <section aria-labelledby="overdue" className="rounded-xl bg-attention-bg p-4">
          <h2 id="overdue" className="mb-2 text-lg font-bold text-attention">Overdue</h2>
          <ul className="space-y-2">
            {followUps.map((c) => (
              <li key={`c-${c.id}`}>
                <Link href={`/customers/${c.id}`} className="block rounded-lg bg-surface px-3 py-2.5 hover:bg-surface-2">
                  <p className="font-semibold">{customerName(c)}</p>
                  <p className="text-sm text-ink-soft">{c.next_step ?? "Follow up"}, due {relativeDay(c.next_step_at!).toLowerCase()}</p>
                </Link>
              </li>
            ))}
            {overdueTasks.map((t) => (
              <li key={`t-${t.id}`}>
                <TaskRow task={t} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="appts">
        <h2 id="appts" className="mb-2 text-lg font-bold">Today&apos;s appointments</h2>
        {appointments.length === 0 ? (
          <p className="text-ink-soft">Nothing on the calendar today.</p>
        ) : (
          <ol className="space-y-2">
            {appointments.map((a) => (
              <li key={a.id} className="flex gap-4 rounded-xl border border-line bg-surface px-4 py-3">
                <p className="w-20 shrink-0 text-lg font-bold">{formatTime(a.starts_at)}</p>
                <div className="min-w-0">
                  {a.customers ? (
                    <Link href={`/customers/${a.customers.id}`} className="font-semibold hover:underline">{customerName(a.customers)}</Link>
                  ) : (
                    <p className="font-semibold">{a.title ?? "Appointment"}</p>
                  )}
                  {a.location && <p className="truncate text-sm text-ink-soft">{a.location}</p>}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section aria-labelledby="tasks">
        <h2 id="tasks" className="mb-2 text-lg font-bold">Open tasks</h2>
        {openTasks.length === 0 ? (
          <p className="text-ink-soft">You&apos;re caught up.</p>
        ) : (
          <ul className="space-y-2">
            {openTasks.map((t) => (
              <li key={t.id}><TaskRow task={t} /></li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function TaskRow({ task }: { task: { title: string; due_at: string | null; customers: Named } }) {
  const body = (
    <>
      <p className="font-semibold">{task.title}</p>
      <p className="text-sm text-ink-soft">
        {[task.customers && customerName(task.customers), task.due_at && formatDateTime(task.due_at)].filter(Boolean).join(", ")}
      </p>
    </>
  );
  return task.customers ? (
    <Link href={`/customers/${task.customers.id}`} className="block rounded-lg border border-line bg-surface px-3 py-2.5 hover:bg-surface-2">{body}</Link>
  ) : (
    <div className="rounded-lg border border-line bg-surface px-3 py-2.5">{body}</div>
  );
}
