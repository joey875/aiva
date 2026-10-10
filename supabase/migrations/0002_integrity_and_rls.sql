-- Aiva: integrity triggers, access helpers, and Row Level Security

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

-- =====================================================================
-- Access helpers (SECURITY DEFINER so they can read profiles under RLS)
-- =====================================================================

create or replace function private.uid_account()
returns uuid language sql stable security definer set search_path = '' as $$
  select account_id from public.profiles where id = auth.uid() and active
$$;

create or replace function private.is_super()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and active and role = 'super_admin'
  )
$$;

-- True for super_admin (any account) or an active account_admin of acct
create or replace function private.is_admin_of(acct uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.active
      and (p.role = 'super_admin' or (p.role = 'account_admin' and p.account_id = acct))
  )
$$;

-- True if the current active user is assigned to company cid
create or replace function private.rep_has_company(cid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.company_reps cr
    join public.profiles p on p.id = cr.user_id
    join public.companies c on c.id = cr.company_id
    where cr.user_id = auth.uid() and cr.company_id = cid
      and p.active and c.archived_at is null
  )
$$;

-- True if the current user may see customer cust
create or replace function private.can_see_customer(cust uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.customers c
    where c.id = cust
      and (
        private.is_admin_of(c.account_id)
        or (c.owner_id = auth.uid() and private.rep_has_company(c.company_id))
      )
  )
$$;

grant execute on all functions in schema private to authenticated, service_role;

-- =====================================================================
-- Integrity triggers
-- =====================================================================

-- Derive account_id from company_id so it can never be spoofed
create or replace function private.set_account_from_company()
returns trigger language plpgsql security definer set search_path = '' as $$
declare acct uuid;
begin
  select account_id into acct from public.companies where id = new.company_id;
  if acct is null then
    raise exception 'Unknown company %', new.company_id;
  end if;
  new.account_id := acct;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['company_reps','pipeline_stages','customers','appointments','recordings','tasks','commitments','templates','email_drafts','activity_log']
  loop
    execute format('create trigger aa_%s_set_account before insert or update of company_id, account_id on public.%I for each row execute function private.set_account_from_company()', t, t);
  end loop;
end $$;

-- A referenced person (rep/owner/user) must belong to the row's account
create or replace function private.check_person_in_account()
returns trigger language plpgsql security definer set search_path = '' as $$
declare person uuid;
begin
  person := (to_jsonb(new) ->> case tg_table_name
    when 'customers' then 'owner_id'
    when 'company_reps' then 'user_id'
    else 'rep_id'
  end)::uuid;
  if person is not null and not exists (
    select 1 from public.profiles where id = person and account_id = new.account_id
  ) then
    raise exception 'Person % is not in this account', person;
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['company_reps','customers','appointments','recordings','tasks','commitments','email_drafts']
  loop
    execute format('create trigger %I_check_person before insert or update on public.%I for each row execute function private.check_person_in_account()', t, t);
  end loop;
end $$;

-- A referenced customer must belong to the same company as the row
create or replace function private.check_customer_company()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.customer_id is not null and not exists (
    select 1 from public.customers where id = new.customer_id and company_id = new.company_id
  ) then
    raise exception 'Customer % does not belong to company %', new.customer_id, new.company_id;
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['appointments','recordings','tasks','commitments','email_drafts','activity_log']
  loop
    execute format('create trigger %I_check_customer before insert or update on public.%I for each row execute function private.check_customer_company()', t, t);
  end loop;
end $$;

-- A customer's stage must belong to the customer's company
create or replace function private.check_customer_stage()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.stage_id is not null and not exists (
    select 1 from public.pipeline_stages where id = new.stage_id and company_id = new.company_id
  ) then
    raise exception 'Stage does not belong to this company';
  end if;
  return new;
end $$;

create trigger customers_check_stage before insert or update on public.customers
  for each row execute function private.check_customer_stage();

-- Protect role / account / active / email on profiles from non-admin edits
create or replace function private.protect_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Server-side (service role) and super admins may change anything
  if auth.uid() is null or private.is_super() then
    return new;
  end if;

  if private.is_admin_of(old.account_id) then
    if new.account_id <> old.account_id then
      raise exception 'Admins cannot move users between accounts';
    end if;
    if new.role = 'super_admin' or old.role = 'super_admin' then
      raise exception 'Admins cannot grant or edit super admin';
    end if;
    return new;
  end if;

  -- Everyone else may only edit their own name/phone
  if new.role <> old.role or new.account_id <> old.account_id
     or new.active <> old.active or lower(new.email) <> lower(old.email) then
    raise exception 'Not allowed to change role, account, status, or email';
  end if;
  return new;
end $$;

create trigger profiles_protect before update on public.profiles
  for each row execute function private.protect_profile();

-- Default pipeline stages for every new company (keeps names out of app code)
create or replace function private.seed_company_stages()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.pipeline_stages (company_id, account_id, name, position, is_won, is_lost)
  values
    (new.id, new.account_id, 'New', 0, false, false),
    (new.id, new.account_id, 'Contacted', 1, false, false),
    (new.id, new.account_id, 'Appointment Set', 2, false, false),
    (new.id, new.account_id, 'Pitched', 3, false, false),
    (new.id, new.account_id, 'Follow-Up', 4, false, false),
    (new.id, new.account_id, 'Won', 5, true, false),
    (new.id, new.account_id, 'Lost', 6, false, true);
  return new;
end $$;

create trigger companies_seed_stages after insert on public.companies
  for each row execute function private.seed_company_stages();

-- Default assistant profile for every new account
create or replace function private.seed_assistant_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.assistant_profiles (account_id) values (new.id) on conflict do nothing;
  return new;
end $$;

create trigger accounts_seed_assistant after insert on public.accounts
  for each row execute function private.seed_assistant_profile();

-- Default notification settings for every new profile
create or replace function private.seed_notification_settings()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notification_settings (user_id, account_id, digest_email)
  values (new.id, new.account_id, new.email)
  on conflict do nothing;
  return new;
end $$;

create trigger profiles_seed_notifications after insert on public.profiles
  for each row execute function private.seed_notification_settings();

-- Activity log is append-only
create or replace function private.block_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'activity_log is append-only';
end $$;

create trigger activity_log_no_update before update or delete on public.activity_log
  for each row execute function private.block_mutation();

-- =====================================================================
-- Row Level Security
-- =====================================================================

do $$
declare t text;
begin
  foreach t in array array['accounts','profiles','companies','company_reps','pipeline_stages','customers','appointments','recordings','tasks','commitments','templates','email_drafts','google_connections','rep_style_profiles','assistant_profiles','voice_usage','activity_log','notification_settings','audit_events','bootstrap_admins']
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- accounts
create policy accounts_select on public.accounts for select to authenticated
  using (private.is_super() or id = private.uid_account());
create policy accounts_update on public.accounts for update to authenticated
  using (private.is_admin_of(id)) with check (private.is_admin_of(id));
create policy accounts_insert on public.accounts for insert to authenticated
  with check (private.is_super());
create policy accounts_delete on public.accounts for delete to authenticated
  using (private.is_super());

-- profiles
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or private.is_admin_of(account_id));
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or private.is_admin_of(account_id))
  with check (id = auth.uid() or private.is_admin_of(account_id));
create policy profiles_insert on public.profiles for insert to authenticated
  with check (private.is_admin_of(account_id) and (role <> 'super_admin' or private.is_super()));
create policy profiles_delete on public.profiles for delete to authenticated
  using (private.is_super());

-- companies
create policy companies_select on public.companies for select to authenticated
  using (private.is_admin_of(account_id) or private.rep_has_company(id));
create policy companies_insert on public.companies for insert to authenticated
  with check (private.is_admin_of(account_id));
create policy companies_update on public.companies for update to authenticated
  using (private.is_admin_of(account_id)) with check (private.is_admin_of(account_id));
create policy companies_delete on public.companies for delete to authenticated
  using (private.is_admin_of(account_id));

-- company_reps
create policy company_reps_select on public.company_reps for select to authenticated
  using (user_id = auth.uid() or private.is_admin_of(account_id));
create policy company_reps_insert on public.company_reps for insert to authenticated
  with check (private.is_admin_of((select account_id from public.companies where id = company_id)));
create policy company_reps_delete on public.company_reps for delete to authenticated
  using (private.is_admin_of(account_id));

-- pipeline_stages
create policy stages_select on public.pipeline_stages for select to authenticated
  using (private.is_admin_of(account_id) or private.rep_has_company(company_id));
create policy stages_insert on public.pipeline_stages for insert to authenticated
  with check (private.is_admin_of((select account_id from public.companies where id = company_id)));
create policy stages_update on public.pipeline_stages for update to authenticated
  using (private.is_admin_of(account_id)) with check (private.is_admin_of(account_id));
create policy stages_delete on public.pipeline_stages for delete to authenticated
  using (private.is_admin_of(account_id));

-- customers
create policy customers_select on public.customers for select to authenticated
  using (private.is_admin_of(account_id) or (owner_id = auth.uid() and private.rep_has_company(company_id)));
create policy customers_insert on public.customers for insert to authenticated
  with check (
    private.is_admin_of((select account_id from public.companies where id = company_id))
    or (owner_id = auth.uid() and private.rep_has_company(company_id))
  );
create policy customers_update on public.customers for update to authenticated
  using (private.is_admin_of(account_id) or (owner_id = auth.uid() and private.rep_has_company(company_id)))
  with check (private.is_admin_of(account_id) or (owner_id = auth.uid() and private.rep_has_company(company_id)));
create policy customers_delete on public.customers for delete to authenticated
  using (private.is_admin_of(account_id));

-- Rep-owned work tables: appointments, recordings, tasks, commitments, email_drafts
do $$
declare t text;
begin
  foreach t in array array['appointments','recordings','tasks','commitments','email_drafts']
  loop
    execute format($f$
      create policy %1$s_select on public.%1$I for select to authenticated
        using (private.is_admin_of(account_id) or (rep_id = auth.uid() and private.rep_has_company(company_id)));
      create policy %1$s_insert on public.%1$I for insert to authenticated
        with check (
          private.is_admin_of((select account_id from public.companies where id = company_id))
          or (rep_id = auth.uid() and private.rep_has_company(company_id)
              and (customer_id is null or private.can_see_customer(customer_id)))
        );
      create policy %1$s_update on public.%1$I for update to authenticated
        using (private.is_admin_of(account_id) or (rep_id = auth.uid() and private.rep_has_company(company_id)))
        with check (
          private.is_admin_of(account_id)
          or (rep_id = auth.uid() and private.rep_has_company(company_id)
              and (customer_id is null or private.can_see_customer(customer_id)))
        );
      create policy %1$s_delete on public.%1$I for delete to authenticated
        using (private.is_admin_of(account_id));
    $f$, t);
  end loop;
end $$;

-- templates
create policy templates_select on public.templates for select to authenticated
  using (private.is_admin_of(account_id) or private.rep_has_company(company_id));
create policy templates_insert on public.templates for insert to authenticated
  with check (private.is_admin_of((select account_id from public.companies where id = company_id)));
create policy templates_update on public.templates for update to authenticated
  using (private.is_admin_of(account_id)) with check (private.is_admin_of(account_id));
create policy templates_delete on public.templates for delete to authenticated
  using (private.is_admin_of(account_id));

-- google_connections: NO client policies. Server (service role) only.
-- Safe read of non-secret fields for the signed-in user:
create or replace function public.my_google_connections()
returns table (google_email text, scopes text[], connected_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select google_email, scopes, connected_at
  from public.google_connections where user_id = auth.uid()
$$;
revoke all on function public.my_google_connections() from public, anon;
grant execute on function public.my_google_connections() to authenticated;

-- rep_style_profiles (written by server jobs only)
create policy style_select on public.rep_style_profiles for select to authenticated
  using (rep_id = auth.uid() or private.is_admin_of(account_id));

-- assistant_profiles
create policy assistant_select on public.assistant_profiles for select to authenticated
  using (private.is_super() or account_id = private.uid_account());
create policy assistant_update on public.assistant_profiles for update to authenticated
  using (private.is_admin_of(account_id)) with check (private.is_admin_of(account_id));

-- voice_usage (written by server only)
create policy voice_usage_select on public.voice_usage for select to authenticated
  using (user_id = auth.uid() or private.is_admin_of(account_id));

-- activity_log (append-only)
create policy activity_select on public.activity_log for select to authenticated
  using (private.can_see_customer(customer_id));
create policy activity_insert on public.activity_log for insert to authenticated
  with check (private.can_see_customer(customer_id) and actor_id = auth.uid());

-- notification_settings
create policy notif_select on public.notification_settings for select to authenticated
  using (user_id = auth.uid() or private.is_admin_of(account_id));
create policy notif_update on public.notification_settings for update to authenticated
  using (user_id = auth.uid() or private.is_admin_of(account_id))
  with check (user_id = auth.uid() or private.is_admin_of(account_id));

-- audit_events (written by server only)
create policy audit_select on public.audit_events for select to authenticated
  using (private.is_admin_of(account_id));

-- bootstrap_admins: no client access at all.

-- anon gets nothing
revoke all on all tables in schema public from anon;
