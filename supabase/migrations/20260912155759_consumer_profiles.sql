create table if not exists public.profiles (id uuid primary key references auth.users(id) on delete cascade, display_name text not null default '', location text not null default 'Gandhinagar, Gujarat', user_type text not null default 'household' check(user_type in ('household','EV owner','business','campus')), preferred_activity text not null default 'EV charging', device_status text not null default 'simulation', updated_at timestamptz not null default now());
alter table public.profiles enable row level security;
drop policy if exists own_profile_read on public.profiles; drop policy if exists own_profile_update on public.profiles; drop policy if exists own_profile_insert on public.profiles;
create policy own_profile_read on public.profiles for select to authenticated using((select auth.uid())=id);
create policy own_profile_insert on public.profiles for insert to authenticated with check((select auth.uid())=id);
create policy own_profile_update on public.profiles for update to authenticated using((select auth.uid())=id) with check((select auth.uid())=id);
grant select,insert,update on public.profiles to authenticated;
