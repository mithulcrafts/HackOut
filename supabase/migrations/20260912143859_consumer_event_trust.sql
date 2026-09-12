-- Consumer fixture tables. All writes go through the bounded authenticated RPC.
create table public.offers (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 activity_id uuid not null references public.activities(id) on delete cascade, fixture_key text not null default 'consumer-ev-v1',
 name text not null default 'Demo EV charging', source text not null default 'simulation' check(source='simulation'),
 baseline_start integer not null default 30, duration_slots integer not null default 4,
 proposed_start integer not null default 26, deadline_slot integer not null default 34,
 required_kwh numeric not null default 8, power_kw numeric not null default 4,
 decision text not null default 'pending' check(decision in ('pending','accepted','skipped','overridden')),
 version integer not null default 1, simulation_run boolean not null default false, completion_slot integer,
 created_at timestamptz not null default now(), unique(owner_id,fixture_key)
);
create table public.meter_readings (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 offer_id uuid not null references public.offers(id) on delete cascade, slot integer not null check(slot between 0 and 48),
 cumulative_kwh numeric not null check(cumulative_kwh>=0), source text not null default 'simulation' check(source='simulation'),
 unique(offer_id,slot)
);
create table public.verifications (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 offer_id uuid not null unique references public.offers(id) on delete cascade,
 status text not null check(status in ('verified','partial','failed')), reason text not null,
 recorded_kwh numeric not null, eligible_kwh numeric not null, baseline_kwh numeric not null,
 created_at timestamptz not null default now()
);
create table public.reward_ledger (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 offer_id uuid not null unique references public.offers(id) on delete cascade,
 verification_id uuid not null unique references public.verifications(id) on delete cascade,
 points integer not null check(points>=0), illustrative_rupees numeric not null,
 state text not null default 'verified' check(state in ('pending','verified','redeemable')),
 source text not null default 'simulation' check(source='simulation'), created_at timestamptz not null default now()
);
create table public.consumer_notifications (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 offer_id uuid not null references public.offers(id) on delete cascade, message text not null,
 created_at timestamptz not null default now()
);
alter table public.offers enable row level security;
alter table public.meter_readings enable row level security;
alter table public.verifications enable row level security;
alter table public.reward_ledger enable row level security;
alter table public.consumer_notifications enable row level security;
create policy own_offers on public.offers for select to authenticated using((select auth.uid())=owner_id);
create policy own_readings on public.meter_readings for select to authenticated using((select auth.uid())=owner_id);
create policy own_verifications on public.verifications for select to authenticated using((select auth.uid())=owner_id);
create policy own_rewards on public.reward_ledger for select to authenticated using((select auth.uid())=owner_id);
create policy own_notifications on public.consumer_notifications for select to authenticated using((select auth.uid())=owner_id);
revoke all on public.offers,public.meter_readings,public.verifications,public.reward_ledger,public.consumer_notifications from anon,authenticated;
grant select on public.offers,public.meter_readings,public.verifications,public.reward_ledger,public.consumer_notifications to authenticated;
create index on public.meter_readings(owner_id);
create index on public.verifications(owner_id);
create index on public.reward_ledger(owner_id);
create index on public.consumer_notifications(owner_id);
