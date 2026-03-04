# Hosting Project App

Dashboard application for managing hosting accounts, files, to-do tasks, and users. Built with Next.js 15, Supabase, and shadcn/ui.

## Features

- **Login** – Username + Password (Supabase Auth)
- **Dashboard** – Stats cards (Files, Active To-Do, Completed, Accounts)
- **Files** – Google Drive–like file manager (upload, folders, rename, download)
- **To-Do** – Tasks with To Do / Done tabs
- **Accounts** – Store hosting credentials (Link, Username or E-mail, Password)
- **Users** – Add/delete users with roles (admin, editor, viewer)

## Setup

### 1. Clone and install

```bash
git clone https://github.com/NaveenDA/shadcn-nextjs-dashboard.git .
npm install
```

### 2. Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. In SQL Editor, run the migration from `supabase/migrations/20240304000001_initial_schema.sql` (creates tables, RLS, storage bucket `files`, and storage policies)
3. If the storage section fails, create a Storage bucket named `files` (private) manually in the Supabase dashboard
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

## Tech Stack

- Next.js 15 (App Router)
- React 19, TypeScript
- Supabase (Auth, PostgreSQL, Storage)
- shadcn/ui, Tailwind CSS
