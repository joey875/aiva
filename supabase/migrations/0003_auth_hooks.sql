-- Aiva: auth provisioning. No public signup.
-- - Bootstrap admins (seeded emails) self-provision as super_admin on first sign-in.
-- - Everyone else is invited by an admin (server creates the auth user + profile).
-- - A Google sign-in by an unknown email gets no profile, and the app signs them out.

create or replace function private.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare acct uuid;
begin
  select account_id into acct from public.bootstrap_admins where lower(email) = lower(new.email);
  if acct is not null then
    insert into public.profiles (id, account_id, role, full_name, email)
    values (new.id, acct, 'super_admin', coalesce(new.raw_user_meta_data ->> 'full_name', ''), new.email)
    on conflict (id) do nothing;
  end if;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_auth_user();

-- Server-only check used by the login action before sending a magic link
create or replace function public.can_sign_in(p_email text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where lower(email) = lower(p_email) and active)
      or exists (select 1 from public.bootstrap_admins where lower(email) = lower(p_email))
$$;
revoke all on function public.can_sign_in(text) from public, anon, authenticated;
grant execute on function public.can_sign_in(text) to service_role;
