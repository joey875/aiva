export type Role = "super_admin" | "account_admin" | "rep";

export type Profile = {
  id: string;
  account_id: string;
  role: Role;
  full_name: string;
  email: string;
  phone: string | null;
  active: boolean;
};

export type Company = {
  id: string;
  account_id: string;
  name: string;
  brand_color: string | null;
  archived_at: string | null;
};

export type Stage = {
  id: string;
  company_id: string;
  name: string;
  position: number;
  is_won: boolean;
  is_lost: boolean;
};

export type CustomerStatus = "lead" | "prospect" | "active" | "won" | "lost";

export type Customer = {
  id: string;
  company_id: string;
  owner_id: string;
  contact_name: string;
  business_name: string;
  title: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  website: string | null;
  stage_id: string | null;
  status: CustomerStatus;
  source: string | null;
  interest_level: number | null;
  people_notes: string | null;
  notes: string | null;
  next_step: string | null;
  next_step_at: string | null;
  last_activity_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Activity = {
  id: string;
  customer_id: string;
  actor_id: string | null;
  actor_type: "rep" | "assistant" | "admin" | "system";
  kind: string;
  summary: string;
  data: Record<string, unknown>;
  created_at: string;
};

export const isAdmin = (p: Pick<Profile, "role">) => p.role === "super_admin" || p.role === "account_admin";

export const customerName = (c: Pick<Customer, "business_name" | "contact_name">) =>
  c.business_name || c.contact_name;
