alter table public.activities drop constraint if exists activities_type_check;
alter table public.activities add constraint activities_type_check check (char_length(type) between 1 and 40);
