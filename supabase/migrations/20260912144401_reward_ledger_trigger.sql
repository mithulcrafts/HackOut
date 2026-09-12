-- Explicit simulation-only commands; never accepts caller-supplied energy or points.
create function public.consumer_snapshot() returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
 'offer',(select to_jsonb(o) from public.offers o where owner_id=auth.uid() and fixture_key='consumer-ev-v1'),
 'readings',coalesce((select jsonb_agg(r order by slot) from public.meter_readings r where owner_id=auth.uid()),'[]'::jsonb),
 'verification',(select to_jsonb(v) from public.verifications v where owner_id=auth.uid() limit 1),
 'rewards',coalesce((select jsonb_agg(r order by created_at desc) from public.reward_ledger r where owner_id=auth.uid()),'[]'::jsonb),
 'notifications',coalesce((select jsonb_agg(n order by created_at desc) from public.consumer_notifications n where owner_id=auth.uid()),'[]'::jsonb));
$$;
revoke all on function public.consumer_snapshot() from public;
grant execute on function public.consumer_snapshot() to authenticated;

create function public.consumer_action(command text,target_offer uuid default null,expected_version integer default null,start_slot integer default null,outcome text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); o public.offers; aid uuid; vid uuid; k integer; run_start integer; energy numeric:=0; step_energy numeric; accepted_energy numeric:=0; baseline_energy numeric:=0; total_energy numeric:=0; eligible numeric:=0; result text; why text;
begin
 if u is null then raise exception 'Sign in required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtext(u::text));
 select * into o from public.offers where owner_id=u and fixture_key='consumer-ev-v1' for update;
 if command='seed' then
  if o.id is null then
   insert into public.activities(owner_id,type,name,earliest_start,latest_finish,duration_minutes,interruptible) values(u,'EV charging','Demo EV charging','13:00','17:00',120,true) returning id into aid;
   insert into public.offers(owner_id,activity_id) values(u,aid) returning * into o;
   insert into public.consumer_notifications(owner_id,offer_id,message) values(u,o.id,'A simulated EV offer is ready. Accept, modify or skip it.');
  end if;
  return public.consumer_snapshot();
 end if;
 if o.id is null or target_offer is distinct from o.id then raise exception 'Offer not found' using errcode='P0002'; end if;
 if command='verify' and exists(select 1 from public.verifications where offer_id=o.id) then return public.consumer_snapshot(); end if;
 if expected_version is distinct from o.version then raise exception 'Offer changed. Refresh before trying again.' using errcode='40001'; end if;
 if command='reset' then
  delete from public.offers where id=o.id;
  delete from public.activities where id=o.activity_id and owner_id=u;
  return public.consumer_action('seed');
 elsif command in ('accept','skip','modify') then
  if o.decision<>'pending' then raise exception 'Only pending offers can be changed'; end if;
  if command='modify' then
   if start_slot is null or start_slot not between 26 and 28 then raise exception 'Choose 13:00, 13:30 or 14:00 in this fixture'; end if;
   update public.offers set proposed_start=start_slot,version=version+1 where id=o.id;
  else
   update public.offers set decision=case when command='accept' then 'accepted' else 'skipped' end,version=version+1 where id=o.id;
  end if;
  insert into public.consumer_notifications(owner_id,offer_id,message) values(u,o.id,case command when 'accept' then 'Offer accepted. Your departure deadline remains 17:00.' when 'skip' then 'Offer skipped. No penalty or points deducted.' else 'Offer window modified. Review and accept when ready.' end);
 elsif command='override' then
  if o.decision<>'accepted' or o.simulation_run then raise exception 'Override before running the simulation'; end if;
  update public.offers set decision='overridden',version=version+1 where id=o.id;
  insert into public.consumer_notifications(owner_id,offer_id,message) values(u,o.id,'Schedule overridden without penalty. Operator recovery is pending scheduler integration.');
 elsif command='simulate' then
  if o.decision<>'accepted' or o.simulation_run then raise exception 'Accept an offer first; reset before running another outcome'; end if;
  if outcome is null or outcome not in ('success','partial','missing','late','rebound') then raise exception 'Unknown simulation outcome'; end if;
  run_start:=case when outcome='late' then 34 else o.proposed_start end;
  if outcome<>'missing' then
   insert into public.meter_readings(owner_id,offer_id,slot,cumulative_kwh) values(u,o.id,0,0);
   for k in 0..47 loop
    step_energy:=case when k>=run_start and k<run_start+o.duration_slots then case when outcome='partial' then 1 else 2 end else 0 end;
    if outcome='rebound' and k>=o.baseline_start and k<o.baseline_start+o.duration_slots then step_energy:=step_energy+2; end if;
    energy:=energy+step_energy;
    insert into public.meter_readings(owner_id,offer_id,slot,cumulative_kwh) values(u,o.id,k+1,energy);
   end loop;
  end if;
  update public.offers set simulation_run=true,completion_slot=case when outcome in ('missing','partial') then null else run_start+duration_slots end,version=version+1 where id=o.id;
  insert into public.consumer_notifications(owner_id,offer_id,message) values(u,o.id,'Simulated meter outcome recorded: '||outcome||'. Verification is ready.');
 elsif command='verify' then
  if o.decision<>'accepted' or not o.simulation_run then raise exception 'Accept the offer and run the meter simulation first'; end if;
  if (select count(*) from public.meter_readings where offer_id=o.id)<>49 then
   result:='failed'; why:='Missing readings: no energy or completion claim can be verified.';
  else
   select max(cumulative_kwh)-min(cumulative_kwh) into total_energy from public.meter_readings where offer_id=o.id;
   select max(cumulative_kwh)-min(cumulative_kwh) into accepted_energy from public.meter_readings where offer_id=o.id and slot between o.proposed_start and o.proposed_start+o.duration_slots;
   select max(cumulative_kwh)-min(cumulative_kwh) into baseline_energy from public.meter_readings where offer_id=o.id and slot between o.baseline_start and o.baseline_start+o.duration_slots;
   if total_energy>o.required_kwh*1.05 then result:='failed'; why:='Additional consumption detected. No reward for rebound energy.';
   elsif o.completion_slot>o.deadline_slot then result:='failed'; why:='Completion was after the agreed deadline.';
   elsif accepted_energy<o.required_kwh*.95 or o.completion_slot is null then result:='partial'; why:='Incomplete task or insufficient energy within the accepted window.';
   else
    eligible:=greatest(0,least(o.required_kwh,accepted_energy,o.required_kwh-baseline_energy));
    if eligible>0 then result:='verified'; why:='Accepted window, completion, deadline and frozen baseline passed.';
    else result:='failed'; why:='No eligible shift from the frozen baseline.'; end if;
   end if;
  end if;
  insert into public.verifications(owner_id,offer_id,status,reason,recorded_kwh,eligible_kwh,baseline_kwh) values(u,o.id,result,why,total_energy,eligible,baseline_energy) returning id into vid;
  if result='verified' then
   insert into public.reward_ledger(owner_id,offer_id,verification_id,points,illustrative_rupees) values(u,o.id,vid,least(120,floor(eligible*15)::integer),least(12,round(eligible*1.5,2)));
  end if;
  update public.activities set status=case when result='verified' then 'verified' else 'failed' end where id=o.activity_id;
  update public.offers set version=version+1 where id=o.id;
  insert into public.consumer_notifications(owner_id,offer_id,message) values(u,o.id,'Verification: '||result||'. '||why);
 else raise exception 'Unknown action';
 end if;
 return public.consumer_snapshot();
end; $$;
revoke all on function public.consumer_action(text,uuid,integer,integer,text) from public;
grant execute on function public.consumer_action(text,uuid,integer,integer,text) to authenticated;
