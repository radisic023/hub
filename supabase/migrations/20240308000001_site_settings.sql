-- Site settings (SEO, title, description, keywords, banner, favicon)
-- One row per user (or singleton for site-wide - using user_id for RLS)
create table if not exists public.site_settings (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null unique,
  title text,
  description text,
  keywords text,
  seo_banner_path text,
  favicon_path text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.site_settings enable row level security;

create policy "Users can manage own site settings" on public.site_settings
  for all using (auth.uid() = user_id);
