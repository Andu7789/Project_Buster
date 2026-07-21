-- Project Buster schema
-- Run this whole file once in your Supabase project's SQL Editor
-- (Dashboard -> SQL Editor -> New query -> paste -> Run).
-- Safe to run in a project that already has other tables (e.g. a trading journal app) -
-- these table/policy/function names are scoped to this app.

create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id),
  email text not null unique,
  full_name text not null,
  role text not null check (role in ('worker', 'owner')),
  owner_share_percent numeric not null default 20,
  status text not null default 'pending' check (status in ('pending', 'active', 'suspended', 'removed')),
  created_at timestamptz not null default now()
);

create table if not exists submissions (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references profiles(id),
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
-- without recursive-RLS problems (a policy on `profiles` can't directly
-- re-query `profiles` under RLS).
create or replace function is_owner()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from profiles
    where auth_user_id = auth.uid() and role = 'owner' and status = 'active'
  );
$$;

alter table profiles enable row level security;
alter table submissions enable row level security;

-- profiles policies
drop policy if exists "self read" on profiles;
create policy "self read" on profiles for select
  using (auth_user_id = auth.uid() or is_owner());

drop policy if exists "claim pending row on signup" on profiles;
create policy "claim pending row on signup" on profiles for update
  using (auth_user_id is null and email = auth.jwt() ->> 'email')
  with check (auth_user_id = auth.uid());

drop policy if exists "owner manages all" on profiles;
create policy "owner manages all" on profiles for all
  using (is_owner())
  with check (is_owner());

-- submissions policies
drop policy if exists "worker inserts own" on submissions;
create policy "worker inserts own" on submissions for insert
  with check (
    worker_id in (
      select id from profiles where auth_user_id = auth.uid() and status = 'active'
    )
  );

drop policy if exists "worker reads own, owner reads all" on submissions;
create policy "worker reads own, owner reads all" on submissions for select
  using (
    worker_id in (select id from profiles where auth_user_id = auth.uid())
    or is_owner()
  );

drop policy if exists "owner updates any" on submissions;
create policy "owner updates any" on submissions for update
  using (is_owner())
  with check (is_owner());

-- Note: workers deliberately have no UPDATE/DELETE policy on submissions -
-- past timesheets are visible but not editable once submitted.

-- ---------------------------------------------------------------------
-- One-time seed: replace the email/name below with your own and run this
-- once so you can sign up as the owner at the /owner page. Workers don't
-- need seeding here - add them from the owner dashboard once you're in.
-- ---------------------------------------------------------------------
-- insert into profiles (email, full_name, role, status)
-- values ('you@example.com', 'Your Name', 'owner', 'pending');
