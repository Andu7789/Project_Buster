-- Project Buster schema
-- Run this whole file once in your Supabase project's SQL Editor
-- (Dashboard -> SQL Editor -> New query -> paste -> Run).
--
-- Table/function names are prefixed with buster_ so this is safe to run in a
-- project that already has other tables (e.g. a trading journal app) - even
-- if one of those happens to be called "profiles" or "submissions" with a
-- different shape, this script won't touch it.

create table if not exists buster_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id),
  email text not null unique,
  full_name text not null,
  role text not null check (role in ('worker', 'owner')),
  owner_share_percent numeric not null default 20,
  status text not null default 'pending' check (status in ('pending', 'active', 'suspended', 'removed')),
  created_at timestamptz not null default now()
);

create table if not exists buster_submissions (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references buster_profiles(id),
  week_start date not null,
  week_end date not null,
  day_amounts jsonb not null,
  amount numeric not null,
  owner_share_percent numeric not null,
  dealt_with boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  unique (worker_id, week_start)
);

-- Security-definer helper so RLS policies can check "is this caller an owner"
-- without recursive-RLS problems (a policy on `buster_profiles` can't directly
-- re-query `buster_profiles` under RLS).
create or replace function buster_is_owner()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from buster_profiles
    where auth_user_id = auth.uid() and role = 'owner' and status = 'active'
  );
$$;

-- Security-definer helper that reads the caller's email straight from
-- auth.users via auth.uid(), instead of trusting the JWT's `email` claim -
-- some projects customize token claims (e.g. via an Access Token Hook),
-- which can silently break policies that read auth.jwt() ->> 'email'.
create or replace function buster_current_email()
returns text
language sql
security definer
stable
as $$
  select email from auth.users where id = auth.uid();
$$;

alter table buster_profiles enable row level security;
alter table buster_submissions enable row level security;

-- buster_profiles policies
drop policy if exists "self read" on buster_profiles;
create policy "self read" on buster_profiles for select
  using (auth_user_id = auth.uid() or buster_is_owner());

drop policy if exists "claim pending row on signup" on buster_profiles;
create policy "claim pending row on signup" on buster_profiles for update
  using (auth_user_id is null and lower(email) = lower(buster_current_email()))
  with check (auth_user_id = auth.uid());

drop policy if exists "owner manages all" on buster_profiles;
create policy "owner manages all" on buster_profiles for all
  using (buster_is_owner())
  with check (buster_is_owner());

-- buster_submissions policies
drop policy if exists "worker inserts own" on buster_submissions;
create policy "worker inserts own" on buster_submissions for insert
  with check (
    worker_id in (
      select id from buster_profiles where auth_user_id = auth.uid() and status = 'active'
    )
  );

drop policy if exists "worker reads own, owner reads all" on buster_submissions;
create policy "worker reads own, owner reads all" on buster_submissions for select
  using (
    worker_id in (select id from buster_profiles where auth_user_id = auth.uid())
    or buster_is_owner()
  );

drop policy if exists "owner updates any" on buster_submissions;
create policy "owner updates any" on buster_submissions for update
  using (buster_is_owner())
  with check (buster_is_owner());

-- Note: workers deliberately have no UPDATE/DELETE policy on buster_submissions -
-- past timesheets are visible but not editable once submitted.

-- ---------------------------------------------------------------------
-- One-time seed: replace the email/name below with your own and run this
-- once so you can sign up as the owner at the /owner page. Workers don't
-- need seeding here - add them from the owner dashboard once you're in.
-- ---------------------------------------------------------------------
insert into buster_profiles (email, full_name, role, status)
values ('andrew.britain@gmail.com', 'Andrew Britain', 'owner', 'pending')
on conflict (email) do nothing;
