-- Do not assume a deployment location. Users provide their own city or region.
alter table public.profiles alter column location set default '';
