-- Optional consumer onboarding preferences. Existing profiles keep safe defaults.
alter table public.profiles add column if not exists reminder_channel text not null default 'in_app';
alter table public.profiles add column if not exists reminder_frequency text not null default 'all';
alter table public.profiles add column if not exists reward_program_opt_in boolean not null default true;
alter table public.profiles add column if not exists programme_name text not null default 'Demo renewable flexibility programme';
alter table public.profiles add column if not exists site_name text not null default 'Gandhinagar participant site';
alter table public.profiles drop constraint if exists profiles_reminder_channel_check;
alter table public.profiles add constraint profiles_reminder_channel_check check (reminder_channel in ('in_app','email_sms','important_only','none'));
alter table public.profiles drop constraint if exists profiles_reminder_frequency_check;
alter table public.profiles add constraint profiles_reminder_frequency_check check (reminder_frequency in ('all','important','quiet_hours'));
notify pgrst, 'reload schema';
