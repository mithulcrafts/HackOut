-- Teammate B: additive consumer settings, activity constraints and reward presentation.
alter table public.activities add column if not exists power_kw numeric check(power_kw > 0 and power_kw <= 500);
alter table public.activities add column if not exists required_kwh numeric check(required_kwh > 0 and required_kwh <= 6000);
alter table public.activities add column if not exists baseline_start time;
alter table public.profiles add column if not exists leaderboard_opt_in boolean not null default false;
alter table public.profiles add column if not exists leaderboard_alias text not null default 'Participant' check(char_length(leaderboard_alias) between 1 and 30);
alter table public.consumer_notifications add column if not exists read_at timestamptz;

create or replace function public.initialize_consumer_profile() returns trigger
language plpgsql security definer set search_path='' as $$
begin insert into public.profiles(id) values(new.id) on conflict(id) do nothing; return new; end; $$;
drop trigger if exists initialize_consumer_profile on auth.users;
create trigger initialize_consumer_profile after insert on auth.users for each row execute function public.initialize_consumer_profile();
insert into public.profiles(id) select id from auth.users on conflict(id) do nothing;
revoke all on function public.initialize_consumer_profile() from public;

-- Only unoffered activities can be edited; accepted evidence remains immutable.
create or replace function public.edit_consumer_activity(target_id uuid, activity_data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); a public.activities; s time; f time; b time; mins integer; p numeric;
begin
 if u is null then raise exception 'Sign in required' using errcode='42501'; end if;
 select * into a from public.activities where id=target_id and owner_id=u for update;
 if a.id is null then raise exception 'Activity not found' using errcode='P0002'; end if;
 if exists(select 1 from public.offers where activity_id=a.id) then raise exception 'This activity has a linked offer. Add a new activity to change its requirements.'; end if;
 s:=(activity_data->>'earliest_start')::time; f:=(activity_data->>'latest_finish')::time;
 b:=(activity_data->>'baseline_start')::time; mins:=(activity_data->>'duration_minutes')::integer; p:=(activity_data->>'power_kw')::numeric;
 if s is null or f is null or b is null or mins is null or p is null or p<=0 or p>500 or mins<30 or mins>720 or mins%30<>0 or f<=s or extract(epoch from(f-s))/60<mins or b<s or b+make_interval(mins=>mins)>f then raise exception 'Check the activity timing and power limit'; end if;
 update public.activities set name=activity_data->>'name',type=activity_data->>'type',
 earliest_start=s,latest_finish=f,baseline_start=b,duration_minutes=mins,
 interruptible=(activity_data->>'interruptible')::boolean,power_kw=p,required_kwh=p*mins/60
 where id=a.id returning * into a;
 return to_jsonb(a);
end; $$;
revoke all on function public.edit_consumer_activity(uuid,jsonb) from public;
grant execute on function public.edit_consumer_activity(uuid,jsonb) to authenticated;

create or replace function public.mark_consumer_notifications_read() returns void
language sql security definer set search_path='' as $$
 update public.consumer_notifications set read_at=now() where owner_id=auth.uid() and read_at is null;
$$;
revoke all on function public.mark_consumer_notifications_read() from public;
grant execute on function public.mark_consumer_notifications_read() to authenticated;

-- A demo wallet transition only; no money leaves the system.
create or replace function public.release_demo_reward(target_reward uuid) returns void
language plpgsql security definer set search_path='' as $$
declare r public.reward_ledger;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 select * into r from public.reward_ledger where id=target_reward and owner_id=auth.uid() for update;
 if r.id is null then raise exception 'Reward not found' using errcode='P0002'; end if;
 if r.state='redeemable' then return; end if;
 if r.state<>'verified' or r.source<>'simulation' or not exists(select 1 from public.verifications where id=r.verification_id and owner_id=auth.uid() and status='verified') then raise exception 'A verified simulated reward is required'; end if;
 update public.reward_ledger set state='redeemable' where id=r.id;
 insert into public.consumer_notifications(owner_id,offer_id,message) values(auth.uid(),r.offer_id,'Your illustrative reward is redeemable in the demo wallet. No real payment was made.');
end; $$;
revoke all on function public.release_demo_reward(uuid) from public;
grant execute on function public.release_demo_reward(uuid) to authenticated;

-- Public aliases and aggregate participation only, with explicit opt-in.
create or replace function public.consumer_leaderboard() returns jsonb
language sql stable security definer set search_path='' as $$
 with counts as (
 select p.id,p.leaderboard_alias,
 count(o.id) filter(where o.decision='accepted')::integer as opportunities,
 count(v.id) filter(where o.decision='accepted' and v.status='verified')::integer as verified
 from public.profiles p left join public.offers o on o.owner_id=p.id
 left join public.verifications v on v.offer_id=o.id and v.owner_id=p.id
 where p.leaderboard_opt_in and auth.uid() is not null
 group by p.id,p.leaderboard_alias
 ), scores as (
 select *,round(100.0*verified/nullif(opportunities,0),1) as rate from counts where opportunities>0
 ), ranked as (
 select *,dense_rank() over(order by rate desc) as rank from scores
 )
 select coalesce(jsonb_agg(jsonb_build_object('alias',leaderboard_alias,'isYou',id=auth.uid(),'opportunities',opportunities,'verified',verified,'rate',rate,'rank',rank) order by rank,leaderboard_alias),'[]'::jsonb) from ranked;
$$;
revoke all on function public.consumer_leaderboard() from public;
grant execute on function public.consumer_leaderboard() to authenticated;

-- Do not mix evidence from other offers into the single-event demo.
create or replace function public.consumer_snapshot() returns jsonb language sql stable security invoker set search_path='' as $$
 with current_offer as (select * from public.offers where owner_id=auth.uid() and fixture_key='consumer-ev-v1')
 select jsonb_build_object(
 'offer',(select to_jsonb(o) from current_offer o),
 'readings',coalesce((select jsonb_agg(r order by slot) from public.meter_readings r where owner_id=auth.uid() and offer_id in(select id from current_offer)),'[]'::jsonb),
 'verification',(select to_jsonb(v) from public.verifications v where owner_id=auth.uid() and offer_id in(select id from current_offer)),
 'rewards',coalesce((select jsonb_agg(r order by created_at desc) from public.reward_ledger r where owner_id=auth.uid() and offer_id in(select id from current_offer)),'[]'::jsonb),
 'notifications',coalesce((select jsonb_agg(n order by created_at desc) from public.consumer_notifications n where owner_id=auth.uid()),'[]'::jsonb));
$$;
notify pgrst, 'reload schema';
