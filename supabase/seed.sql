-- Aiva seed: Joey's account, its three companies, and the super admin bootstrap.
-- Pipeline stages and the assistant profile are created automatically by triggers.
-- Idempotent: safe to run more than once.
-- The super admin email comes from SUPER_ADMIN_EMAIL (see scripts/seed.mjs),
-- which substitutes it for the token below before running.

with acct as (
  insert into public.accounts (name, slug)
  values ('Joey Ventures', 'joey')
  on conflict (slug) do update set name = excluded.name
  returning id
)
insert into public.companies (account_id, name, brand_color)
select acct.id, c.name, c.color
from acct, (values ('Secure Trade', '#0176D3'), ('Go Local TV', '#0176D3'), ('Shop Local Rewards', '#0176D3')) as c(name, color)
where not exists (
  select 1 from public.companies x where x.account_id = acct.id and x.name = c.name
);

insert into public.bootstrap_admins (email, account_id)
select lower('__SUPER_ADMIN_EMAIL__'), id from public.accounts where slug = 'joey'
on conflict (email) do update set account_id = excluded.account_id;

-- If the super admin already has an auth user (e.g. signed in before seeding), provision now.
insert into public.profiles (id, account_id, role, email)
select u.id, b.account_id, 'super_admin', u.email
from auth.users u join public.bootstrap_admins b on lower(b.email) = lower(u.email)
on conflict (id) do nothing;
