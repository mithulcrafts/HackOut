-- Durable operator/programme state. Route handlers should write these tables in
-- a transaction after the local prototype has been validated.
alter table public.profiles add column if not exists authorization_role text not null default 'consumer';
alter table public.profiles drop constraint if exists profiles_authorization_role_check;
alter table public.profiles add constraint profiles_authorization_role_check check (authorization_role in ('consumer','operator'));

create table if not exists public.programmes (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete restrict,
  name text not null, site_name text not null, timezone text not null default 'Asia/Kolkata',
  created_at timestamptz not null default now()
);
create table if not exists public.operator_scenarios (
  id uuid primary key default gen_random_uuid(), programme_id uuid not null references public.programmes(id) on delete cascade,
  scenario_date date not null, site_power_limit_kw numeric not null check(site_power_limit_kw > 0),
  battery jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.operator_forecast_slots (
  id bigint generated always as identity primary key, scenario_id uuid not null references public.operator_scenarios(id) on delete cascade,
  slot_start timestamptz not null, solar_kw numeric not null check(solar_kw >= 0), wind_kw numeric not null check(wind_kw >= 0),
  fixed_demand_kw numeric not null check(fixed_demand_kw >= 0), data_source text not null,
  unique(scenario_id, slot_start)
);
create table if not exists public.operator_events (
  id uuid primary key default gen_random_uuid(), scenario_id uuid not null references public.operator_scenarios(id) on delete cascade,
  name text not null, objective text not null check(objective in ('absorb','protect')), status text not null default 'draft',
  window_start timestamptz not null, window_end timestamptz not null, requested_flexibility_kw numeric not null,
  reward_rate_per_kwh numeric not null default 0, budget numeric not null default 0, created_at timestamptz not null default now()
);
create table if not exists public.operator_audit_log (
  id bigint generated always as identity primary key, actor_id uuid references auth.users(id), action text not null,
  object_type text not null, object_id text, reason text not null, created_at timestamptz not null default now()
);
create table if not exists public.settlement_transactions (
  id uuid primary key default gen_random_uuid(), reward_id uuid references public.reward_ledger(id) on delete restrict,
  owner_id uuid not null references auth.users(id) on delete restrict, provider text not null,
  provider_reference text, amount numeric not null check(amount >= 0), currency text not null default 'INR',
  status text not null default 'pending' check(status in ('pending','submitted','succeeded','failed','refunded')),
  idempotency_key text not null unique, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

alter table public.programmes enable row level security;
alter table public.operator_scenarios enable row level security;
alter table public.operator_forecast_slots enable row level security;
alter table public.operator_events enable row level security;
alter table public.operator_audit_log enable row level security;
alter table public.settlement_transactions enable row level security;
create policy programme_operator_owner on public.programmes for all to authenticated using(owner_id = (select auth.uid()) and exists(select 1 from public.profiles where id=(select auth.uid()) and authorization_role='operator')) with check(owner_id = (select auth.uid()) and exists(select 1 from public.profiles where id=(select auth.uid()) and authorization_role='operator'));
create policy scenario_operator_owner on public.operator_scenarios for all to authenticated using(exists(select 1 from public.programmes p where p.id=programme_id and p.owner_id=(select auth.uid()))) with check(exists(select 1 from public.programmes p where p.id=programme_id and p.owner_id=(select auth.uid())));
create policy forecast_operator_owner on public.operator_forecast_slots for select to authenticated using(exists(select 1 from public.operator_scenarios s join public.programmes p on p.id=s.programme_id where s.id=scenario_id and p.owner_id=(select auth.uid())));
create policy event_operator_owner on public.operator_events for all to authenticated using(exists(select 1 from public.operator_scenarios s join public.programmes p on p.id=s.programme_id where s.id=scenario_id and p.owner_id=(select auth.uid()))) with check(exists(select 1 from public.operator_scenarios s join public.programmes p on p.id=s.programme_id where s.id=scenario_id and p.owner_id=(select auth.uid())));
create policy audit_operator_owner on public.operator_audit_log for insert to authenticated with check(actor_id=(select auth.uid()));
create policy settlement_owner_read on public.settlement_transactions for select to authenticated using(owner_id=(select auth.uid()));
revoke all on public.operator_audit_log, public.settlement_transactions from anon;
grant select,insert,update,delete on public.programmes, public.operator_scenarios, public.operator_forecast_slots, public.operator_events to authenticated;
grant insert on public.operator_audit_log to authenticated;
grant select on public.settlement_transactions to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.operator_scenarios, public.operator_events, public.operator_forecast_slots;
exception when duplicate_object then null;
end $$;

