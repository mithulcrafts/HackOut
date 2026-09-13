-- Per-activity reminder selection. An empty array means all saved activities.
alter table public.profiles
  add column if not exists reminder_activity_ids text[] not null default '{}';

comment on column public.profiles.reminder_activity_ids is
  'Activity IDs selected for routine reminders; empty means all activities.';
