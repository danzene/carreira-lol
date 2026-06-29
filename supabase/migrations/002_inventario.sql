-- Modo online — inventário RPG por conta.
-- Guarda os itens e o que está equipado (jsonb), por usuário. RLS: cada um só o seu.

create table if not exists public.inventario (
  user_id uuid primary key references auth.users (id) on delete cascade,
  itens jsonb not null default '[]'::jsonb,
  equipado jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.inventario enable row level security;

grant select, insert, update on public.inventario to authenticated;

drop policy if exists "inv: ler o proprio" on public.inventario;
create policy "inv: ler o proprio" on public.inventario
  for select using (auth.uid() = user_id);

drop policy if exists "inv: criar o proprio" on public.inventario;
create policy "inv: criar o proprio" on public.inventario
  for insert with check (auth.uid() = user_id);

drop policy if exists "inv: editar o proprio" on public.inventario;
create policy "inv: editar o proprio" on public.inventario
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
