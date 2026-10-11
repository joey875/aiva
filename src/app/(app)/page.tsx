import Link from "next/link";
import {
  Calendar,
  CalendarClock,
  ChevronRight,
  ClipboardList,
  KanbanSquare,
  Mail,
  Phone,
  PlusCircle,
  Sparkles,
  StickyNote,
  UserPlus,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCompanyContext, getStages } from "@/lib/companies";
import { Card, CardHeader } from "@/components/card";
import { CompanySelect } from "@/components/shell/company-select";
import { EmptyState } from "@/components/empty-state";
import { TaskRow, type TaskItem } from "@/components/task-row";
import { customerName } from "@/lib/types";
import { TZ, formatTime, todayRange } from "@/lib/time";

export const metadata = { title: "Today" };

type Named = { id: string; business_name: string; contact_name: string } | null;

function greeting(): string {
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", hour12: false }).format(new Date()));
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.round(hr / 24)}d ago`;
}

const ACTIVITY_ICON: Record<string, typeof StickyNote> = {
  note: StickyNote,
  call: Phone,
  email: Mail,
  appointment: CalendarClock,
  stage_change: KanbanSquare,
  created: UserPlus,
  edited: ClipboardList,
};

const STAGE_TINTS = [
  { header: "bg-blue-50 text-blue-700", dot: "bg-blue-500" },
  { header: "bg-purple-50 text-purple-700", dot: "bg-purple-500" },
  { header: "bg-amber-50 text-amber-700", dot: "bg-amber-500" },
  { header: "bg-orange-50 text-orange-700", dot: "bg-orange-500" },
  { header: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
];

export default async function TodayPage() {
  const { profile, companies, current } = await getCompanyContext();
  if (!current) return <EmptyState title="No company assigned yet" body="Ask your admin to add you to a company." />;

  const supabase = await createClient();
  const { start, end } = todayRange();
  const now = new Date().toISOString();
  const fourteenDaysAgo = new Date(Date.parse(now) - 14 * 24 * 60 * 60 * 1000).toISOString();

  const [
    apptRes,
    activeCustomersRes,
    openDealsRes,
    openTasksCountRes,
    aivaActivityRes,
    staleCustomersRes,
    overdueTasksRes,
    recentActivityRes,
    openTasksRes,
    stagesRes,
    pipelineCustomersRes,
  ] = await Promise.all([
    supabase
      .from("appointments")
      .select("id, title, starts_at, location, customers(id, business_name, contact_name)")
      .eq("company_id", current.id)
      .gte("starts_at", start)
      .lt("starts_at", end)
      .neq("status", "canceled")
      .order("starts_at"),
    supabase.from("customers").select("id", { count: "exact", head: true }).eq("company_id", current.id).eq("status", "active"),
    supabase.from("customers").select("id", { count: "exact", head: true }).eq("company_id", current.id).not("status", "in", "(won,lost)"),
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("company_id", current.id).eq("status", "open"),
    supabase
      .from("activity_log")
      .select("id, summary, created_at, customers(id, business_name, contact_name)")
      .eq("company_id", current.id)
      .eq("actor_type", "assistant")
      .order("created_at", { ascending: false })
      .limit(3),
    supabase
      .from("customers")
      .select("id, business_name, contact_name, last_activity_at")
      .eq("company_id", current.id)
      .not("status", "in", "(won,lost)")
      .or(`last_activity_at.is.null,last_activity_at.lt.${fourteenDaysAgo}`)
      .order("last_activity_at", { ascending: true, nullsFirst: true })
      .limit(2),
    supabase
      .from("tasks")
      .select("id, title, due_at, customers(id, business_name, contact_name)")
      .eq("company_id", current.id)
      .eq("status", "open")
      .lt("due_at", now)
      .order("due_at", { ascending: true })
      .limit(2),
    supabase
      .from("activity_log")
      .select("id, kind, summary, created_at, customers(id, business_name, contact_name)")
      .eq("company_id", current.id)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("tasks")
      .select("id, title, due_at, status, customers(id, business_name, contact_name)")
      .eq("company_id", current.id)
      .eq("status", "open")
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(6),
    getStages(current.id),
    supabase.from("customers").select("id, business_name, contact_name, stage_id, next_step").eq("company_id", current.id),
  ]);

  const appointments = (apptRes.data ?? []) as unknown as { id: string; title: string | null; starts_at: string; location: string | null; customers: Named }[];
  const dateLabel = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "long", month: "long", day: "numeric" }).format(new Date());
  const first = profile.full_name.split(" ")[0] || profile.email.split("@")[0];

  const aivaActivity = (aivaActivityRes.data ?? []) as unknown as { id: string; summary: string; created_at: string; customers: Named }[];

  type Suggestion = { key: string; text: string; href: string };
  const suggestions: Suggestion[] = [];
  for (const c of (staleCustomersRes.data ?? []) as unknown as { id: string; business_name: string; contact_name: string }[]) {
    suggestions.push({ key: `stale-${c.id}`, text: `Follow up with ${customerName(c)}`, href: `/customers/${c.id}` });
  }
  for (const t of (overdueTasksRes.data ?? []) as unknown as { id: string; title: string; customers: Named }[]) {
    suggestions.push({
      key: `task-${t.id}`,
      text: t.customers ? `Overdue: ${t.title} - ${customerName(t.customers)}` : `Overdue: ${t.title}`,
      href: t.customers ? `/customers/${t.customers.id}` : "/tasks",
    });
  }
  suggestions.push({ key: "add-customer", text: "Add a new customer", href: "/customers/new" });

  const recentActivity = (recentActivityRes.data ?? []) as unknown as {
    id: string;
    kind: string;
    summary: string;
    created_at: string;
    customers: Named;
  }[];

  const openTaskItems: TaskItem[] = ((openTasksRes.data ?? []) as unknown as { id: string; title: string; due_at: string | null; status: "open" | "done" | "canceled"; customers: Named }[]).map(
    (t) => ({
      id: t.id,
      title: t.title,
      due_at: t.due_at,
      status: t.status,
      customer: t.customers ? { id: t.customers.id, name: customerName(t.customers) } : null,
    }),
  );

  const pipelineCustomers = (pipelineCustomersRes.data ?? []) as unknown as { id: string; business_name: string; contact_name: string; stage_id: string | null; next_step: string | null }[];

  const stats = [
    {
      key: "appointments",
      label: "Appointments",
      sub: "Today",
      value: appointments.length,
      Icon: CalendarClock,
      tint: "bg-blue-100 text-blue-600",
      href: "/appointments",
    },
    {
      key: "customers",
      label: "Active Customers",
      sub: current.name,
      value: activeCustomersRes.count ?? 0,
      Icon: Users,
      tint: "bg-purple-100 text-purple-600",
      href: "/customers",
    },
    {
      key: "deals",
      label: "Open Deals",
      sub: "Open Opportunities",
      value: openDealsRes.count ?? 0,
      Icon: KanbanSquare,
      tint: "bg-amber-100 text-amber-600",
      href: "/pipeline",
    },
    {
      key: "tasks",
      label: "Open Tasks",
      sub: "Due Soon",
      value: openTasksCountRes.count ?? 0,
      Icon: ClipboardList,
      tint: "bg-orange-100 text-orange-600",
      href: "/tasks",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Today</h1>
          <p className="text-text-muted">
            {greeting()}, {first}! Here&apos;s what&apos;s happening with {current.name}.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-sm font-semibold text-text-muted">{dateLabel}</p>
          <CompanySelect companies={companies.map((c) => ({ id: c.id, name: c.name }))} currentId={current.id} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.key} href={s.href} className="group rounded-xl border border-border bg-surface p-5 shadow-sm hover:border-primary/40">
            <div className="flex items-start justify-between">
              <span className={`flex h-10 w-10 items-center justify-center rounded-full ${s.tint}`}>
                <s.Icon className="h-5 w-5" />
              </span>
              <ChevronRight className="h-5 w-5 text-text-muted transition group-hover:text-primary" />
            </div>
            <p className="mt-3 text-2xl font-bold">{s.value}</p>
            <p className="font-semibold">{s.label}</p>
            <p className="text-sm text-text-muted">{s.sub}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader icon={<Sparkles className="h-5 w-5 text-primary" />} title="AIVA Assistant" />
          <div className="mb-4 rounded-lg bg-primary/10 px-3 py-2.5 text-sm font-semibold text-primary">
            I&apos;m on it for you, {first}!
          </div>
          {aivaActivity.length === 0 ? (
            <p className="text-sm text-text-muted">Nothing yet — hold the mic button and ask me anything.</p>
          ) : (
            <ul className="mb-4 space-y-2">
              {aivaActivity.map((a) => (
                <li key={a.id} className="text-sm">
                  <p className="truncate">{a.summary}</p>
                  <p className="text-xs text-text-muted">
                    {a.customers ? `${customerName(a.customers)} - ` : ""}
                    {timeAgo(a.created_at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <p className="mb-2 text-sm font-semibold text-text-muted">Suggested next steps</p>
          <ul className="space-y-1.5">
            {suggestions.map((s) => (
              <li key={s.key}>
                <Link href={s.href} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-surface-2">
                  <PlusCircle className="h-4 w-4 shrink-0 text-primary" />
                  <span className="truncate">{s.text}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader icon={<CalendarClock className="h-5 w-5 text-primary" />} title="Today's Appointments" viewAllHref="/appointments" />
          {appointments.length === 0 ? (
            <div className="flex flex-col items-center py-6 text-center">
              <Calendar className="mb-2 h-10 w-10 text-text-muted" />
              <p className="mb-3 text-text-muted">No appointments today.</p>
              <Link href="/appointments" className="btn btn-primary">+ Schedule Appointment</Link>
            </div>
          ) : (
            <ul className="space-y-2">
              {appointments.map((a) => (
                <li key={a.id} className="flex gap-3 rounded-lg border border-border px-3 py-2.5">
                  <p className="w-16 shrink-0 font-bold">{formatTime(a.starts_at)}</p>
                  <div className="min-w-0">
                    {a.customers ? (
                      <Link href={`/customers/${a.customers.id}`} className="font-semibold hover:underline">{customerName(a.customers)}</Link>
                    ) : (
                      <p className="font-semibold">{a.title ?? "Appointment"}</p>
                    )}
                    {a.location && <p className="truncate text-sm text-text-muted">{a.location}</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader icon={<ClipboardList className="h-5 w-5 text-primary" />} title="Recent Activity" viewAllHref="/customers" />
          {recentActivity.length === 0 ? (
            <p className="text-sm text-text-muted">Nothing logged yet.</p>
          ) : (
            <ol className="space-y-3 border-l-2 border-border pl-4">
              {recentActivity.map((a) => {
                const Icon = ACTIVITY_ICON[a.kind] ?? StickyNote;
                return (
                  <li key={a.id} className="relative">
                    <span aria-hidden className="absolute top-0.5 -left-[1.4rem] flex h-4 w-4 items-center justify-center rounded-full bg-primary text-white">
                      <Icon className="h-2.5 w-2.5" />
                    </span>
                    <p className="text-sm font-semibold">{a.customers ? customerName(a.customers) : "Activity"}</p>
                    <p className="truncate text-sm text-text-muted">{a.summary}</p>
                    <p className="text-xs text-text-muted">{timeAgo(a.created_at)}</p>
                  </li>
                );
              })}
            </ol>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader icon={<ClipboardList className="h-5 w-5 text-primary" />} title="Tasks" viewAllHref="/tasks" />
        {openTaskItems.length === 0 ? (
          <div className="flex flex-col items-center py-6 text-center">
            <p className="mb-3 text-text-muted">You&apos;re all caught up!</p>
            <Link href="/tasks" className="btn btn-primary">+ Create a Task</Link>
          </div>
        ) : (
          <ul className="space-y-2">
            {openTaskItems.map((t) => (
              <TaskRow key={t.id} task={t} />
            ))}
          </ul>
        )}
      </Card>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <KanbanSquare className="h-5 w-5 text-primary" />
            Sales Pipeline
          </h2>
          <Link href="/pipeline" className="text-sm font-semibold text-primary hover:underline">View all</Link>
        </div>
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:px-0 lg:grid-cols-4">
          {stagesRes.map((stage, i) => {
            const deals = pipelineCustomers.filter((c) => c.stage_id === stage.id);
            const tint = STAGE_TINTS[i % STAGE_TINTS.length];
            return (
              <div key={stage.id} className="flex w-64 shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-surface sm:w-auto">
                <div className={`flex items-center justify-between px-3 py-2 font-semibold ${tint.header}`}>
                  <span className="truncate">{stage.name}</span>
                  <span className="shrink-0 rounded-full bg-white/70 px-2 text-xs font-bold">{deals.length}</span>
                </div>
                <div className="flex-1 space-y-2 p-2">
                  {deals.length === 0 ? (
                    <div className="py-4 text-center">
                      <p className="mb-2 text-sm text-text-muted">No deals yet</p>
                      <Link href="/customers/new" className="text-sm font-semibold text-primary hover:underline">+ Add Deal</Link>
                    </div>
                  ) : (
                    deals.slice(0, 3).map((d) => (
                      <Link key={d.id} href={`/customers/${d.id}`} className="block rounded-lg border border-border px-2.5 py-2 text-sm hover:bg-surface-2">
                        <p className="truncate font-semibold">{customerName(d)}</p>
                        {d.next_step && <p className="truncate text-text-muted">{d.next_step}</p>}
                      </Link>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
