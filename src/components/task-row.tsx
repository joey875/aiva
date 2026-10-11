"use client";

import Link from "next/link";
import { useTransition } from "react";
import { toggleTask } from "@/app/(app)/tasks/actions";
import { formatDateTime } from "@/lib/time";

export type TaskItem = {
  id: string;
  title: string;
  due_at: string | null;
  status: "open" | "done" | "canceled";
  customer: { id: string; name: string } | null;
};

export function TaskRow({ task }: { task: TaskItem }) {
  const [pending, start] = useTransition();
  const done = task.status === "done";
  const overdue = !done && !!task.due_at && new Date(task.due_at) < new Date();

  return (
    <li className="flex items-start gap-3 rounded-lg border border-border bg-surface px-3 py-2.5">
      <input
        type="checkbox"
        checked={done}
        disabled={pending}
        onChange={(e) => start(() => toggleTask(task.id, e.target.checked))}
        className="mt-1 h-5 w-5 shrink-0 accent-primary"
        aria-label={`Mark "${task.title}" as ${done ? "open" : "done"}`}
      />
      <div className="min-w-0 flex-1">
        <p className={`font-semibold ${done ? "text-text-muted line-through" : ""}`}>{task.title}</p>
        <p className={`text-sm ${overdue ? "font-semibold text-attention" : "text-text-muted"}`}>
          {[task.customer?.name, task.due_at && formatDateTime(task.due_at)].filter(Boolean).join(", ")}
        </p>
      </div>
      {task.customer && (
        <Link href={`/customers/${task.customer.id}`} className="shrink-0 text-sm font-semibold text-primary hover:underline">
          View
        </Link>
      )}
    </li>
  );
}
