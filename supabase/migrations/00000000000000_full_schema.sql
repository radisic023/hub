-- =============================================================================
-- Single consolidated migration (replaces all previous migrations)
-- =============================================================================

-- Profiles (extends Supabase auth.users)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  email text not null,
  first_name text not null,
  last_name text not null,
  role text not null default 'user' check (role in ('admin', 'editor', 'viewer')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Accounts (hosting accounts - link, username or email, password)
create table if not exists public.accounts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  link text not null,
  username text,
  email text,
  password_encrypted text not null,
  icon_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint accounts_username_or_email check (
    (username is not null and email is null) or
    (username is null and email is not null)
  )
);

-- Todo items
create table if not exists public.todo_items (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  title text not null,
  done boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Files metadata (folder structure, Supabase Storage holds actual files)
create table if not exists public.files_metadata (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  path text not null,
  is_folder boolean not null default false,
  folder_id uuid references public.files_metadata on delete cascade,
  size bigint default 0,
  mime_type text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Machines (servers - title, hostname, username, password, port)
create table if not exists public.machines (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  title text,
  hostname text not null,
  username text not null,
  password_encrypted text not null,
  port integer not null default 22,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- APIs (simple: name+code; header_body: name+header_code and/or body_code)
create table if not exists public.apis (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  type text not null check (type in ('simple', 'header_body')),
  code_encrypted text,
  header_code_encrypted text,
  body_code_encrypted text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint apis_code_by_type check (
    (type = 'simple' and code_encrypted is not null and header_code_encrypted is null and body_code_encrypted is null) or
    (type = 'header_body' and code_encrypted is null and (header_code_encrypted is not null or body_code_encrypted is not null))
  )
);

-- RLS
alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.todo_items enable row level security;
alter table public.files_metadata enable row level security;
alter table public.machines enable row level security;
alter table public.apis enable row level security;

-- Profiles
create policy "Users can read own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Allow insert for new users" on public.profiles for insert with check (auth.uid() = id);
create policy "Admins can read all profiles" on public.profiles for select using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- Accounts
create policy "Users can manage own accounts" on public.accounts for all using (auth.uid() = user_id);

-- Todo items
create policy "Users can manage own todos" on public.todo_items for all using (auth.uid() = user_id);

-- Files metadata
create policy "Users can manage own files" on public.files_metadata for all using (auth.uid() = user_id);

-- Machines
create policy "Users can manage own machines" on public.machines for all using (auth.uid() = user_id);

-- APIs
create policy "Users can manage own apis" on public.apis for all using (auth.uid() = user_id);

-- Storage bucket "files"
insert into storage.buckets (id, name, public)
values ('files', 'files', false)
on conflict (id) do nothing;

update storage.buckets set allowed_mime_types = null where id = 'files';

create policy "Users can upload to own folder" on storage.objects
  for insert with check (
    bucket_id = 'files' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "Users can read own files" on storage.objects
  for select using (
    bucket_id = 'files' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "Users can update own files" on storage.objects
  for update using (
    bucket_id = 'files' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "Users can delete own files" on storage.objects
  for delete using (
    bucket_id = 'files' and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Site settings (SEO, title, description, keywords, banner, favicon)
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

-- Optional: add columns if tables already exist from previous migrations
alter table public.accounts add column if not exists icon_url text;
alter table public.machines add column if not exists title text;
