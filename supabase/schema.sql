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
  role text not null check (role in ('worker', 'owner', 'learner')),
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

-- Tracks which training modules a learner has passed the check for. module_id
-- is a free-text slug from the client-side content model (e.g. "start"),
-- deliberately not a foreign key - the training content lives in the app, not
-- the database, so new/renamed modules never require a migration here.
create table if not exists buster_training_progress (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references buster_profiles(id),
  module_id text not null,
  completed_at timestamptz not null default now(),
  unique (learner_id, module_id)
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

-- Claiming a pending profile on first sign-in is done through this
-- security-definer function rather than a client-side UPDATE gated by an
-- RLS policy. It runs with elevated privileges and only trusts auth.uid()
-- (sourced from the JWT's `sub` claim, always present) - it never depends
-- on the JWT's `email` claim, which some projects reshape via an Access
-- Token Hook and which silently broke the RLS-policy version of this.
--
-- Returns SETOF (zero or one row) rather than a single buster_profiles
-- value on purpose: a plpgsql function declared to return a bare composite
-- type that does `return null` doesn't come back over PostgREST as JSON
-- null - it comes back as a row with every column set to null, which the
-- client then mistakes for a real (but broken) profile. Returning a set
-- and using a bare `return;` for the not-found case gives a genuine
-- zero-row result instead. drop first: Postgres won't let create-or-replace
-- change a function's return type (scalar -> setof).
drop function if exists buster_claim_profile();
create or replace function buster_claim_profile()
returns setof buster_profiles
language plpgsql
security definer
as $$
declare
  caller_email text;
begin
  select email into caller_email from auth.users where id = auth.uid();
  if caller_email is null then
    return;
  end if;

  return query
    update buster_profiles
    set auth_user_id = auth.uid(), status = 'active'
    where lower(email) = lower(caller_email) and auth_user_id is null
    returning *;
end;
$$;

grant execute on function buster_claim_profile() to authenticated;

-- Permanent delete, gated to owners and to profiles already soft-removed via
-- "Remove" (status = 'removed') - the owner dashboard's regular Remove button
-- only ever sets that status, keeping history by default. This is the
-- explicit second step for actually clearing test/junk accounts out, and it
-- has to be security-definer because owners have no RLS delete grant on
-- buster_training_progress (only learners can delete their own rows) and
-- because buster_submissions has no owner delete policy at all.
create or replace function buster_delete_profile(target_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  if not buster_is_owner() then
    raise exception 'Only an owner can delete a profile.';
  end if;

  if not exists (select 1 from buster_profiles where id = target_id and status = 'removed') then
    raise exception 'Only a removed profile can be permanently deleted - remove it first.';
  end if;

  delete from buster_training_progress where learner_id = target_id;
  delete from buster_submissions where worker_id = target_id;
  delete from buster_profiles where id = target_id;
end;
$$;

grant execute on function buster_delete_profile(uuid) to authenticated;

alter table buster_profiles enable row level security;
alter table buster_submissions enable row level security;
alter table buster_training_progress enable row level security;

-- buster_profiles policies
drop policy if exists "self read" on buster_profiles;
create policy "self read" on buster_profiles for select
  using (auth_user_id = auth.uid() or buster_is_owner());

-- Claiming now happens exclusively through buster_claim_profile() above,
-- which bypasses RLS internally (security definer) - no client-side UPDATE
-- policy is needed or wanted for the pending -> claimed transition.
drop policy if exists "claim pending row on signup" on buster_profiles;

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

-- buster_training_progress policies
drop policy if exists "learner reads own, owner reads all" on buster_training_progress;
create policy "learner reads own, owner reads all" on buster_training_progress for select
  using (
    learner_id in (select id from buster_profiles where auth_user_id = auth.uid())
    or buster_is_owner()
  );

drop policy if exists "learner inserts own" on buster_training_progress;
create policy "learner inserts own" on buster_training_progress for insert
  with check (
    learner_id in (select id from buster_profiles where auth_user_id = auth.uid())
  );

-- Learners can clear their own progress ("reset training") - owners are
-- deliberately not granted delete here, only read, so a reset can't be done
-- on someone else's behalf by mistake.
drop policy if exists "learner deletes own" on buster_training_progress;
create policy "learner deletes own" on buster_training_progress for delete
  using (
    learner_id in (select id from buster_profiles where auth_user_id = auth.uid())
  );

-- ---------------------------------------------------------------------
-- One-time seed: replace the email/name below with your own and run this
-- once so you can sign up as the owner at the /owner page. Workers don't
-- need seeding here - add them from the owner dashboard once you're in.
-- ---------------------------------------------------------------------
insert into buster_profiles (email, full_name, role, status)
values ('andrew.britain@gmail.com', 'Andrew Britain', 'owner', 'pending')
on conflict (email) do nothing;
