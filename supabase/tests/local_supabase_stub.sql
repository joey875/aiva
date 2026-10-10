-- Minimal Supabase stand-in for local testing of migrations + RLS.
-- Mirrors: roles anon/authenticated/service_role, a non-superuser owner with BYPASSRLS,
-- auth.users, and auth.uid() reading request.jwt.claims.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create role supa_owner login bypassrls createrole;
grant anon, authenticated, service_role to supa_owner;
create database aiva owner supa_owner;
\c aiva
create schema auth authorization supa_owner;
create extension if not exists pgcrypto;
set role supa_owner;
create table auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
create or replace function auth.uid() returns uuid language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
