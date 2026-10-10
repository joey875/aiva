"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { COMPANY_COOKIE, getCompanyContext } from "@/lib/companies";

export async function switchCompany(companyId: string) {
  const { companies } = await getCompanyContext();
  if (!companies.some((c) => c.id === companyId)) return;
  (await cookies()).set(COMPANY_COOKIE, companyId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/", "layout");
}
