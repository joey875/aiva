import { createClient } from "@/lib/supabase/server";
import { getCompanyContext } from "@/lib/companies";
import { isAdmin } from "@/lib/types";
import { AppShell } from "@/components/shell/app-shell";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { profile, companies, current } = await getCompanyContext();
  const admin = isAdmin(profile);

  let taskBadge = 0;
  let dueCount = 0;
  if (current) {
    const supabase = await createClient();
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    const [openRes, dueRes] = await Promise.all([
      supabase.from("tasks").select("id", { count: "exact", head: true }).eq("company_id", current.id).eq("status", "open"),
      supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("company_id", current.id)
        .eq("status", "open")
        .lte("due_at", endOfToday.toISOString()),
    ]);
    taskBadge = openRes.count ?? 0;
    dueCount = dueRes.count ?? 0;
  }

  return (
    <AppShell
      companyName={current?.name ?? null}
      companies={companies.map((c) => ({ id: c.id, name: c.name, brand_color: c.brand_color }))}
      currentId={current?.id ?? null}
      admin={admin}
      fullName={profile.full_name}
      email={profile.email}
      roleLabel={admin ? "Admin" : "Rep"}
      taskBadge={taskBadge}
      dueCount={dueCount}
    >
      {children}
    </AppShell>
  );
}
