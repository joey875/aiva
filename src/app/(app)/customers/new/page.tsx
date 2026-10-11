import { redirect } from "next/navigation";
import { getCompanyContext, getStages } from "@/lib/companies";
import { getOwnerOptions } from "@/lib/people";
import { isAdmin } from "@/lib/types";
import { CustomerForm } from "@/components/customer-form";
import { createCustomer } from "../actions";

export const metadata = { title: "New customer" };

export default async function NewCustomerPage() {
  const { profile, current } = await getCompanyContext();
  if (!current) redirect("/");
  const stages = await getStages(current.id);
  const owners = isAdmin(profile) ? await getOwnerOptions(current.id, profile) : undefined;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-2xl font-bold tracking-tight">New customer</h1>
      <p className="mb-6 text-text-muted">Adding to {current.name}.</p>
      <CustomerForm action={createCustomer} stages={stages} owners={owners} cancelHref="/customers" submitLabel="Add customer" />
    </div>
  );
}
