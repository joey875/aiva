import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  no_access: "That account doesn't have access to Aiva. Ask your admin for an invite.",
  link: "That sign-in link has expired or was already used. Request a new one.",
  google: "Google sign-in didn't finish. Try again or use an email link.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await getProfile()) redirect("/");
  const { error } = await searchParams;
  const message = typeof error === "string" ? ERRORS[error] : undefined;

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5 py-10">
      <div className="mb-8">
        <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-ava text-2xl font-bold text-ava-ink">
          A
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Sign in to Aiva</h1>
        <p className="mt-2 text-ink-soft">Your customers, appointments, and follow-ups in one place.</p>
      </div>
      {message && (
        <p className="mb-4 rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger" role="alert">
          {message}
        </p>
      )}
      <LoginForm google={process.env.NEXT_PUBLIC_GOOGLE_SIGNIN === "on"} />
    </main>
  );
}
