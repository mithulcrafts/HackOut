-- Allow each saved activity to have its own demand-response offer.
-- Keep UNIQUE(owner_id, fixture_key): ON CONFLICT below needs it.
-- Each activity uses a distinct consumer-<activity UUID> key, so the
-- constraint permits multiple activities while keeping offer retries safe.

create or replace function public.create_consumer_offer(target_activity uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); a public.activities; s integer; f integer; d integer; proposed integer;
o public.offers;
begin
 if u is null then raise exception 'Sign in required' using errcode='42501'; end if;
 select * into a from public.activities where id=target_activity and owner_id=u;
 if a.id is null then raise exception 'Activity not found' using errcode='P0002'; end if;
 s:=extract(hour from a.earliest_start)::integer*2 + extract(minute from a.earliest_start)::integer/30;
 f:=extract(hour from a.latest_finish)::integer*2 + extract(minute from a.latest_finish)::integer/30;
 d:=a.duration_minutes/30; proposed:=least(s+2,f-d);
 insert into public.offers(owner_id,activity_id,fixture_key,name,baseline_start,duration_slots,proposed_start,deadline_slot,required_kwh,power_kw)
 values(u,a.id,'consumer-'||a.id::text,a.name,s,d,proposed,f,coalesce(a.required_kwh,a.power_kw*a.duration_minutes/60),a.power_kw)
 on conflict (owner_id,fixture_key) do update set name=excluded.name
 returning * into o;
 insert into public.consumer_notifications(owner_id,offer_id,message) values(u,o.id,'A renewable-aligned window is available for '||a.name||'. Review the offer and choose what works.')
 on conflict do nothing;
 return to_jsonb(o);
end; $$;
revoke all on function public.create_consumer_offer(uuid) from public;
grant execute on function public.create_consumer_offer(uuid) to authenticated;

create or replace function public.consumer_snapshot() returns jsonb language sql stable security invoker set search_path='' as $$
 with current_offer as (select * from public.offers where owner_id=auth.uid() order by created_at desc limit 1)
 select jsonb_build_object(
 'offer',(select to_jsonb(o) from current_offer o),
 'readings',coalesce((select jsonb_agg(r order by slot) from public.meter_readings r where owner_id=auth.uid() and offer_id in(select id from current_offer)),'[]'::jsonb),
 'verification',(select to_jsonb(v) from public.verifications v where owner_id=auth.uid() and offer_id in(select id from current_offer)),
 'rewards',coalesce((select jsonb_agg(r order by created_at desc) from public.reward_ledger r where owner_id=auth.uid() and offer_id in(select id from current_offer)),'[]'::jsonb),
 'notifications',coalesce((select jsonb_agg(n order by created_at desc) from public.consumer_notifications n where owner_id=auth.uid()),'[]'::jsonb));
$$;
notify pgrst, 'reload schema';
