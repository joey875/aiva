import { createClient } from "@/lib/supabase/server";
import { getCompanyContext, getStages } from "@/lib/companies";
import { getPeopleNames } from "@/lib/people";
import { customerName, isAdmin } from "@/lib/types";
import { EmptyState } from "@/components/empty-state";
import { PipelineBoard, type Card } from "./board";

export const metadata = { title: "Pipeline" };

export default async function PipelinePage() {
  const { profile, current } = await getCompanyContext();
  if (!current) return <EmptyState title="No company assigned yet" body="Ask your admin to add you to a company." />;

  const supabase = await createClient();
  const [stages, res, names] = await Promise.all([
    getStages(current.id),
    supabase
      .from("customers")
      .select("id, business_name, contact_name, stage_id, owner_id, next_step, next_step_at")
      .eq("company_id", current.id)
      .order("updated_at", { ascending: false })
      .limit(500),
    isAdmin(profile) ? getPeopleNames() : Promise.resolve(null),
  ]);

  const cards: Card[] = (res.data ?? []).map((c) => ({
    id: c.id,
    name: customerName(c),
    stageId: c.stage_id ?? stages[0]?.id ?? null,
    owner: names?.get(c.owner_id) ?? null,
    nextStep: c.next_step,
    overdue: !!c.next_step_at && new Date(c.next_step_at) < new Date(),
  }));

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold tracking-tight">Pipeline</h1>
      <PipelineBoard stages={stages.map((s) => ({ id: s.id, name: s.name }))} cards={cards} />
    </div>
  );
}
