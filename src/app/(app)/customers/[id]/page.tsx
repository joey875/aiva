import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCompanyContext, getStages } from "@/lib/companies";
import { getPeopleNames } from "@/lib/people";
import { formatDateTime, relativeDay } from "@/lib/time";
import { customerName, isAdmin, type Activity, type Customer } from "@/lib/types";
import { StageSelect } from "@/components/stage-select";
import { addNote } from "../actions";

export default async function CustomerPage({ params }: PageProps<"/customers/[id]">) {
  const { id } = await params;
  const { profile } = await getCompanyContext();
  const supabase = await createClient();

  const { data } = await supabase.from("customers").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const c = data as Customer;

  const [stages, activityRes, apptRes, names] = await Promise.all([
    getStages(c.company_id),
    supabase.from("activity_log").select("*").eq("customer_id", id).order("created_at", { ascending: false }).limit(100),
    supabase
      .from("appointments")
      .select("id, title, starts_at, location, status")
      .eq("customer_id", id)
      .gte("starts_at", new Date().toISOString())
      .order("starts_at")
      .limit(5),
    getPeopleNames(),
  ]);
  const activity = (activityRes.data ?? []) as Activity[];
  const mapsQuery = [c.address, c.city, c.state].filter(Boolean).join(", ");
  const overdue = c.next_step_at && new Date(c.next_step_at) < new Date();

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <div className="min-w-0 space-y-6">
        <div>
          <Link href="/customers" className="text-sm font-semibold text-ink-soft hover:text-ink">Customers</Link>
          <div className="mt-1 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight break-words">{customerName(c)}</h1>
              {c.business_name && c.contact_name && (
                <p className="text-ink-soft">{c.contact_name}{c.title ? `, ${c.title}` : ""}</p>
              )}
            </div>
            <Link href={`/customers/${id}/edit`} className="btn btn-quiet shrink-0">Edit</Link>
          </div>
        </div>

        {/* One-tap actions for reps in the field */}
        <div className="grid grid-cols-4 gap-2">
          <Action href={c.phone ? `tel:${c.phone}` : undefined} label="Call" />
          <Action href={c.phone ? `sms:${c.phone}` : undefined} label="Text" />
          <Action href={c.email ? `mailto:${c.email}` : undefined} label="Email" />
          <Action href={mapsQuery ? `https://maps.apple.com/?q=${encodeURIComponent(mapsQuery)}` : undefined} label="Directions" />
        </div>

        {c.next_step && (
          <div className={`rounded-xl px-4 py-3 ${overdue ? "bg-attention-bg" : "bg-surface-2"}`}>
            <p className={`text-sm font-semibold ${overdue ? "text-attention" : "text-ink-soft"}`}>
              Next step{c.next_step_at ? `, ${relativeDay(c.next_step_at).toLowerCase()} (${formatDateTime(c.next_step_at)})` : ""}
            </p>
            <p className="font-semibold">{c.next_step}</p>
          </div>
        )}

        <section aria-labelledby="timeline">
          <h2 id="timeline" className="mb-3 text-lg font-bold">Timeline</h2>
          <form action={addNote.bind(null, id)} className="mb-4 flex gap-2">
            <label htmlFor="note" className="sr-only">Add a note</label>
            <input id="note" name="note" placeholder="Add a note" className="field" maxLength={2000} required />
            <button className="btn btn-primary shrink-0">Save</button>
          </form>
          {activity.length === 0 ? (
            <p className="text-ink-soft">Nothing logged yet. Notes, stage changes, emails, and visits show up here.</p>
          ) : (
            <ol className="space-y-3 border-l-2 border-line pl-4">
              {activity.map((a) => (
                <li key={a.id} className="relative">
                  <span aria-hidden className={`absolute top-1.5 -left-[1.4rem] h-2.5 w-2.5 rounded-full ${a.actor_type === "assistant" ? "bg-ava" : "bg-ink-soft"}`} />
                  <p className={a.kind === "note" ? "whitespace-pre-wrap" : "font-medium"}>{a.summary}</p>
                  <p className="text-sm text-ink-soft">
                    {formatDateTime(a.created_at)}
                    {a.actor_type === "assistant" ? ", Ava" : a.actor_id ? `, ${names.get(a.actor_id) ?? "Team member"}` : ""}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <aside className="space-y-4">
        <div className="rounded-xl border border-line bg-surface p-4">
          <StageSelect customerId={id} stageId={c.stage_id} stages={stages} />
          <dl className="mt-4 space-y-3 text-sm">
            <Row label="Status" value={c.status[0].toUpperCase() + c.status.slice(1)} />
            <Row label="Interest" value={c.interest_level ? `${c.interest_level} of 10` : null} />
            <Row label="Phone" value={c.phone} />
            <Row label="Email" value={c.email} />
            <Row label="Address" value={mapsQuery || null} />
            <Row label="Website" value={c.website} />
            <Row label="Source" value={c.source} />
            {isAdmin(profile) && <Row label="Salesperson" value={names.get(c.owner_id) ?? null} />}
          </dl>
        </div>

        {c.people_notes && (
          <div className="rounded-xl border border-line bg-surface p-4">
            <h2 className="mb-1 font-bold">About {c.contact_name || "them"}</h2>
            <p className="whitespace-pre-wrap text-ink-soft">{c.people_notes}</p>
          </div>
        )}

        <div className="rounded-xl border border-line bg-surface p-4">
          <h2 className="mb-2 font-bold">Upcoming appointments</h2>
          {(apptRes.data ?? []).length === 0 ? (
            <p className="text-sm text-ink-soft">None scheduled.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {(apptRes.data ?? []).map((a) => (
                <li key={a.id}>
                  <p className="font-semibold">{formatDateTime(a.starts_at)}</p>
                  {a.location && <p className="text-ink-soft">{a.location}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>

        {c.notes && (
          <div className="rounded-xl border border-line bg-surface p-4">
            <h2 className="mb-1 font-bold">Notes</h2>
            <p className="whitespace-pre-wrap text-ink-soft">{c.notes}</p>
          </div>
        )}
      </aside>
    </div>
  );
}

function Action({ href, label }: { href?: string; label: string }) {
  if (!href) {
    return (
      <span aria-disabled className="flex min-h-14 items-center justify-center rounded-xl border border-dashed border-line text-sm font-semibold text-ink-soft/60">
        {label}
      </span>
    );
  }
  return (
    <a href={href} className="flex min-h-14 items-center justify-center rounded-xl bg-surface text-sm font-semibold shadow-[inset_0_0_0_1px_var(--line)] hover:bg-surface-2">
      {label}
    </a>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-ink-soft">{label}</dt>
      <dd className="min-w-0 text-right font-medium break-words">{value}</dd>
    </div>
  );
}
