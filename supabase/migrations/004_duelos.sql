-- Modo online — Fase B: duelo 1v1 ASSÍNCRONO e DETERMINÍSTICO (sem aposta de CoinPoints ainda).
-- O resultado é função pura de (snapshotA, snapshotB, seed): revalidável no servidor depois.

-- ── Snapshot de combate publicado por cada jogador, pra outros enfrentarem ──
create table if not exists public.duel_snapshots (
  user_id uuid primary key references auth.users (id) on delete cascade,
  nick text not null,
  poder integer not null default 0,
  snapshot jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.duel_snapshots enable row level security;
grant select, insert, update on public.duel_snapshots to authenticated;

-- todos logados LEEM todos os snapshots (achar adversário / leaderboard)...
drop policy if exists "duel_snap: ler todos" on public.duel_snapshots;
create policy "duel_snap: ler todos" on public.duel_snapshots
  for select to authenticated using (true);
-- ...mas cada um só cria/edita o PRÓPRIO
drop policy if exists "duel_snap: criar o proprio" on public.duel_snapshots;
create policy "duel_snap: criar o proprio" on public.duel_snapshots
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "duel_snap: editar o proprio" on public.duel_snapshots;
create policy "duel_snap: editar o proprio" on public.duel_snapshots
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Registro de duelos = FONTE DA VERDADE do placar ──
create table if not exists public.duelos (
  id uuid primary key default gen_random_uuid(),
  desafiante uuid not null references auth.users (id) on delete cascade,
  oponente uuid not null references auth.users (id) on delete cascade,
  desafiante_nick text not null,
  oponente_nick text not null,
  seed bigint not null,
  vencedor uuid not null,
  resultado jsonb not null,
  criado_at timestamptz not null default now()
);

alter table public.duelos enable row level security;
grant select, insert on public.duelos to authenticated;

-- todos logados leem (histórico + ranking); só o DESAFIANTE cria (registrando a si mesmo)
drop policy if exists "duelos: ler todos" on public.duelos;
create policy "duelos: ler todos" on public.duelos
  for select to authenticated using (true);
drop policy if exists "duelos: criar como desafiante" on public.duelos;
create policy "duelos: criar como desafiante" on public.duelos
  for insert to authenticated with check (auth.uid() = desafiante);

create index if not exists duelos_desafiante_idx on public.duelos (desafiante);
create index if not exists duelos_oponente_idx on public.duelos (oponente);

-- ── Ranking agregado (vitórias/jogos por jogador). Bases são públicas => sem vazamento ──
create or replace view public.ranking_duelos as
select
  s.user_id,
  s.nick,
  s.poder,
  count(*) filter (where d.vencedor = s.user_id) as vitorias,
  count(d.id) as jogos
from public.duel_snapshots s
left join public.duelos d on d.desafiante = s.user_id or d.oponente = s.user_id
group by s.user_id, s.nick, s.poder;

grant select on public.ranking_duelos to authenticated;
