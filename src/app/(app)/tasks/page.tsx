import { CheckSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCompanyContext } from "@/lib/companies";
import { customerName } from "@/lib/types";
import { EmptyState } from "@/components/empty-state";
import { NewTaskForm } from "@/components/new-task-form";
import { TaskRow, type TaskItem } from "@/components/task-row";

export const metadata = { title: "Tasks" };

type Named = { id: string; business_name: string; contact_name: string } | null;

export default async function TasksPage() {
  const { current } = await getCompanyContext();
  if (!current) return <EmptyState title="No company assigned yet" body="Ask your admin to add you to a company." />;

  const supabase = await createClient();
  const { data } = await supabase
    .from("tasks")
    .select("id, title, due_at, status, customers(id, business_name, contact_name)")
    .eq("company_id", current.id)
    .neq("status", "canceled")
    .order("due_at", { ascending: true, nullsFirst: false })
    .limit(200);

  const rows = (data ?? []) as unknown as { id: string; title: string; due_at: string | null; status: "open" | "done" | "canceled"; customers: Named }[];
  const toItem = (t: (typeof rows)[number]): TaskItem => ({
    id: t.id,
    title: t.title,
    due_at: t.due_at,
    status: t.status,
    customer: t.customers ? { id: t.customers.id, name: customerName(t.customers) } : null,
  });

  const open = rows.filter((t) => t.status === "open").map(toItem);
  const done = rows.filter((t) => t.status === "done").map(toItem);

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <CheckSquare className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
      </div>

      <NewTaskForm />

      <section aria-labelledby="open-tasks" className="mb-8">
        <h2 id="open-tasks" className="mb-2 text-lg font-bold">Open</h2>
        {open.length === 0 ? (
          <EmptyState title="You're all caught up!" body="No open tasks right now." />
        ) : (
          <ul className="space-y-2">
            {open.map((t) => (
              <TaskRow key={t.id} task={t} />
            ))}
          </ul>
        )}
      </section>

      {done.length > 0 && (
        <section aria-labelledby="done-tasks">
          <h2 id="done-tasks" className="mb-2 text-lg font-bold">Done</h2>
          <ul className="space-y-2">
            {done.map((t) => (
              <TaskRow key={t.id} task={t} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
