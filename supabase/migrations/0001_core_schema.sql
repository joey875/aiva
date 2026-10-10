-- Aiva core schema
-- Tenancy: accounts -> companies -> reps (many-to-many) -> customers

create extension if not exists pgcrypto;

-- ---------- Enums ----------
create type public.user_role as enum ('super_admin', 'account_admin', 'rep');
create type public.appointment_status as enum ('scheduled', 'completed', 'no_show', 'canceled');
create type public.commitment_type as enum ('follow_up', 're_pitch', 'send_recap', 'other');
create type public.commitment_status as enum ('open', 'confirmed', 'done', 'dismissed');
create type public.commitment_party as enum ('rep', 'customer');
create type public.task_status as enum ('open', 'done', 'canceled');
create type public.actor_type as enum ('rep', 'assistant', 'admin', 'system');
create type public.template_type as enum ('recap', 'follow_up', 're_pitch', 'no_show', 'intro', 'other');
create type public.draft_status as enum ('draft', 'approved', 'sent', 'failed', 'canceled');
create type public.customer_status as enum ('lead', 'prospect', 'active', 'won', 'lost');
create type public.recording_source as enum ('app', 'voice_memo', 'omi', 'fieldy', 'plaud', 'upload', 'other');
create type public.voice_channel as enum ('app', 'phone');

-- ---------- updated_at helper ----------
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------- Accounts ----------
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Profiles (one per auth user) ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete restrict,
  role public.user_role not null default 'rep',
  full_name text not null default '',
  email text not null,
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_account_idx on public.profiles (account_id);
create unique index profiles_email_idx on public.profiles (lower(email));

-- ---------- Companies ----------
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  name text not null,
  brand_color text,
  email_signature text,
  language_rules jsonb not null default '{}'::jsonb, -- e.g. forbidden terms per business identity
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index companies_account_idx on public.companies (account_id);

-- ---------- Company <-> Rep assignments ----------
create table public.company_reps (
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (company_id, user_id)
);
create index company_reps_user_idx on public.company_reps (user_id);

-- ---------- Pipeline stages (per company) ----------
create table public.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  position int not null default 0,
  is_won boolean not null default false,
  is_lost boolean not null default false,
  created_at timestamptz not null default now()
);
create index pipeline_stages_company_idx on public.pipeline_stages (company_id, position);

-- ---------- Customers ----------
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete restrict,
  contact_name text not null default '',
  business_name text not null default '',
  title text,
  phone text,
  email text,
  address text,
  city text,
  state text default 'LA',
  website text,
  stage_id uuid references public.pipeline_stages (id) on delete set null,
  status public.customer_status not null default 'lead',
  source text,
  interest_level smallint check (interest_level between 1 and 10),
  people_notes text,          -- "prefers texting, met at Chamber event"
  notes text,
  next_step text,
  next_step_at timestamptz,
  last_activity_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customers_has_name check (contact_name <> '' or business_name <> '')
);
create index customers_company_idx on public.customers (company_id, stage_id);
create index customers_owner_idx on public.customers (owner_id);
create index customers_search_idx on public.customers
  using gin (to_tsvector('simple', coalesce(contact_name,'') || ' ' || coalesce(business_name,'') || ' ' || coalesce(email,'') || ' ' || coalesce(phone,'') || ' ' || coalesce(city,'')));

-- ---------- Appointments ----------
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  rep_id uuid not null references public.profiles (id) on delete restrict,
  title text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text,
  status public.appointment_status not null default 'scheduled',
  google_event_id text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index appointments_rep_time_idx on public.appointments (rep_id, starts_at);
create index appointments_customer_idx on public.appointments (customer_id);

-- ---------- Recordings / transcripts / visit outcomes ----------
create table public.recordings (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete set null,
  appointment_id uuid references public.appointments (id) on delete set null,
  rep_id uuid not null references public.profiles (id) on delete restrict,
  source public.recording_source not null default 'app',
  audio_path text,
  audio_expires_at timestamptz,
  transcript text,
  speakers jsonb,
  summary text,
  objections jsonb not null default '[]'::jsonb,
  next_steps jsonb not null default '[]'::jsonb,
  products_discussed jsonb not null default '[]'::jsonb,
  pricing_discussed text,
  interest_level smallint check (interest_level between 1 and 10),
  script_score smallint check (script_score between 0 and 100),
  consent_logged boolean not null default true,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);
create index recordings_customer_idx on public.recordings (customer_id);
create index recordings_rep_idx on public.recordings (rep_id, created_at desc);

-- ---------- Tasks ----------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  rep_id uuid not null references public.profiles (id) on delete restrict,
  customer_id uuid references public.customers (id) on delete cascade,
  type text not null default 'follow_up',
  title text not null,
  notes text,
  due_at timestamptz,
  status public.task_status not null default 'open',
  created_by public.actor_type not null default 'rep',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tasks_rep_due_idx on public.tasks (rep_id, status, due_at);

-- ---------- Commitments (spoken promises) ----------
create table public.commitments (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  recording_id uuid references public.recordings (id) on delete cascade,
  appointment_id uuid references public.appointments (id) on delete set null,
  rep_id uuid not null references public.profiles (id) on delete restrict,
  customer_id uuid references public.customers (id) on delete cascade,
  made_by public.commitment_party not null default 'rep',
  spoken_text text not null,
  type public.commitment_type not null default 'follow_up',
  due_date date,
  status public.commitment_status not null default 'open',
  task_id uuid references public.tasks (id) on delete set null,
  created_at timestamptz not null default now()
);
create index commitments_rep_idx on public.commitments (rep_id, status);

-- ---------- Templates ----------
create table public.templates (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  type public.template_type not null,
  name text not null,
  google_doc_id text,
  subject text,
  body text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index templates_company_idx on public.templates (company_id, type);

-- ---------- Email drafts ----------
create table public.email_drafts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  rep_id uuid not null references public.profiles (id) on delete restrict,
  customer_id uuid references public.customers (id) on delete cascade,
  template_id uuid references public.templates (id) on delete set null,
  recording_id uuid references public.recordings (id) on delete set null,
  kind public.template_type not null default 'other',
  to_email text,
  subject text,
  body text,
  status public.draft_status not null default 'draft',
  gmail_message_id text,
  gmail_thread_id text,
  approved_at timestamptz,
  sent_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index email_drafts_rep_idx on public.email_drafts (rep_id, status);
create index email_drafts_thread_idx on public.email_drafts (gmail_thread_id);

-- ---------- Google connections (server-only secrets) ----------
create table public.google_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete cascade,
  google_email text not null,
  refresh_token_encrypted text not null,
  scopes text[] not null default '{}',
  connected_at timestamptz not null default now(),
  unique (user_id, google_email)
);

-- ---------- Rep voice/style learning ----------
create table public.rep_style_profiles (
  rep_id uuid primary key references public.profiles (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete cascade,
  profile jsonb not null default '{}'::jsonb, -- openers, objection handling, phrases, closing style, tone
  sample_count int not null default 0,
  updated_at timestamptz not null default now()
);

-- ---------- Assistant profile (per account: name, voice, personality) ----------
create table public.assistant_profiles (
  account_id uuid primary key references public.accounts (id) on delete cascade,
  name text not null default 'Ava',
  voice_provider text not null default 'elevenlabs',
  voice_id text,
  personality text not null default 'Competent, calm, warm, professional, concise, proactive. Short sentences. One question at a time. Recommends instead of listing options.',
  proactivity smallint not null default 3 check (proactivity between 1 and 5),
  updated_at timestamptz not null default now()
);

-- ---------- Voice usage metering ----------
create table public.voice_usage (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  channel public.voice_channel not null default 'app',
  seconds numeric not null default 0,
  characters int not null default 0,
  created_at timestamptz not null default now()
);
create index voice_usage_user_idx on public.voice_usage (user_id, created_at);

-- ---------- Activity log (append-only customer timeline) ----------
create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  actor_type public.actor_type not null default 'rep',
  kind text not null,            -- note, call, email, appointment, stage_change, created, edited
  summary text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index activity_log_customer_idx on public.activity_log (customer_id, created_at desc);

-- ---------- Notification settings ----------
create table public.notification_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete cascade,
  digest_email text,
  digest_enabled boolean not null default true,
  digest_time time not null default '07:00',
  timezone text not null default 'America/Chicago',
  reminder_offsets_minutes int[] not null default '{1440,60}',
  push_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

-- ---------- Audit events (approvals, sends, admin actions) ----------
create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.accounts (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  target_table text,
  target_id uuid,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_events_account_idx on public.audit_events (account_id, created_at desc);

-- ---------- Bootstrap admins (emails allowed to self-provision as super_admin) ----------
create table public.bootstrap_admins (
  email text primary key,
  account_id uuid not null references public.accounts (id) on delete cascade
);

-- ---------- updated_at triggers ----------
do $$
declare t text;
begin
  foreach t in array array['accounts','profiles','companies','customers','appointments','tasks','templates','email_drafts','assistant_profiles','notification_settings']
  loop
    execute format('create trigger %I_touch before update on public.%I for each row execute function public.touch_updated_at()', t, t);
  end loop;
end $$;
