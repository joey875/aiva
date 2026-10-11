"use client";

import { useActionState } from "react";
import { createCompany, type AdminState } from "../actions";

export function NewCompanyForm() {
  const [state, action, pending] = useActionState<AdminState, FormData>(createCompany, {});
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div className="min-w-48 flex-1">
        <label className="label" htmlFor="new-name">Company name</label>
        <input id="new-name" name="name" className="field" required />
      </div>
      <div>
        <label className="label" htmlFor="new-color">Color</label>
        <input id="new-color" name="brand_color" type="color" defaultValue="#0176d3" className="h-12 w-16 cursor-pointer rounded-lg border border-border bg-surface p-1" />
      </div>
      <button disabled={pending} className="btn btn-primary disabled:opacity-60">{pending ? "Adding…" : "Add company"}</button>
      {state.error && <p className="w-full text-sm text-danger">{state.error}</p>}
      {state.ok && <p className="w-full text-sm text-ok" role="status">{state.ok}</p>}
    </form>
  );
}
