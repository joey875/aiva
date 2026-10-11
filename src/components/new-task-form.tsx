"use client";

import { useActionState } from "react";
import { createTask, type FormState } from "@/app/(app)/tasks/actions";

export function NewTaskForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createTask, {});

  return (
    <form action={formAction} className="mb-5 grid gap-2 sm:grid-cols-[1fr_12rem_auto]">
      <label className="sr-only" htmlFor="task-title">Task title</label>
      <input id="task-title" name="title" placeholder="What do you need to do?" className="field" maxLength={500} required />
      <label className="sr-only" htmlFor="task-due">Due</label>
      <input id="task-due" name="due_at" type="datetime-local" className="field" />
      <button className="btn btn-primary" disabled={pending}>
        {pending ? "Adding…" : "Add task"}
      </button>
      {state?.error && <p className="text-sm font-semibold text-danger sm:col-span-3">{state.error}</p>}
    </form>
  );
}
