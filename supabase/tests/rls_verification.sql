-- Aiva RLS verification
-- Builds throwaway test data, runs every check as real authenticated users,
-- then ROLLS BACK everything by raising a final exception that carries the report.
-- Run as the database owner (Supabase SQL editor or MCP execute_sql).
-- Expected: the final error message starts with "RLS REPORT: ALL PASSED".

do $$
declare
  acct_a uuid := gen_random_uuid();
  acct_b uuid := gen_random_uuid();
  co_a1 uuid; co_a2 uuid; co_b1 uuid;
  u_super uuid := gen_random_uuid();
  u_admin_a uuid := gen_random_uuid();
  u_rep_x uuid := gen_random_uuid();
  u_rep_y uuid := gen_random_uuid();
  u_rep_b uuid := gen_random_uuid();
  u_rep_off uuid := gen_random_uuid();
  c_x uuid; c_y uuid; c_y2 uuid; c_b uuid;
  n int;
  ok boolean;
  report text := '';
  fails int := 0;
  got_acct uuid;

begin
  -- ---------- setup (as owner, RLS bypassed) ----------
  insert into public.accounts (id, name, slug) values (acct_a, 'Test A', 'test-a-' || acct_a), (acct_b, 'Test B', 'test-b-' || acct_b);
  insert into public.companies (account_id, name) values (acct_a, 'A1') returning id into co_a1;
  insert into public.companies (account_id, name) values (acct_a, 'A2') returning id into co_a2;
  insert into public.companies (account_id, name) values (acct_b, 'B1') returning id into co_b1;

  insert into auth.users (id, email) values
    (u_super, u_super || '@t.test'), (u_admin_a, u_admin_a || '@t.test'), (u_rep_x, u_rep_x || '@t.test'),
    (u_rep_y, u_rep_y || '@t.test'), (u_rep_b, u_rep_b || '@t.test'), (u_rep_off, u_rep_off || '@t.test');

  insert into public.profiles (id, account_id, role, email, active) values
    (u_super, acct_a, 'super_admin', u_super || '@t.test', true),
    (u_admin_a, acct_a, 'account_admin', u_admin_a || '@t.test', true),
    (u_rep_x, acct_a, 'rep', u_rep_x || '@t.test', true),
    (u_rep_y, acct_a, 'rep', u_rep_y || '@t.test', true),
    (u_rep_b, acct_b, 'rep', u_rep_b || '@t.test', true),
    (u_rep_off, acct_a, 'rep', u_rep_off || '@t.test', false);

  insert into public.company_reps (company_id, user_id, account_id) values
    (co_a1, u_rep_x, acct_a), (co_a1, u_rep_y, acct_a), (co_a2, u_rep_y, acct_a),
    (co_b1, u_rep_b, acct_b), (co_a1, u_rep_off, acct_a);

  insert into public.customers (company_id, account_id, owner_id, business_name) values (co_a1, acct_a, u_rep_x, 'X Roofing') returning id into c_x;
  insert into public.customers (company_id, account_id, owner_id, business_name) values (co_a1, acct_a, u_rep_y, 'Y Plumbing') returning id into c_y;
  insert into public.customers (company_id, account_id, owner_id, business_name) values (co_a2, acct_a, u_rep_y, 'Y2 Diner') returning id into c_y2;
  insert into public.customers (company_id, account_id, owner_id, business_name) values (co_b1, acct_b, u_rep_b, 'B Salon') returning id into c_b;
  insert into public.customers (company_id, account_id, owner_id, business_name) values (co_a1, acct_a, u_rep_off, 'Off Customer');
  insert into public.google_connections (user_id, account_id, google_email, refresh_token_encrypted) values (u_rep_x, acct_a, 'x@g.test', 'secret');
  insert into public.activity_log (company_id, account_id, customer_id, actor_id, kind, summary) values (co_a1, acct_a, c_x, u_rep_x, 'note', 'seed');

  -- ---------- helper to switch identity ----------
  -- (inline: set claims + role per block)

  -- ===== Rep X =====
  perform set_config('request.jwt.claims', json_build_object('sub', u_rep_x, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u_rep_x::text, true);
  execute 'set local role authenticated';

  select count(*) into n from public.customers;
  report := report || format(E'\n[%s] rep X sees only own customers (got %s, want 1)', case when n = 1 then 'PASS' else 'FAIL' end, n); if n <> 1 then fails := fails + 1; end if;

  select count(*) into n from public.customers where id = c_y;
  report := report || format(E'\n[%s] rep X cannot read rep Y''s customer in shared company', case when n = 0 then 'PASS' else 'FAIL' end); if n <> 0 then fails := fails + 1; end if;

  select count(*) into n from public.customers where id = c_b;
  report := report || format(E'\n[%s] rep X cannot read another account''s customer', case when n = 0 then 'PASS' else 'FAIL' end); if n <> 0 then fails := fails + 1; end if;

  select count(*) into n from public.companies;
  report := report || format(E'\n[%s] rep X sees only assigned companies (got %s, want 1)', case when n = 1 then 'PASS' else 'FAIL' end, n); if n <> 1 then fails := fails + 1; end if;

  select count(*) into n from public.profiles;
  report := report || format(E'\n[%s] rep X sees only own profile (got %s, want 1)', case when n = 1 then 'PASS' else 'FAIL' end, n); if n <> 1 then fails := fails + 1; end if;

  select count(*) into n from public.google_connections;
  report := report || format(E'\n[%s] rep X cannot read Google tokens table (got %s rows)', case when n = 0 then 'PASS' else 'FAIL' end, n); if n <> 0 then fails := fails + 1; end if;

  ok := false;
  begin
    insert into public.customers (company_id, account_id, owner_id, business_name) values (co_a2, acct_a, u_rep_x, 'Sneaky');
  exception when others then ok := true; end;
  report := report || format(E'\n[%s] rep X cannot add customer to an unassigned company', case when ok then 'PASS' else 'FAIL' end); if not ok then fails := fails + 1; end if;

  ok := false;
  begin
    insert into public.customers (company_id, account_id, owner_id, business_name) values (co_a1, acct_a, u_rep_y, 'Gift');
  exception when others then ok := true; end;
  report := report || format(E'\n[%s] rep X cannot create a customer owned by another rep', case when ok then 'PASS' else 'FAIL' end); if not ok then fails := fails + 1; end if;

  update public.customers set notes = 'hacked' where id = c_y;
  get diagnostics n = row_count;
  report := report || format(E'\n[%s] rep X cannot edit rep Y''s customer (rows changed %s)', case when n = 0 then 'PASS' else 'FAIL' end, n); if n <> 0 then fails := fails + 1; end if;

  ok := false;
  begin
    update public.profiles set role = 'account_admin' where id = u_rep_x;
  exception when others then ok := true; end;
  report := report || format(E'\n[%s] rep X cannot promote self', case when ok then 'PASS' else 'FAIL' end); if not ok then fails := fails + 1; end if;

  -- No update policy means 0 rows change; the trigger also blocks it outright
  ok := false;
  begin
    update public.activity_log set summary = 'rewritten' where customer_id = c_x;
    get diagnostics n = row_count;
    ok := (n = 0);
  exception when others then ok := true; end;
  report := report || format(E'\n[%s] activity log is append-only', case when ok then 'PASS' else 'FAIL' end); if not ok then fails := fails + 1; end if;

  -- spoofed account_id gets corrected to the company's account
  insert into public.customers (company_id, account_id, owner_id, business_name) values (co_a1, acct_b, u_rep_x, 'Spoof') returning account_id into got_acct;
  report := report || format(E'\n[%s] spoofed account_id is overwritten from company', case when got_acct = acct_a then 'PASS' else 'FAIL' end); if got_acct <> acct_a then fails := fails + 1; end if;

  execute 'reset role';

  -- ===== Rep Y =====
  perform set_config('request.jwt.claims', json_build_object('sub', u_rep_y, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u_rep_y::text, true);
  execute 'set local role authenticated';

  select count(*) into n from public.customers;
  report := report || format(E'\n[%s] rep Y sees own customers across both assigned companies (got %s, want 2)', case when n = 2 then 'PASS' else 'FAIL' end, n); if n <> 2 then fails := fails + 1; end if;

  ok := false;
  begin
    insert into public.appointments (company_id, account_id, customer_id, rep_id, starts_at) values (co_a1, acct_a, c_y2, u_rep_y, now());
  exception when others then ok := true; end;
  report := report || format(E'\n[%s] appointment cannot cross companies (customer in A2, appt in A1)', case when ok then 'PASS' else 'FAIL' end); if not ok then fails := fails + 1; end if;

  execute 'reset role';

  -- ===== Inactive rep =====
  perform set_config('request.jwt.claims', json_build_object('sub', u_rep_off, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u_rep_off::text, true);
  execute 'set local role authenticated';

  select count(*) into n from public.customers;
  report := report || format(E'\n[%s] deactivated rep sees nothing (got %s)', case when n = 0 then 'PASS' else 'FAIL' end, n); if n <> 0 then fails := fails + 1; end if;

  execute 'reset role';

  -- ===== Rep B (other account) =====
  perform set_config('request.jwt.claims', json_build_object('sub', u_rep_b, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u_rep_b::text, true);
  execute 'set local role authenticated';

  select count(*) into n from public.customers where account_id = acct_a;
  report := report || format(E'\n[%s] other-account rep sees zero of account A''s customers', case when n = 0 then 'PASS' else 'FAIL' end); if n <> 0 then fails := fails + 1; end if;

  select count(*) into n from public.companies where account_id = acct_a;
  report := report || format(E'\n[%s] other-account rep sees zero of account A''s companies', case when n = 0 then 'PASS' else 'FAIL' end); if n <> 0 then fails := fails + 1; end if;

  execute 'reset role';

  -- ===== Account admin A =====
  perform set_config('request.jwt.claims', json_build_object('sub', u_admin_a, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u_admin_a::text, true);
  execute 'set local role authenticated';

  select count(*) into n from public.customers where account_id = acct_b;
  report := report || format(E'\n[%s] account admin sees zero customers in another account', case when n = 0 then 'PASS' else 'FAIL' end); if n <> 0 then fails := fails + 1; end if;

  select count(*) into n from public.customers where account_id = acct_a;
  report := report || format(E'\n[%s] account admin sees all customers in own account (got %s, want 5)', case when n = 5 then 'PASS' else 'FAIL' end, n); if n <> 5 then fails := fails + 1; end if;

  select count(*) into n from public.profiles where account_id = acct_b;
  report := report || format(E'\n[%s] account admin sees zero users in another account', case when n = 0 then 'PASS' else 'FAIL' end); if n <> 0 then fails := fails + 1; end if;

  ok := false;
  begin
    update public.profiles set role = 'super_admin' where id = u_rep_x;
  exception when others then ok := true; end;
  report := report || format(E'\n[%s] account admin cannot grant super admin', case when ok then 'PASS' else 'FAIL' end); if not ok then fails := fails + 1; end if;

  execute 'reset role';

  -- ===== Super admin =====
  perform set_config('request.jwt.claims', json_build_object('sub', u_super, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u_super::text, true);
  execute 'set local role authenticated';

  select count(*) into n from public.customers where account_id in (acct_a, acct_b);
  report := report || format(E'\n[%s] super admin sees every account (got %s, want 6)', case when n = 6 then 'PASS' else 'FAIL' end, n); if n <> 6 then fails := fails + 1; end if;

  execute 'reset role';

  -- ===== Even the database owner cannot rewrite the activity log =====
  ok := false;
  begin
    update public.activity_log set summary = 'rewritten' where customer_id = c_x;
  exception when others then ok := true; end;
  report := report || format(E'\n[%s] activity log blocks edits even server-side', case when ok then 'PASS' else 'FAIL' end); if not ok then fails := fails + 1; end if;

  ok := false;
  begin
    delete from public.activity_log where customer_id = c_x;
  exception when others then ok := true; end;
  report := report || format(E'\n[%s] activity log blocks direct deletes', case when ok then 'PASS' else 'FAIL' end); if not ok then fails := fails + 1; end if;

  -- ===== Admin can still delete a customer (its timeline goes with it) =====
  perform set_config('request.jwt.claims', json_build_object('sub', u_admin_a, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u_admin_a::text, true);
  execute 'set local role authenticated';
  ok := true;
  begin
    delete from public.customers where id = c_x;
    get diagnostics n = row_count;
    ok := (n = 1);
  exception when others then ok := false; end;
  report := report || format(E'\n[%s] admin can delete a customer with timeline history', case when ok then 'PASS' else 'FAIL' end); if not ok then fails := fails + 1; end if;
  execute 'reset role';

  -- ---------- report + rollback ----------
  if fails = 0 then
    raise exception 'RLS REPORT: ALL PASSED%', report;
  else
    raise exception 'RLS REPORT: % FAILED%', fails, report;
  end if;
end $$;
