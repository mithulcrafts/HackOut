create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('EV charging','Water heating','Industrial process')),
  name text not null check (char_length(name) between 1 and 80), earliest_start time not null,
  latest_finish time not null, duration_minutes integer not null check (duration_minutes between 30 and 720),
  interruptible boolean not null default true, status text not null default 'recommended' check (status in ('recommended','accepted','skipped','completed','verified','failed')),
  created_at timestamptz not null default now(), check (latest_finish > earliest_start)
);
alter table public.activities enable row level security;
create policy "Users can read their own activities" on public.activities for select to authenticated using ((select auth.uid()) = owner_id);
create policy "Users can create their own activities" on public.activities for insert to authenticated with check ((select auth.uid()) = owner_id);
grant select, insert on public.activities to authenticated;
