"use client";

import { useActionState } from "react";
import { sendMagicLink, signInWithGoogle, type LoginState } from "./actions";

export function LoginForm({ google }: { google: boolean }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(
    sendMagicLink,
    {},
  );

  if (state.sent) {
    return (
      <div
        className="rounded-xl border border-border bg-surface p-5"
        role="status"
      >
        <p className="text-lg font-semibold">Check your email</p>
        <p className="mt-1 text-text-muted">
          If that address has access, a sign-in link is on its way. It works
          once and expires in an hour.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <form action={action} className="space-y-3">
        <div>
          <label htmlFor="email" className="label">
            Work email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="field"
          />
        </div>
        {state.error && <p className="text-sm text-danger">{state.error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="btn btn-primary w-full disabled:opacity-60"
        >
          {pending ? "Sending…" : "Email me a sign-in link"}
        </button>
      </form>
      {google && (
        <>
          <div className="flex items-center gap-3 text-sm text-text-muted">
            <span className="h-px flex-1 bg-border" />
            or
            <span className="h-px flex-1 bg-border" />
          </div>
          <form action={signInWithGoogle}>
            <button type="submit" className="btn btn-quiet w-full">
              Continue with Google
            </button>
          </form>
        </>
      )}
    </div>
  );
}
