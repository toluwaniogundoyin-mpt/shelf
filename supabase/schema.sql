-- Shelf database schema
-- Run this once in the Supabase SQL editor for your project.

create extension if not exists "pgcrypto";

-- One row per user: the Google refresh token used to call the Drive API
-- on their behalf. Never exposed to the browser — only read by server code.
create table public.user_google_tokens (
  user_id uuid primary key references auth.users (id) on delete cascade,
  refresh_token text not null,
  scope text not null,
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  color text,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table public.books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  author text,
  category_id uuid references public.categories (id) on delete set null,
  format text not null check (format in ('pdf', 'epub')),
  drive_file_id text not null,
  cover_url text,
  file_size_bytes bigint,
  added_at timestamptz not null default now(),
  finished_at timestamptz
);

create index books_user_id_idx on public.books (user_id);
create index books_category_id_idx on public.books (category_id);

-- One row per book: where the reader resumed to. `location` holds a page
-- number (PDF) or an EPUB CFI string (epub.js) depending on `books.format`.
create table public.reading_progress (
  book_id uuid primary key references public.books (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  location text,
  percent numeric(5, 2) not null default 0,
  updated_at timestamptz not null default now()
);

-- One row per reading session, used to roll up daily/weekly/monthly time
-- and to derive the streak calendar. A session is only written once it ends,
-- so there is no "currently open" row to reconcile.
create table public.reading_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  book_id uuid not null references public.books (id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  duration_seconds integer not null check (duration_seconds > 0)
);

create index reading_sessions_user_started_idx
  on public.reading_sessions (user_id, started_at);

-- Cached rollups so the dashboard doesn't recompute streaks from raw
-- sessions on every load. Recalculated server-side whenever a session ends.
create table public.user_stats (
  user_id uuid primary key references auth.users (id) on delete cascade,
  current_streak integer not null default 0,
  longest_streak integer not null default 0,
  last_read_date date,
  books_finished integer not null default 0,
  updated_at timestamptz not null default now()
);

-- Seed a user_stats row automatically so app code never has to special-case
-- a missing row for brand-new accounts.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.user_stats (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Row Level Security: every table is scoped to its owning user.
alter table public.user_google_tokens enable row level security;
alter table public.categories enable row level security;
alter table public.books enable row level security;
alter table public.reading_progress enable row level security;
alter table public.reading_sessions enable row level security;
alter table public.user_stats enable row level security;

create policy "own tokens" on public.user_google_tokens
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own categories" on public.categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own books" on public.books
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own reading progress" on public.reading_progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own reading sessions" on public.reading_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own stats" on public.user_stats
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
