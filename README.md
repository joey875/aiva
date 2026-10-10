# Aiva

Sales CRM with an AI assistant (Ava). Multi-tenant: **accounts → companies → salespeople → customers**.

Stack: Next.js 16 (App Router) · TypeScript · Tailwind v4 · Supabase (Postgres, Auth, RLS).

## Setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in the Supabase values.
3. Apply the migrations in order (Supabase SQL editor, or `supabase db push`):
   - `supabase/migrations/0001_core_schema.sql`
   - `supabase/migrations/0002_integrity_and_rls.sql`
   - `supabase/migrations/0003_auth_hooks.sql`
4. Seed: `node --env-file=.env.local scripts/seed.mjs`
   Creates the account, Secure Trade / Go Local TV / Shop Local Rewards (with default pipeline stages), and makes `SUPER_ADMIN_EMAIL` the owner on first sign-in.
5. In Supabase Auth settings:
   - Site URL = `NEXT_PUBLIC_SITE_URL`; add `<site>/auth/confirm` and `<site>/auth/callback` to Redirect URLs.
   - Turn on the Google provider if you want "Continue with Google".
6. `npm run dev` → http://localhost:3000

## How access works

- No public signup. Admins invite salespeople from **Admin → Salespeople**. The seeded owner email self-provisions as super admin.
- Roles: `super_admin` (everything), `account_admin` (their account), `rep` (only their own customers, only in companies they're assigned to).
- All of it is enforced in the database with Row Level Security, not just in the UI. `account_id` on every row is derived from its company by trigger, so it can't be spoofed.
- Google OAuth tokens (`google_connections`) have no client access at all; only server code with the service role can read them.

## Verify security

```bash
# Against a local Postgres (stubs Supabase roles + auth):
PGHOST=<socket dir> PGPORT=<port> ./supabase/tests/run_local.sh
```

Or paste `supabase/tests/rls_verification.sql` into the Supabase SQL editor. It builds throwaway data, runs 23 checks as real users, and rolls everything back. The result arrives as an error message starting with `RLS REPORT: ALL PASSED`. Latest results: `supabase/tests/rls_results.txt`.

## Built so far (001)

Schema for everything planned (appointments, recordings, commitments, tasks, templates, email drafts, Google connections, rep style profiles, assistant profile + voice usage, activity log, notification settings, audit events), plus screens for:

- Sign in (email link, Google)
- Today: appointments, overdue follow-ups, open tasks
- Customers: search, stage filter, add/edit, detail page with call/text/email/directions and timeline
- Pipeline: drag between stages (or the stage menu on each card)
- Admin: companies (add, rename, color, archive) and salespeople (invite, assign companies, deactivate)

The company switcher in the top band changes which pipeline you're working in; the band takes that company's color.

## Notes

- Email sign-in links use PKCE, so open the link in the same browser you requested it from. Invites and admin-resent links work on any device.
- Cache Components is turned off on purpose; nearly every screen is per-user.
