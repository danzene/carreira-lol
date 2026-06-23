-- Carreira LoL — saves na nuvem, isolados por usuário.
-- Rode no Supabase: SQL Editor → New query → cole tudo → Run.

create table if not exists public.user_saves (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_saves enable row level security;

-- Cada usuário só acessa a própria linha.
create policy "user_saves_select_own" on public.user_saves
  for select using (auth.uid() = user_id);

create policy "user_saves_insert_own" on public.user_saves
  for insert with check (auth.uid() = user_id);

create policy "user_saves_update_own" on public.user_saves
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
