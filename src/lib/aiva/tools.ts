import type Anthropic from "@anthropic-ai/sdk";
import { customerName } from "@/lib/types";
import { formatTime, localToISO, todayRange } from "@/lib/time";
import type { VoiceContext } from "./context";

export const AIVA_TOOLS: Anthropic.Tool[] = [
  {
    name: "get_todays_schedule",
    description:
      "Get the rep's appointments and open/overdue follow-ups for today, in their current company. No input needed.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "search_customers",
    description:
      "Search the rep's customers by name, business, phone, email, or city. Returns up to 8 matches with id, name, stage, and city.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Name, business, phone, email, or city to search for" },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "get_customer",
    description:
      "Get full details for one customer by id: stage, status, contact info, people notes, recent timeline activity, and next appointment.",
    input_schema: {
      type: "object",
      properties: {
        customer_id: { type: "string", description: "The customer's id, from search_customers or the conversation" },
      },
      required: ["customer_id"],
      additionalProperties: false,
    },
  },
  {
    name: "get_pipeline_summary",
    description: "Get a count of customers in each pipeline stage for the rep's current company.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "add_note",
    description:
      "Log a note to a customer's timeline, attributed to Aiva. IMPORTANT: never call this the first time it comes up. First tell the rep exactly what you'll save and ask them to confirm. Only call this tool after the rep clearly says yes on a later turn.",
    input_schema: {
      type: "object",
      properties: {
        customer_id: { type: "string", description: "The customer's id" },
        text: { type: "string", description: "The note text to save, written naturally" },
      },
      required: ["customer_id", "text"],
      additionalProperties: false,
    },
  },
  {
    name: "create_reminder",
    description:
      "Create a follow-up reminder/task for the rep. IMPORTANT: never call this the first time it comes up. First read back exactly what you'll save, and when, and ask the rep to confirm. Only call this tool after the rep clearly says yes on a later turn.",
    input_schema: {
      type: "object",
      properties: {
        customer_id: { type: "string", description: "The related customer's id, if any. Omit for a general reminder." },
        text: { type: "string", description: "What to remind the rep about" },
        due_at_local: {
          type: "string",
          description: 'When it is due, as "YYYY-MM-DDTHH:mm" in America/Chicago local time. Omit if no specific time was given.',
        },
      },
      required: ["text"],
      additionalProperties: false,
    },
  },
];

type Named = { business_name: string; contact_name: string } | null;

async function getTodaysSchedule(ctx: VoiceContext) {
  if (!ctx.current) return { error: "This rep has no company assigned yet." };
  const { start, end } = todayRange();
  const now = new Date().toISOString();

  const [appts, tasks] = await Promise.all([
    ctx.supabase
      .from("appointments")
      .select("id, title, starts_at, location, customers(business_name, contact_name)")
      .eq("company_id", ctx.current.id)
      .gte("starts_at", start)
      .lt("starts_at", end)
      .neq("status", "canceled")
      .order("starts_at"),
    ctx.supabase
      .from("tasks")
      .select("id, title, due_at, customers(business_name, contact_name)")
      .eq("company_id", ctx.current.id)
      .eq("status", "open")
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(20),
  ]);

  const appointments = (appts.data ?? []).map((a) => {
    const row = a as unknown as { starts_at: string; title: string | null; location: string | null; customers: Named };
    return {
      time: formatTime(row.starts_at),
      title: row.customers ? customerName(row.customers) : row.title ?? "Appointment",
      location: row.location,
    };
  });

  const allTasks = (tasks.data ?? []) as unknown as { title: string; due_at: string | null; customers: Named }[];
  const toTaskInfo = (t: (typeof allTasks)[number]) => ({
    title: t.title,
    customer: t.customers ? customerName(t.customers) : null,
    due_at: t.due_at,
  });

  return {
    appointments,
    overdue_tasks: allTasks.filter((t) => t.due_at && t.due_at < now).map(toTaskInfo),
    open_tasks: allTasks.filter((t) => !t.due_at || t.due_at >= now).map(toTaskInfo),
  };
}

async function searchCustomers(ctx: VoiceContext, query: string) {
  const q = query.trim();
  if (!q) return { results: [] };
  const safe = q.replace(/[%,()]/g, " ");

  const { data } = await ctx.supabase
    .from("customers")
    .select("id, business_name, contact_name, phone, city, stage_id")
    .or(["business_name", "contact_name", "phone", "email", "city"].map((c) => `${c}.ilike.%${safe}%`).join(","))
    .order("updated_at", { ascending: false })
    .limit(8);

  const rows = (data ?? []) as unknown as { id: string; business_name: string; contact_name: string; phone: string | null; city: string | null; stage_id: string | null }[];
  const stageIds = [...new Set(rows.map((c) => c.stage_id).filter((id): id is string => !!id))];
  const stageNames = new Map<string, string>();
  if (stageIds.length) {
    const { data: stages } = await ctx.supabase.from("pipeline_stages").select("id, name").in("id", stageIds);
    for (const s of stages ?? []) stageNames.set(s.id, s.name);
  }

  return {
    results: rows.map((c) => ({
      id: c.id,
      name: customerName(c),
      phone: c.phone,
      city: c.city,
      stage: c.stage_id ? stageNames.get(c.stage_id) ?? null : null,
    })),
  };
}

async function getCustomer(ctx: VoiceContext, id: string) {
  if (!id) return { error: "Missing customer_id" };
  const { data } = await ctx.supabase.from("customers").select("*").eq("id", id).maybeSingle();
  if (!data) return { error: "No customer with that id is visible to this rep." };

  const [activityRes, apptRes] = await Promise.all([
    ctx.supabase.from("activity_log").select("kind, summary, created_at").eq("customer_id", id).order("created_at", { ascending: false }).limit(5),
    ctx.supabase.from("appointments").select("starts_at, location").eq("customer_id", id).gte("starts_at", new Date().toISOString()).order("starts_at").limit(1),
  ]);

  return {
    id: data.id,
    name: customerName(data),
    status: data.status,
    stage_id: data.stage_id,
    phone: data.phone,
    email: data.email,
    city: data.city,
    interest_level: data.interest_level,
    people_notes: data.people_notes,
    notes: data.notes,
    next_step: data.next_step,
    next_step_at: data.next_step_at,
    recent_activity: activityRes.data ?? [],
    next_appointment: apptRes.data?.[0] ?? null,
  };
}

async function getPipelineSummary(ctx: VoiceContext) {
  if (!ctx.current) return { error: "This rep has no company assigned yet." };
  const [stages, customers] = await Promise.all([
    ctx.supabase.from("pipeline_stages").select("id, name, position").eq("company_id", ctx.current.id).order("position"),
    ctx.supabase.from("customers").select("stage_id").eq("company_id", ctx.current.id),
  ]);

  const counts = new Map<string, number>();
  for (const c of (customers.data ?? []) as { stage_id: string | null }[]) {
    const key = c.stage_id ?? "none";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return {
    stages: (stages.data ?? []).map((s) => ({ name: s.name, count: counts.get(s.id) ?? 0 })),
    total: customers.data?.length ?? 0,
  };
}

async function addNoteTool(ctx: VoiceContext, customerId: string, text: string) {
  if (!customerId || !text.trim()) return { error: "Missing customer_id or text" };
  const { data: customer } = await ctx.supabase.from("customers").select("id, company_id").eq("id", customerId).maybeSingle();
  if (!customer) return { error: "No customer with that id is visible to this rep." };

  const { error } = await ctx.supabase.from("activity_log").insert({
    company_id: customer.company_id,
    customer_id: customerId,
    actor_id: ctx.profile.id,
    actor_type: "assistant",
    kind: "note",
    summary: text.trim().slice(0, 2000),
    data: {},
  });
  if (error) return { error: "Couldn't save the note." };

  await ctx.supabase.from("customers").update({ last_activity_at: new Date().toISOString() }).eq("id", customerId);
  return { saved: true };
}

async function createReminderTool(ctx: VoiceContext, customerId: string | null, text: string, dueLocal: string | null) {
  if (!text.trim()) return { error: "Missing text" };

  let companyId: string | null = null;
  if (customerId) {
    const { data: customer } = await ctx.supabase.from("customers").select("id, company_id").eq("id", customerId).maybeSingle();
    if (!customer) return { error: "No customer with that id is visible to this rep." };
    companyId = customer.company_id;
  } else {
    companyId = ctx.current?.id ?? null;
  }
  if (!companyId) return { error: "No company to attach this reminder to." };

  const dueAt = dueLocal ? localToISO(dueLocal) : null;
  const { error } = await ctx.supabase.from("tasks").insert({
    company_id: companyId,
    rep_id: ctx.profile.id,
    customer_id: customerId,
    type: "follow_up",
    title: text.trim().slice(0, 500),
    due_at: dueAt,
    status: "open",
    created_by: "assistant",
  });
  if (error) return { error: "Couldn't save the reminder." };

  return { saved: true, due_at: dueAt };
}

export async function runAivaTool(name: string, input: Record<string, unknown>, ctx: VoiceContext): Promise<unknown> {
  switch (name) {
    case "get_todays_schedule":
      return getTodaysSchedule(ctx);
    case "search_customers":
      return searchCustomers(ctx, String(input.query ?? ""));
    case "get_customer":
      return getCustomer(ctx, String(input.customer_id ?? ""));
    case "get_pipeline_summary":
      return getPipelineSummary(ctx);
    case "add_note":
      return addNoteTool(ctx, String(input.customer_id ?? ""), String(input.text ?? ""));
    case "create_reminder":
      return createReminderTool(
        ctx,
        input.customer_id ? String(input.customer_id) : null,
        String(input.text ?? ""),
        input.due_at_local ? String(input.due_at_local) : null,
      );
    default:
      return { error: `Unknown tool ${name}` };
  }
}
