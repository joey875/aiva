"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { FormState } from "@/app/(app)/customers/actions";
import type { Customer, Stage } from "@/lib/types";

type Owner = { id: string; name: string };

const STATUS_LABELS = { lead: "Lead", prospect: "Prospect", active: "Active", won: "Won", lost: "Lost" } as const;

export function CustomerForm({
  action,
  customer,
  stages,
  owners,
  nextStepLocal,
  cancelHref,
  submitLabel,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  customer?: Partial<Customer>;
  stages: Stage[];
  owners?: Owner[];
  nextStepLocal?: string;
  cancelHref: string;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const c = customer ?? {};

  return (
    <form action={formAction} className="space-y-6">
      <fieldset className="space-y-3">
        <legend className="mb-2 text-lg font-bold">Business and contact</legend>
        <Field name="business_name" label="Business name" defaultValue={c.business_name} autoComplete="organization" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field name="contact_name" label="Contact name" defaultValue={c.contact_name} autoComplete="name" />
          <Field name="title" label="Title" defaultValue={c.title} />
          <Field name="phone" label="Phone" type="tel" defaultValue={c.phone} autoComplete="tel" />
          <Field name="email" label="Email" type="email" defaultValue={c.email} autoComplete="email" />
        </div>
        <Field name="address" label="Street address" defaultValue={c.address} autoComplete="street-address" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field name="city" label="City" defaultValue={c.city} autoComplete="address-level2" />
          <Field name="website" label="Website" type="url" defaultValue={c.website} placeholder="https://" />
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="mb-2 text-lg font-bold">Where they stand</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="stage_id" className="label">Pipeline stage</label>
            <select id="stage_id" name="stage_id" defaultValue={c.stage_id ?? stages[0]?.id ?? ""} className="field">
              {stages.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="status" className="label">Status</label>
            <select id="status" name="status" defaultValue={c.status ?? "lead"} className="field">
              {Object.entries(STATUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="interest_level" className="label">Interest, 1 to 10</label>
            <input id="interest_level" name="interest_level" type="number" min={1} max={10} defaultValue={c.interest_level ?? ""} className="field" />
          </div>
          <Field name="source" label="Source" defaultValue={c.source} placeholder="Referral, event, card…" />
        </div>
        {owners && owners.length > 0 && (
          <div>
            <label htmlFor="owner_id" className="label">Salesperson</label>
            <select id="owner_id" name="owner_id" defaultValue={c.owner_id ?? owners[0].id} className="field">
              {owners.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>
        )}
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="mb-2 text-lg font-bold">Next step</legend>
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
          <Field name="next_step" label="What happens next" defaultValue={c.next_step} placeholder="Re-pitch the $100 plan" />
          <div>
            <label htmlFor="next_step_at" className="label">When</label>
            <input id="next_step_at" name="next_step_at" type="datetime-local" defaultValue={nextStepLocal ?? ""} className="field" />
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="mb-2 text-lg font-bold">Notes</legend>
        <div>
          <label htmlFor="people_notes" className="label">About the person</label>
          <textarea id="people_notes" name="people_notes" rows={2} defaultValue={c.people_notes ?? ""} placeholder="Prefers texting. Met at the Chamber event." className="field" />
        </div>
        <div>
          <label htmlFor="notes" className="label">General notes</label>
          <textarea id="notes" name="notes" rows={3} defaultValue={c.notes ?? ""} className="field" />
        </div>
      </fieldset>

      {state.error && (
        <p role="alert" className="rounded-lg bg-danger-bg px-3 py-2 text-danger">{state.error}</p>
      )}
      <div className="flex gap-3">
        <button type="submit" disabled={pending} className="btn btn-primary flex-1 disabled:opacity-60 sm:flex-none">
          {pending ? "Saving…" : submitLabel}
        </button>
        <Link href={cancelHref} className="btn btn-quiet">Cancel</Link>
      </div>
    </form>
  );
}

function Field({
  name,
  label,
  defaultValue,
  type = "text",
  ...rest
}: {
  name: string;
  label: string;
  defaultValue?: string | null;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="label">{label}</label>
      <input id={name} name={name} type={type} defaultValue={defaultValue ?? ""} className="field" {...rest} />
    </div>
  );
}
