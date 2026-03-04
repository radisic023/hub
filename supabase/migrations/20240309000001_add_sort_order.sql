-- Add sort_order to apis, machines, accounts for custom ordering
alter table public.apis add column if not exists sort_order integer not null default 0;
alter table public.machines add column if not exists sort_order integer not null default 0;
alter table public.accounts add column if not exists sort_order integer not null default 0;
