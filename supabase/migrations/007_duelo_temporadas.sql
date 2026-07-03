-- Temporadas do duelo: rating auto-reportado (elo-lite) + temporada nos duelos.
-- A temporada é derivada da DATA REAL no cliente (ciclos de 3 semanas) — o servidor
-- só armazena. Validação server-side = TODO da rodada de monetização.

alter table public.duel_snapshots add column if not exists rating integer not null default 1000;
alter table public.duel_snapshots add column if not exists temporada_rating integer not null default 1;
alter table public.duelos add column if not exists temporada integer not null default 1;

create index if not exists duelos_temporada_idx on public.duelos (temporada, criado_at desc);
create index if not exists duel_snapshots_rating_idx on public.duel_snapshots (rating desc);

-- (RLS das tabelas já cobre as colunas novas: leitura pública autenticada,
--  escrita só na própria linha.)
