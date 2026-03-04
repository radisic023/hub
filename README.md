# Radisic Storage / Hub

Dashboard application for managing files, to-do tasks, accounts, machines, APIs, and users. Built with Next.js 15, Supabase, and shadcn/ui.

## Features

- **Login** – Username + Password (Supabase Auth)
- **Dashboard** – Stats cards (Files, To-Do, Accounts)
- **Files** – Google Drive–like file manager (upload, folders, rename, download, preview)
- **To-Do** – Tasks with To Do / Done tabs
- **Accounts** – Store hosting credentials with icon upload
- **Machines** – Server/host credentials
- **APIs** – Store API keys and snippets
- **Users** – Add/delete users with roles (admin, editor, viewer)
- **Settings** – Site title, description, favicon, SEO banner

## Setup

### 1. Clone and install

```bash
git clone https://github.com/radisic023/hub.git .
npm install
```

### 2. Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. In SQL Editor, run migrations in order: `supabase/migrations/00000000000000_full_schema.sql`, then `20240308000001_site_settings.sql`
3. Create Storage bucket named `files` (private) in Supabase dashboard
4. Copy your project URL and keys from Settings → API

### 3. Environment

Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
ENCRYPTION_SECRET=your_32_char_secret_for_passwords
```

### 4. Seed admin user

```bash
npm run db:seed
```

This creates:
- **Username:** rade023  
- **Password:** nikola99  
- **Email:** radisic00@gmail.com  
- **Name:** Nikola Radisic  
- **Role:** admin  

### 5. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and log in with `rade023` / `nikola99`.

## Deploy to Vercel

1. Push code to [GitHub](https://github.com/radisic023/hub)
2. Go to [vercel.com](https://vercel.com) → Import Project → Select `radisic023/hub`
3. Add Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ENCRYPTION_SECRET` (32+ chars)
4. Deploy

## Tech Stack

- Next.js 15 (App Router)
- React 19, TypeScript
- Supabase (Auth, PostgreSQL, Storage)
- shadcn/ui, Tailwind CSS
