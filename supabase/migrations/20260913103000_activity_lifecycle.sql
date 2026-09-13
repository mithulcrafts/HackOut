-- Allow participants to pause an activity without deleting its history.
-- The API still prevents pausing/removing an accepted activity or one with evidence.
alter table public.activities drop constraint if exists activities_status_check;
alter table public.activities add constraint activities_status_check
  check (status in ('recommended','accepted','skipped','completed','verified','failed','paused'));
notify pgrst, 'reload schema';
