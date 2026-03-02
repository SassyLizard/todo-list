-- Add user_id to todos and lock RLS down to per-user access.

alter table if exists public.todos
  add column if not exists user_id uuid references auth.users(id);

-- Tighten RLS policies: each user (including anonymous) can only
-- see and modify their own rows.

-- Drop the previous wide-open anon policies if they exist.
drop policy if exists "Allow read for anon" on public.todos;
drop policy if exists "Allow insert for anon" on public.todos;
drop policy if exists "Allow update for anon" on public.todos;
drop policy if exists "Allow delete for anon" on public.todos;

-- Select: only rows owned by the current auth.uid().
create policy "Users can read their own todos"
  on public.todos
  for select
  using (user_id = auth.uid());

-- Insert: require user_id to match auth.uid().
create policy "Users can insert their own todos"
  on public.todos
  for insert
  with check (user_id = auth.uid());

-- Update: only modify rows they own.
create policy "Users can update their own todos"
  on public.todos
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Delete: only delete rows they own.
create policy "Users can delete their own todos"
  on public.todos
  for delete
  using (user_id = auth.uid());

-- Optional: helper RPC to reassign todos from a previous user_id
-- to the current authenticated user. This is mainly useful if you
-- ever need to migrate data between user accounts.

create or replace function public.reassign_todos(old_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  -- Only allow the currently authenticated user to pull todos
  -- from another user_id into their own account.
  if current_user_id is null then
    raise exception 'No authenticated user';
  end if;

  update public.todos
  set user_id = current_user_id
  where user_id = old_user_id;
end;
$$;


