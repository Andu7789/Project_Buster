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

create table if not exists buster_clients (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists buster_sale_types (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists buster_sale_entries (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references buster_profiles(id),
  entry_date date not null,
  client_id uuid not null references buster_clients(id),
  section text not null check (section in ('sexting', 'customs')),
  buyer_username text not null,
  sale_type_id uuid not null references buster_sale_types(id),
  gross numeric not null check (gross >= 0),
  net numeric not null,
  earnings numeric not null,
  created_at timestamptz not null default now()
);

create table if not exists buster_client_invoices (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references buster_clients(id),
  week_start date not null,
  week_end date not null,
  sexting_net numeric not null,
  customs_net numeric not null,
  worker_cut numeric not null,
  owner_cut numeric not null,
  client_payout numeric not null,
  dealt_with boolean not null default false,
  created_at timestamptz not null default now(),
  unique (client_id, week_start)
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
-- Dropped first (not just `create or replace`) because Postgres ties this
-- function's `returns buster_profiles` to the row type's OID at creation
-- time - if buster_profiles was ever dropped and recreated since this
-- function was last defined, `create or replace` fails with "cannot change
-- return type of existing function" even though the columns look identical.
drop function if exists buster_claim_profile();
create function buster_claim_profile()
returns buster_profiles
language plpgsql
security definer
as $$
declare
  claimed buster_profiles;
  caller_email text;
begin
  select email into caller_email from auth.users where id = auth.uid();
  if caller_email is null then
    return null;
  end if;

  update buster_profiles
  set auth_user_id = auth.uid(), status = 'active'
  where lower(email) = lower(caller_email) and auth_user_id is null
  returning * into claimed;

  if not found then
    return null;
  end if;

  return claimed;
end;
$$;

grant execute on function buster_claim_profile() to authenticated;

alter table buster_profiles enable row level security;
alter table buster_submissions enable row level security;
alter table buster_clients enable row level security;
alter table buster_sale_types enable row level security;
alter table buster_sale_entries enable row level security;
alter table buster_client_invoices enable row level security;

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

-- buster_clients / buster_sale_types policies - these are admin-managed lookup
-- lists. Every signed-in worker or owner can read them (needed to populate the
-- day-entry dropdowns), but only the owner can write to them.
drop policy if exists "anyone signed in reads" on buster_clients;
create policy "anyone signed in reads" on buster_clients for select
  using (auth.uid() is not null);

drop policy if exists "owner manages" on buster_clients;
create policy "owner manages" on buster_clients for all
  using (buster_is_owner())
  with check (buster_is_owner());

drop policy if exists "anyone signed in reads" on buster_sale_types;
create policy "anyone signed in reads" on buster_sale_types for select
  using (auth.uid() is not null);

drop policy if exists "owner manages" on buster_sale_types;
create policy "owner manages" on buster_sale_types for all
  using (buster_is_owner())
  with check (buster_is_owner());

-- buster_sale_entries policies
drop policy if exists "worker inserts own" on buster_sale_entries;
create policy "worker inserts own" on buster_sale_entries for insert
  with check (
    worker_id in (
      select id from buster_profiles where auth_user_id = auth.uid() and status = 'active'
    )
  );

drop policy if exists "worker reads own, owner reads all" on buster_sale_entries;
create policy "worker reads own, owner reads all" on buster_sale_entries for select
  using (
    worker_id in (select id from buster_profiles where auth_user_id = auth.uid())
    or buster_is_owner()
  );

-- Workers can delete their own entries to undo a mis-typed row (no update
-- policy - fixing a row is delete-and-re-add, same immutability philosophy
-- as buster_submissions above).
drop policy if exists "worker deletes own" on buster_sale_entries;
create policy "worker deletes own" on buster_sale_entries for delete
  using (
    worker_id in (select id from buster_profiles where auth_user_id = auth.uid())
  );

-- buster_client_invoices policies - owner-only, workers never see these
-- (this is the owner/client-facing side of the money, not the worker's).
drop policy if exists "owner manages" on buster_client_invoices;
create policy "owner manages" on buster_client_invoices for all
  using (buster_is_owner())
  with check (buster_is_owner());

-- ---------------------------------------------------------------------
-- One-time seed: replace the email/name below with your own and run this
-- once so you can sign up as the owner at the /owner page. Workers don't
-- need seeding here - add them from the owner dashboard once you're in.
-- ---------------------------------------------------------------------
insert into buster_profiles (email, full_name, role, status)
values ('andrew.britain@gmail.com', 'Andrew Britain', 'owner', 'pending')
on conflict (email) do nothing;
