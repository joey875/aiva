"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Landing page for every emailed link (sign-in, invite, resend).
// Supabase may deliver ?code=, ?token_hash=, or #access_token= depending on the
// flow; this normalizes all three and hands off to /auth/callback, which checks access.
export default function ConfirmPage() {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    const tokenHash = url.searchParams.get("token_hash");
    const type = url.searchParams.get("type");
    const hash = new URLSearchParams(url.hash.slice(1));
    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");

    if (code) {
      window.location.replace(`/auth/callback?code=${encodeURIComponent(code)}`);
    } else if (tokenHash && type) {
      window.location.replace(`/auth/callback?token_hash=${encodeURIComponent(tokenHash)}&type=${encodeURIComponent(type)}`);
    } else if (accessToken && refreshToken) {
      createClient()
        .auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
        .then(({ error }) => {
          if (error) setFailed(true);
          else window.location.replace("/auth/callback?finish=1");
        });
    } else {
      queueMicrotask(() => setFailed(true));
    }
  }, []);

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5">
      {failed ? (
        <>
          <h1 className="text-2xl font-bold">That link didn&apos;t work</h1>
          <p className="mt-2 text-text-muted">It may have expired or already been used.</p>
          <a href="/login" className="btn btn-primary mt-5">Get a new sign-in link</a>
        </>
      ) : (
        <p className="text-lg font-semibold" role="status">Signing you in…</p>
      )}
    </main>
  );
}
