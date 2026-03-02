create extension if not exists "pgcrypto";

create table if not exists public.todos (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.todos enable row level security;

create policy "Allow read for anon"
  on public.todos
  for select
  to anon
  using (true);

create policy "Allow insert for anon"
  on public.todos
  for insert
  to anon
  with check (true);

create policy "Allow update for anon"
  on public.todos
  for update
  to anon
  using (true)
  with check (true);

create policy "Allow delete for anon"
  on public.todos
  for delete
  to anon
  using (true);

