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

-- Migration: add the developer role - the person who builds/maintains this
-- app, distinct from the business owner. Drop-and-recreate because Postgres
-- has no "alter check constraint" - safe to re-run.
alter table buster_profiles drop constraint if exists buster_profiles_role_check;
alter table buster_profiles add constraint buster_profiles_role_check
  check (role in ('worker', 'owner', 'learner', 'developer'));

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

-- Migration: real_name (the client's actual/legal name, used on the owner
-- invoice instead of the nickname in `name`) and payment_method (which of
-- the owner's buster_payment_methods rows below this client pays into).
alter table buster_clients add column if not exists real_name text;
alter table buster_clients add column if not exists payment_method text;
alter table buster_clients drop constraint if exists buster_clients_payment_method_check;
alter table buster_clients add constraint buster_clients_payment_method_check
  check (payment_method is null or payment_method in ('bank', 'wise', 'paypal'));

-- Migration: per-client invoice numbering. Holds the number to print on this
-- client's *next* generated invoice - the owner sets each client's starting
-- point manually (invoice numbering isn't shared across clients), and the
-- app increments it by 1 after each PDF download.
alter table buster_clients add column if not exists next_invoice_number integer not null default 1;

-- Migration: per-client owner-cut percentages, replacing the app's old
-- global rates (40% PM Sales / 20% Sexting / 15% Customs) with an explicit,
-- editable percent per client per transaction type. Defaults match the old
-- global rates so existing clients keep their current numbers until the
-- owner deliberately customizes one.
alter table buster_clients add column if not exists pm_sales_owner_percent numeric not null default 40;
alter table buster_clients add column if not exists sexting_owner_percent numeric not null default 20;
alter table buster_clients add column if not exists customs_owner_percent numeric not null default 15;

-- Migration: per-client color (hex accent), replacing the old scheme that
-- auto-assigned a color from a client's position (index % 5) in the
-- alphabetically-sorted client list - every client's color could shift
-- whenever a new one was added earlier in the alphabet. Colors are now
-- stored per client and never move once set. Backfill existing rows (only
-- where color is still null, so this is safe to re-run without clobbering
-- a color the owner has since picked) with the color their old alphabetical
-- position would have produced, so nothing visually changes for existing
-- clients; the app always sends an explicit color for new clients from here
-- on, picked via the color picker in Team, Clients & Sale Types.
alter table buster_clients add column if not exists color text;
update buster_clients c
set color = (array['#6673d1', '#e2823f', '#3fa866', '#c9599f', '#d0aa2b'])[(sub.position % 5) + 1]
from (
  select id, row_number() over (order by name asc) - 1 as position
  from buster_clients
) sub
where c.id = sub.id and c.color is null;
alter table buster_clients alter column color set default '#6673d1';
alter table buster_clients alter column color set not null;

-- Migration: per-client Telegram chat ID, used to notify that client directly
-- (via the notify-telegram edge function) when a worker completes a customer
-- order form for them. Nullable - notifications are best-effort and simply
-- skipped for a client with none set.
alter table buster_clients add column if not exists telegram_chat_id text;

-- The owner's own payout details for each method - a fixed set of 3 rows
-- (seeded below, never inserted/deleted from the app, only updated in
-- place). Owner-only end to end (no "anyone signed in reads" policy like
-- buster_clients/buster_sale_types below) since this is banking/PayPal info,
-- not something every signed-in worker needs to read.
create table if not exists buster_payment_methods (
  id uuid primary key default gen_random_uuid(),
  method text not null unique check (method in ('bank', 'wise', 'paypal')),
  details jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into buster_payment_methods (method) values ('bank'), ('wise'), ('paypal')
on conflict (method) do nothing;

-- A worker's own payout details - where the owner pays *them*, as opposed to
-- buster_payment_methods above (the owner's own fixed 3 rows, where clients
-- pay the owner). One row per worker, worker-managed via the "Payment
-- Details" tab on their own portal - unlike buster_payment_methods' fixed
-- set of 3 method rows, a worker picks a single method and only that
-- method's fields are ever written to `details`.
create table if not exists buster_worker_payment_details (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null unique references buster_profiles(id),
  method text not null check (method in ('bank', 'wise', 'paypal')),
  details jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
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
  client_id uuid references buster_clients(id),
  section text not null check (section in ('sexting', 'customs')),
  buyer_username text not null,
  sale_type_id uuid not null references buster_sale_types(id),
  gross numeric not null check (gross >= 0),
  net numeric not null,
  earnings numeric not null,
  created_at timestamptz not null default now()
);

-- Migration: allow "General" entries that aren't tied to a client. Safe to
-- re-run - dropping a constraint that's already gone is a no-op in Postgres.
alter table buster_sale_entries alter column client_id drop not null;

-- Extra intake info a worker must fill in for every 'customs' section sale
-- entry before they can submit their timesheet (the "Submit Customer Order"
-- tab). One row per buster_sale_entries row, upserted on sale_entry_id as
-- the worker fills in the form (fields start null and are filled in over
-- possibly several edits, unlike buster_sale_entries which is insert/delete
-- only) - cascades on delete so removing the underlying entry cleans this up
-- too.
create table if not exists buster_customer_orders (
  id uuid primary key default gen_random_uuid(),
  sale_entry_id uuid not null unique references buster_sale_entries(id) on delete cascade,
  worker_id uuid not null references buster_profiles(id),
  custom_type text check (custom_type in ('custom_vid', 'custom_pics', 'video_cock_rate', 'panties_other')),
  custom_type_other text,
  profile_link text,
  custom_info text,
  pinned_messages boolean,
  added_to_waiting_list boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Migration: add a plain 'other' type alongside 'panties_other' - both reveal
-- the same free-text "specify" field on the form. Safe to re-run.
alter table buster_customer_orders drop constraint if exists buster_customer_orders_custom_type_check;
alter table buster_customer_orders add constraint buster_customer_orders_custom_type_check
  check (custom_type in ('custom_vid', 'custom_pics', 'video_cock_rate', 'panties_other', 'other'));

-- Free-standing reminders/events on a calendar day, unrelated to sale
-- entries (e.g. "Client meeting", "Payday") - owner-only, never surfaced to
-- workers or learners.
create table if not exists buster_calendar_events (
  id uuid primary key default gen_random_uuid(),
  event_date date not null,
  title text not null,
  notes text,
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

-- Owner-raised requests (bugs, feature ideas, billing/charge requests) aimed
-- at the developer, replacing ad-hoc messages outside the app. type/status/
-- priority are free-standing enums (not FKs) since this is a small, fixed
-- set owned by the app, same philosophy as buster_sale_entries.section.
create table if not exists buster_requests (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references buster_profiles(id),
  type text not null check (type in ('bug', 'feature', 'billing')),
  title text not null,
  description text not null,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'needs_info', 'completed', 'declined')),
  progress integer not null default 0 check (progress between 0 and 100),
  screenshot_paths text[] not null default '{}',
  resolution_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Back-and-forth thread on a request - lets the developer ask a clarifying
-- question and the owner reply (or vice versa) without changing status.
create table if not exists buster_request_comments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references buster_requests(id) on delete cascade,
  author_id uuid not null references buster_profiles(id),
  body text not null,
  created_at timestamptz not null default now()
);

-- Owner-managed price list originally used by buster_owner_submissions
-- below (a dropdown of preset items). No longer written or read by the
-- app - owner submissions moved to free-form username + amount entry - but
-- left in place rather than dropped, since it's harmless and existing rows
-- aren't referenced by anything anymore after the migration just below.
create table if not exists buster_owner_submission_items (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('subscriptions', 'tips', 'livestreams')),
  label text not null,
  price numeric not null check (price >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (category, label)
);

-- The owner's own logged transactions for those 3 categories, per client.
-- No worker_id - this is owner-entered data, distinct from buster_sale_entries.
create table if not exists buster_owner_submissions (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('subscriptions', 'tips', 'livestreams')),
  client_id uuid references buster_clients(id),
  entry_date date not null,
  item_id uuid references buster_owner_submission_items(id),
  gross numeric not null check (gross >= 0),
  net numeric not null,
  owner_cut numeric not null,
  created_at timestamptz not null default now()
);

-- Migration: replace the preset item_id dropdown with a free-form
-- buyer_username (mirrors buster_sale_entries.buyer_username) plus a
-- per-entry owner-cut % override entered at submission time - backfill
-- existing rows from their old item's label first so history isn't lost,
-- then drop item_id since nothing needs it once that backfill has run.
-- The backfill is wrapped in a column-existence check (rather than a bare
-- UPDATE) because item_id itself gets dropped at the end of this block -
-- safe to re-run once, but a bare `os.item_id` reference would break on
-- every re-run after that first one, once the column is actually gone.
alter table buster_owner_submissions add column if not exists buyer_username text;
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'buster_owner_submissions' and column_name = 'item_id'
  ) then
    update buster_owner_submissions os
      set buyer_username = coalesce((select label from buster_owner_submission_items where id = os.item_id), 'Unknown')
      where buyer_username is null;
  end if;
end $$;
alter table buster_owner_submissions alter column buyer_username set default '';
alter table buster_owner_submissions alter column buyer_username set not null;
alter table buster_owner_submissions drop column if exists item_id;

-- Weekly per-client finalization of the 3 owner-submission categories above,
-- combined with that week's buster_client_invoices owner_cut for the same
-- client (captured at creation time, same "snapshot the numbers" approach as
-- buster_client_invoices itself).
create table if not exists buster_owner_submission_invoices (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references buster_clients(id),
  week_start date not null,
  week_end date not null,
  subscriptions_owner_cut numeric not null,
  tips_owner_cut numeric not null,
  livestreams_owner_cut numeric not null,
  owner_submissions_cut numeric not null,
  client_invoice_owner_cut numeric not null,
  combined_owner_cut numeric not null,
  dealt_with boolean not null default false,
  created_at timestamptz not null default now(),
  unique (client_id, week_start)
);

-- Migration: two new owner-submission categories, "Paige sexting" and "Alex
-- sexting" - the owner's own sexting-type entries, as opposed to the
-- existing subscriptions/tips/livestreams (Purchases/Tips/Customs). Unlike
-- those 3, these fold into the "Sexting Sales & Customs" invoice total
-- alongside contractor buster_sale_entries, rather than "PPV Purchases &
-- Tips" - see client_invoice_owner_cut usage in src/routes/OwnerDashboard.tsx.
alter table buster_owner_submissions drop constraint if exists buster_owner_submissions_category_check;
alter table buster_owner_submissions add constraint buster_owner_submissions_category_check
  check (category in ('subscriptions', 'tips', 'livestreams', 'paige_sexting', 'alex_sexting'));

alter table buster_owner_submission_invoices add column if not exists paige_sexting_owner_cut numeric not null default 0;
alter table buster_owner_submission_invoices add column if not exists alex_sexting_owner_cut numeric not null default 0;

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

-- Same shape as buster_is_owner() above, for the developer role - used by
-- the request-tracker RLS policies below.
create or replace function buster_is_developer()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from buster_profiles
    where auth_user_id = auth.uid() and role = 'developer' and status = 'active'
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
-- change a function's return type (scalar -> setof), and also sidesteps the
-- separate issue where a dropped-and-recreated buster_profiles table gets a
-- new row-type OID that create-or-replace refuses to accept either way.
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
-- buster_training_progress or buster_sale_entries (only learners/workers can
-- delete their own rows there) and because buster_submissions has no owner
-- delete policy at all. Also clears buster_requests/buster_request_comments
-- authored by the target - needed since this now also deletes owner profiles
-- (Account tab), and created_by/author_id have no cascade, so an owner who'd
-- ever raised or commented on a request would otherwise fail here with a
-- foreign-key violation.
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
  delete from buster_sale_entries where worker_id = target_id;
  delete from buster_request_comments where author_id = target_id;
  delete from buster_requests where created_by = target_id;
  delete from buster_profiles where id = target_id;
end;
$$;

grant execute on function buster_delete_profile(uuid) to authenticated;

-- Owner-triggered permanent delete of a single weekly submission, plus the
-- underlying buster_sale_entries rows for that worker/week (so it also
-- disappears from the worker's own timesheet history). Same
-- security-definer shape as buster_delete_profile() above, for the same
-- reason: buster_submissions has no owner delete policy at all.
create or replace function buster_delete_submission(target_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  target buster_submissions%rowtype;
begin
  if not buster_is_owner() then
    raise exception 'Only an owner can delete a submission.';
  end if;

  select * into target from buster_submissions where id = target_id;
  if not found then
    raise exception 'Submission not found.';
  end if;

  delete from buster_sale_entries
    where worker_id = target.worker_id
      and entry_date between target.week_start and target.week_end;

  delete from buster_submissions where id = target_id;
end;
$$;

grant execute on function buster_delete_submission(uuid) to authenticated;

alter table buster_profiles enable row level security;
alter table buster_submissions enable row level security;
alter table buster_clients enable row level security;
alter table buster_sale_types enable row level security;
alter table buster_sale_entries enable row level security;
alter table buster_customer_orders enable row level security;
alter table buster_client_invoices enable row level security;
alter table buster_training_progress enable row level security;
alter table buster_calendar_events enable row level security;
alter table buster_requests enable row level security;
alter table buster_request_comments enable row level security;
alter table buster_owner_submission_items enable row level security;
alter table buster_owner_submissions enable row level security;
alter table buster_owner_submission_invoices enable row level security;
alter table buster_payment_methods enable row level security;
alter table buster_worker_payment_details enable row level security;

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

-- Lets the developer dashboard show "raised by <owner name>" on a request -
-- narrower than the owner's own full-table access above, since the
-- developer only ever needs to resolve the owner side of a request thread.
drop policy if exists "developer reads owner profiles" on buster_profiles;
create policy "developer reads owner profiles" on buster_profiles for select
  using (buster_is_developer() and role = 'owner');

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

-- buster_payment_methods policies - owner-only, no "anyone signed in reads"
-- policy (unlike buster_clients/buster_sale_types above) since this is
-- banking/PayPal info, not something every signed-in worker needs to read.
drop policy if exists "owner manages" on buster_payment_methods;
create policy "owner manages" on buster_payment_methods for all
  using (buster_is_owner())
  with check (buster_is_owner());

-- buster_worker_payment_details policies - a worker fully owns their own row
-- (insert/select/update); the owner can read every row (needed to actually
-- pay workers) but never writes one - same "don't let anyone but the owner
-- of the data edit it" philosophy as buster_training_progress.
drop policy if exists "worker inserts own" on buster_worker_payment_details;
create policy "worker inserts own" on buster_worker_payment_details for insert
  with check (
    worker_id in (
      select id from buster_profiles where auth_user_id = auth.uid() and status = 'active'
    )
  );

drop policy if exists "worker reads own, owner reads all" on buster_worker_payment_details;
create policy "worker reads own, owner reads all" on buster_worker_payment_details for select
  using (
    worker_id in (select id from buster_profiles where auth_user_id = auth.uid())
    or buster_is_owner()
  );

drop policy if exists "worker updates own" on buster_worker_payment_details;
create policy "worker updates own" on buster_worker_payment_details for update
  using (worker_id in (select id from buster_profiles where auth_user_id = auth.uid()))
  with check (worker_id in (select id from buster_profiles where auth_user_id = auth.uid()));

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

-- buster_customer_orders policies - unlike buster_sale_entries, workers can
-- update their own rows freely (the whole point is filling the form in over
-- multiple edits before submitting), not just insert/delete.
drop policy if exists "worker inserts own" on buster_customer_orders;
create policy "worker inserts own" on buster_customer_orders for insert
  with check (
    worker_id in (
      select id from buster_profiles where auth_user_id = auth.uid() and status = 'active'
    )
  );

drop policy if exists "worker reads own, owner reads all" on buster_customer_orders;
create policy "worker reads own, owner reads all" on buster_customer_orders for select
  using (
    worker_id in (select id from buster_profiles where auth_user_id = auth.uid())
    or buster_is_owner()
  );

drop policy if exists "worker updates own" on buster_customer_orders;
create policy "worker updates own" on buster_customer_orders for update
  using (worker_id in (select id from buster_profiles where auth_user_id = auth.uid()))
  with check (worker_id in (select id from buster_profiles where auth_user_id = auth.uid()));

drop policy if exists "worker deletes own" on buster_customer_orders;
create policy "worker deletes own" on buster_customer_orders for delete
  using (worker_id in (select id from buster_profiles where auth_user_id = auth.uid()));

-- buster_client_invoices policies - owner-only, workers never see these
-- (this is the owner/client-facing side of the money, not the worker's).
drop policy if exists "owner manages" on buster_client_invoices;
create policy "owner manages" on buster_client_invoices for all
  using (buster_is_owner())
  with check (buster_is_owner());

-- buster_calendar_events policies - owner-only, same shape as
-- buster_client_invoices above (workers/learners never see these).
drop policy if exists "owner manages" on buster_calendar_events;
create policy "owner manages" on buster_calendar_events for all
  using (buster_is_owner())
  with check (buster_is_owner());

-- buster_owner_submission_items / buster_owner_submissions /
-- buster_owner_submission_invoices policies - owner-only, same shape as
-- buster_client_invoices above (workers/learners never see these).
drop policy if exists "owner manages" on buster_owner_submission_items;
create policy "owner manages" on buster_owner_submission_items for all
  using (buster_is_owner())
  with check (buster_is_owner());

drop policy if exists "owner manages" on buster_owner_submissions;
create policy "owner manages" on buster_owner_submissions for all
  using (buster_is_owner())
  with check (buster_is_owner());

drop policy if exists "owner manages" on buster_owner_submission_invoices;
create policy "owner manages" on buster_owner_submission_invoices for all
  using (buster_is_owner())
  with check (buster_is_owner());

-- buster_requests policies - the owner raises requests, the developer
-- triages/updates them. No owner update/delete policy: same immutability
-- philosophy as buster_submissions - fixing something after the fact goes
-- through a comment, not an edit of the original request.
drop policy if exists "owner inserts own" on buster_requests;
create policy "owner inserts own" on buster_requests for insert
  with check (
    created_by in (select id from buster_profiles where auth_user_id = auth.uid() and status = 'active')
  );

drop policy if exists "owner reads own, developer reads all" on buster_requests;
create policy "owner reads own, developer reads all" on buster_requests for select
  using (
    created_by in (select id from buster_profiles where auth_user_id = auth.uid())
    or buster_is_developer()
  );

drop policy if exists "developer updates any" on buster_requests;
create policy "developer updates any" on buster_requests for update
  using (buster_is_developer())
  with check (buster_is_developer());

-- buster_request_comments policies - either side of a request's thread can
-- post and read, gated through the parent request's ownership.
drop policy if exists "participants insert" on buster_request_comments;
create policy "participants insert" on buster_request_comments for insert
  with check (
    author_id in (select id from buster_profiles where auth_user_id = auth.uid() and status = 'active')
    and (
      buster_is_developer()
      or exists (
        select 1 from buster_requests r
        join buster_profiles p on p.id = r.created_by
        where r.id = request_id and p.auth_user_id = auth.uid()
      )
    )
  );

drop policy if exists "participants read" on buster_request_comments;
create policy "participants read" on buster_request_comments for select
  using (
    buster_is_developer()
    or exists (
      select 1 from buster_requests r
      join buster_profiles p on p.id = r.created_by
      where r.id = request_id and p.auth_user_id = auth.uid()
    )
  );

-- Private storage bucket for request screenshots. Objects are stored under
-- "<profile id>/<filename>" so the folder-name policies below can gate
-- access without a join - the owner who created them (by folder) or any
-- developer can read; only the uploader's own folder accepts inserts/deletes.
insert into storage.buckets (id, name, public)
values ('request-screenshots', 'request-screenshots', false)
on conflict (id) do nothing;

drop policy if exists "request screenshot upload" on storage.objects;
create policy "request screenshot upload" on storage.objects for insert
  with check (
    bucket_id = 'request-screenshots'
    and (storage.foldername(name))[1] = (select id::text from buster_profiles where auth_user_id = auth.uid())
  );

drop policy if exists "request screenshot read" on storage.objects;
create policy "request screenshot read" on storage.objects for select
  using (
    bucket_id = 'request-screenshots'
    and (
      (storage.foldername(name))[1] = (select id::text from buster_profiles where auth_user_id = auth.uid())
      or buster_is_developer()
    )
  );

drop policy if exists "request screenshot delete own" on storage.objects;
create policy "request screenshot delete own" on storage.objects for delete
  using (
    bucket_id = 'request-screenshots'
    and (storage.foldername(name))[1] = (select id::text from buster_profiles where auth_user_id = auth.uid())
  );

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

-- ---------------------------------------------------------------------
-- One-time seed for the developer login (/dev) - this is you, the person
-- who builds/maintains the app, not the business owner above. A distinct
-- address from the owner seed above - buster_profiles has a unique email
-- constraint.
-- ---------------------------------------------------------------------
insert into buster_profiles (email, full_name, role, status)
values ('andrew.britain7@gmail.com', 'Andrew Britain', 'developer', 'pending')
on conflict (email) do nothing;
