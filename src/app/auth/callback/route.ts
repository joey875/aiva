import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Completes sign-in (Google code, email code, email token hash, or an already-set
// session from /auth/confirm), then checks access. Anyone without an active profile
// is signed out, and a stray auth user created by an uninvited Google sign-in is removed.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const supabase = await createClient();

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return NextResponse.redirect(`${origin}/login?error=link`);
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) return NextResponse.redirect(`${origin}/login?error=link`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login?error=link`);

  const { data: profile } = await supabase.from("profiles").select("id, active").eq("id", user.id).maybeSingle();

  if (!profile || !profile.active) {
    await supabase.auth.signOut();
    if (!profile) await createAdminClient().auth.admin.deleteUser(user.id);
    return NextResponse.redirect(`${origin}/login?error=no_access`);
  }

  return NextResponse.redirect(`${origin}/`);
}
