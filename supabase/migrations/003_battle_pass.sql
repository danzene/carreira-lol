-- Passe de Batalha por conta. Guarda o estado (nível/PP/missões/resgates) em jsonb.

create table if not exists public.battle_pass (
  user_id uuid primary key references auth.users (id) on delete cascade,
  estado jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.battle_pass enable row level security;

grant select, insert, update on public.battle_pass to authenticated;

drop policy if exists "passe: ler o proprio" on public.battle_pass;
create policy "passe: ler o proprio" on public.battle_pass
  for select using (auth.uid() = user_id);

drop policy if exists "passe: criar o proprio" on public.battle_pass;
create policy "passe: criar o proprio" on public.battle_pass
  for insert with check (auth.uid() = user_id);

drop policy if exists "passe: editar o proprio" on public.battle_pass;
create policy "passe: editar o proprio" on public.battle_pass
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
