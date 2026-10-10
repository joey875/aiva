"use client";

import Link from "next/link";
import { useActionState } from "react";
import { inviteRep, type AdminState } from "../../actions";

export function InviteForm({ companies }: { companies: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<AdminState, FormData>(inviteRep, {});
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="full_name">Name</label>
        <input id="full_name" name="full_name" required className="field" autoComplete="off" />
      </div>
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required className="field" autoComplete="off" />
      </div>
      <div>
        <label className="label" htmlFor="phone">Phone</label>
        <input id="phone" name="phone" type="tel" className="field" autoComplete="off" />
      </div>
      <fieldset>
        <legend className="label">Companies they sell for</legend>
        <div className="space-y-1">
          {companies.map((c) => (
            <label key={c.id} className="flex min-h-12 items-center gap-3 rounded-lg border border-line bg-surface px-3">
              <input type="checkbox" name="company_ids" value={c.id} className="h-5 w-5 accent-[var(--ava)]" />
              {c.name}
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label className="label" htmlFor="role">Access</label>
        <select id="role" name="role" defaultValue="rep" className="field">
          <option value="rep">Salesperson: sees only their own customers</option>
          <option value="account_admin">Admin: sees everyone and manages the team</option>
        </select>
      </div>
      {state.error && <p role="alert" className="rounded-lg bg-danger-bg px-3 py-2 text-danger">{state.error}</p>}
      <div className="flex gap-3">
        <button disabled={pending} className="btn btn-primary flex-1 disabled:opacity-60 sm:flex-none">{pending ? "Sending invite…" : "Send invite"}</button>
        <Link href="/admin/reps" className="btn btn-quiet">Cancel</Link>
      </div>
    </form>
  );
}
