-- Modo online — Fase A: perfis de conta.
-- CoinPoints é POR CONTA e só muda por função no servidor (à prova de trapaça).

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nick text unique,
  avatar_frame text,
  coinpoints integer not null default 0 check (coinpoints >= 0),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- privilégios base (gated por RLS abaixo)
grant select, insert, update on public.profiles to authenticated;

-- cada um só enxerga/cria/edita o PRÓPRIO perfil
drop policy if exists "perfil: ler o proprio" on public.profiles;
create policy "perfil: ler o proprio" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "perfil: criar o proprio" on public.profiles;
create policy "perfil: criar o proprio" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "perfil: editar o proprio" on public.profiles;
create policy "perfil: editar o proprio" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- o cliente NÃO pode definir/alterar o saldo direto (só nick/avatar)
revoke insert (coinpoints) on public.profiles from authenticated;
revoke update (coinpoints) on public.profiles from authenticated;

-- saldo só muda por esta função (valida e nunca deixa negativo)
create or replace function public.ajustar_coinpoints(delta integer, motivo text default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare novo integer;
begin
  update public.profiles
     set coinpoints = coinpoints + delta
   where id = auth.uid() and coinpoints + delta >= 0
   returning coinpoints into novo;
  if novo is null then
    raise exception 'saldo insuficiente ou perfil inexistente';
  end if;
  return novo;
end;
$$;

grant execute on function public.ajustar_coinpoints(integer, text) to authenticated;
