"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";

export type LoginState = { sent?: boolean; error?: string };

export async function sendMagicLink(_: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Enter a valid email address." };
  }

  // Only invited users (or the seeded super admin) get a link. The response is the
  // same either way, so the form never reveals who has an account.
  const admin = createAdminClient();
  const { data: allowed } = await admin.rpc("can_sign_in", { p_email: email });

  if (allowed) {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${env.siteUrl}/auth/confirm`, shouldCreateUser: true },
    });
    if (error) return { error: "Couldn't send the link right now. Try again in a minute." };
  }

  return { sent: true };
}

export async function signInWithGoogle() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${env.siteUrl}/auth/callback` },
  });
  if (error || !data.url) redirect("/login?error=google");
  redirect(data.url);
}
