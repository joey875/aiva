import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCompanyContext, getStages } from "@/lib/companies";
import { getOwnerOptions } from "@/lib/people";
import { isoToLocal } from "@/lib/time";
import { customerName, isAdmin, type Customer } from "@/lib/types";
import { CustomerForm } from "@/components/customer-form";
import { updateCustomer } from "../../actions";

export const metadata = { title: "Edit customer" };

export default async function EditCustomerPage({ params }: PageProps<"/customers/[id]/edit">) {
  const { id } = await params;
  const { profile } = await getCompanyContext();
  const supabase = await createClient();
  const { data } = await supabase.from("customers").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const customer = data as Customer;

  const stages = await getStages(customer.company_id);
  const owners = isAdmin(profile) ? await getOwnerOptions(customer.company_id, profile) : undefined;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold tracking-tight">Edit {customerName(customer)}</h1>
      <CustomerForm
        action={updateCustomer.bind(null, id)}
        customer={customer}
        stages={stages}
        owners={owners}
        nextStepLocal={isoToLocal(customer.next_step_at)}
        cancelHref={`/customers/${id}`}
        submitLabel="Save changes"
      />
    </div>
  );
}
