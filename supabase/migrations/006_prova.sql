-- Prova Semanal: leaderboard global. Score é AUTO-REPORTADO nesta versão — o campo
-- `detalhe` guarda seed/modificadores/resultados/snapshot resumido pra REVALIDAÇÃO
-- futura por Edge Function (TODO da rodada de monetização).

create table if not exists public.prova_semanal_scores (
  user_id uuid not null references auth.users (id) on delete cascade,
  semana integer not null, -- semana ISO (ano*100+semana)
  nick text not null,
  score integer not null,
  detalhe jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (user_id, semana)
);

alter table public.prova_semanal_scores enable row level security;
grant select, insert, update on public.prova_semanal_scores to authenticated;

-- todos leem (leaderboard); cada um só escreve a própria linha
drop policy if exists "prova: ler todos" on public.prova_semanal_scores;
create policy "prova: ler todos" on public.prova_semanal_scores
  for select to authenticated using (true);
drop policy if exists "prova: inserir o proprio" on public.prova_semanal_scores;
create policy "prova: inserir o proprio" on public.prova_semanal_scores
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "prova: editar o proprio" on public.prova_semanal_scores;
create policy "prova: editar o proprio" on public.prova_semanal_scores
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists prova_semana_score_idx on public.prova_semanal_scores (semana, score desc);
