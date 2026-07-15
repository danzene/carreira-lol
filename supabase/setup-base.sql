-- ============================================================================
-- SETUP BASE (tabelas do jogo) - Carreira LoL
-- Cole TUDO isto no Supabase (SQL Editor -> New query -> Run).
-- Rode ESTE primeiro; depois rode o setup-admin.sql (admin + metricas).
-- IDEMPOTENTE: pode re-rodar sem erro (create if not exists + drop policy if exists).
-- Migrations 001..009 + 022 (teto) + 023 (loja/pagamentos) + 025 (assinaturas).
-- ============================================================================


-- >>>>>>>>>>>>>>>>>>>> 001_profiles.sql >>>>>>>>>>>>>>>>>>>>
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


-- >>>>>>>>>>>>>>>>>>>> 001_user_saves.sql >>>>>>>>>>>>>>>>>>>>
-- Carreira LoL — saves na nuvem, isolados por usuário.
-- Rode no Supabase: SQL Editor → New query → cole tudo → Run.

create table if not exists public.user_saves (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_saves enable row level security;

-- Cada usuário só acessa a própria linha. (drop antes de create = idempotente)
drop policy if exists "user_saves_select_own" on public.user_saves;
create policy "user_saves_select_own" on public.user_saves
  for select using (auth.uid() = user_id);

drop policy if exists "user_saves_insert_own" on public.user_saves;
create policy "user_saves_insert_own" on public.user_saves
  for insert with check (auth.uid() = user_id);

drop policy if exists "user_saves_update_own" on public.user_saves;
create policy "user_saves_update_own" on public.user_saves
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- >>>>>>>>>>>>>>>>>>>> 002_inventario.sql >>>>>>>>>>>>>>>>>>>>
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


-- >>>>>>>>>>>>>>>>>>>> 003_battle_pass.sql >>>>>>>>>>>>>>>>>>>>
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


-- >>>>>>>>>>>>>>>>>>>> 004_duelos.sql >>>>>>>>>>>>>>>>>>>>
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


-- >>>>>>>>>>>>>>>>>>>> 005_telemetria.sql >>>>>>>>>>>>>>>>>>>>
-- Telemetria mínima: enxergar onde os jogadores param. Sem PII além do user_id.
-- O cliente SÓ INSERE as próprias linhas — nunca lê (nem as suas): análise é pelo SQL Editor.

create table if not exists public.telemetria_eventos (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  evento text not null,
  props jsonb not null default '{}'::jsonb,
  client_ts timestamptz,
  created_at timestamptz not null default now()
);

alter table public.telemetria_eventos enable row level security;

-- só INSERT (nenhum select/update/delete pro cliente)
grant insert on public.telemetria_eventos to authenticated;

drop policy if exists "telemetria: inserir o proprio" on public.telemetria_eventos;
create policy "telemetria: inserir o proprio" on public.telemetria_eventos
  for insert to authenticated with check (auth.uid() = user_id);

create index if not exists telemetria_evento_idx on public.telemetria_eventos (evento, created_at);
create index if not exists telemetria_user_idx on public.telemetria_eventos (user_id, created_at);


-- >>>>>>>>>>>>>>>>>>>> 006_prova.sql >>>>>>>>>>>>>>>>>>>>
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


-- >>>>>>>>>>>>>>>>>>>> 007_duelo_temporadas.sql >>>>>>>>>>>>>>>>>>>>
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


-- >>>>>>>>>>>>>>>>>>>> 008_drop_ranking_duelos.sql >>>>>>>>>>>>>>>>>>>>
-- Fix do Security Advisor (CRITICAL): a view `ranking_duelos` era SECURITY DEFINER —
-- rodava com as permissões do criador, ignorando o RLS de quem consulta.
-- Ela ficou ÓRFÃ desde as temporadas do duelo (o ranking agora vem de
-- duel_snapshots.rating, com RLS normal). Remover resolve o alerta e limpa o schema.

drop view if exists public.ranking_duelos;


-- >>>>>>>>>>>>>>>>>>>> 009_harden_funcoes.sql >>>>>>>>>>>>>>>>>>>>
-- Hardening do Security Advisor: funções SECURITY DEFINER não podem ser executáveis
-- por anon/public (por default o Postgres dá EXECUTE a PUBLIC em toda função).

-- ajustar_coinpoints: SÓ usuários logados (o fluxo autoritativo da moeda exige
-- authenticated — o warning "signed-in can execute" é o débito CONHECIDO da rodada
-- de monetização: mover a concessão pra Edge Function antes de dinheiro real).
revoke execute on function public.ajustar_coinpoints(integer, text) from public;
revoke execute on function public.ajustar_coinpoints(integer, text) from anon;
grant execute on function public.ajustar_coinpoints(integer, text) to authenticated;

-- rls_auto_enable: helper interno — NINGUÉM precisa executar manualmente.
revoke execute on function public.rls_auto_enable() from public;
revoke execute on function public.rls_auto_enable() from anon;
revoke execute on function public.rls_auto_enable() from authenticated;


-- >>>>>>>>>>>>>>>>>>>> 022_coinpoints_cap.sql >>>>>>>>>>>>>>>>>>>>
-- 🛡️ Blindagem leve dos CoinPoints (pré-lançamento). A função é chamada pelo CLIENTE,
-- então um jogador poderia pedir `ajustar_coinpoints(delta => 999999)` no console e se
-- dar moeda infinita. Até a economia virar 100% server-authoritative (rodada dedicada,
-- antes de ligar pagamento), pomos um TETO por chamada nos CRÉDITOS:
--
--  • crédito (delta > 0): no máximo LIMITE por chamada (cobre todas as fontes legítimas —
--    a maior é a recompensa premium do passe, 600). O "milhão instantâneo" morre; quem
--    insistir em loopar aparece no detector de anomalias do admin (telemetria coinpoints).
--  • débito (delta <= 0): livre, mas o saldo nunca fica negativo (como já era).
--
-- Rode no Supabase: SQL Editor → cole → Run. Substitui a função de 001_profiles.

create or replace function public.ajustar_coinpoints(delta integer, motivo text default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  novo integer;
  limite constant integer := 700; -- teto de crédito por chamada (maior fonte legítima = 600)
begin
  if delta > limite then
    raise exception 'credito_acima_do_limite';
  end if;
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


-- >>>>>>>>>>>>>>>>>>>> 023_loja_pagamentos.sql >>>>>>>>>>>>>>>>>>>>
-- 💳 Loja de pagamentos (Mercado Pago / Pix) — tudo server-authoritative.
-- O cliente NUNCA credita moeda comprada nem liga o premium: quem faz isso é o
-- servidor (service_role) DEPOIS que o webhook do Mercado Pago confirma o pagamento.
-- Rode no Supabase: SQL Editor → New query → cole → Run. Idempotente.

-- ── Pedidos: a fonte da verdade de cada compra ──────────────────────────────
create table if not exists public.pedidos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  produto text not null,                 -- chave do catálogo (lib/produtos.ts)
  valor_centavos integer not null check (valor_centavos > 0),
  moedas integer not null default 0 check (moedas >= 0),
  concede_passe boolean not null default false,
  status text not null default 'pendente'
    check (status in ('pendente','aprovado','expirado','cancelado','erro')),
  mp_payment_id text unique,             -- id do pagamento no Mercado Pago (idempotência)
  creditado_at timestamptz,              -- trava: crédito acontece UMA vez só
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.pedidos enable row level security;

-- o cliente SÓ LÊ os próprios pedidos (pra saber se o Pix caiu — polling do QR).
-- NUNCA escreve: criação e mudança de status são do servidor (service_role ignora RLS).
grant select on public.pedidos to authenticated;

drop policy if exists "pedidos: ler os proprios" on public.pedidos;
create policy "pedidos: ler os proprios" on public.pedidos
  for select to authenticated using (auth.uid() = user_id);

create index if not exists pedidos_user_idx on public.pedidos (user_id, created_at desc);
create index if not exists pedidos_mp_idx on public.pedidos (mp_payment_id);
create index if not exists pedidos_status_idx on public.pedidos (status, created_at desc);

-- ── Passe premium AUTORITATIVO ──────────────────────────────────────────────
-- Hoje o premium mora no jsonb `estado` (que o cliente sobrescreve no upsert →
-- burlável). Passa a morar numa COLUNA que só o servidor liga. O cliente lê no
-- load, mas o UPDATE dessa coluna é revogado (o upsert dele nunca a inclui).
alter table public.battle_pass add column if not exists premium boolean not null default false;
revoke update (premium) on public.battle_pass from authenticated;

-- ── Crédito da compra (SÓ service_role, chamado pelo webhook) ────────────────
-- Incrementa moedas de forma ATÔMICA (evita lost-update se duas compras caírem
-- juntas) e liga o premium. NUNCA exposto ao cliente (auth/anon revogados).
create or replace function public.creditar_compra(p_user_id uuid, p_moedas integer, p_premium boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_moedas > 0 then
    update public.profiles set coinpoints = coinpoints + p_moedas where id = p_user_id;
  end if;
  if p_premium then
    insert into public.battle_pass (user_id, premium) values (p_user_id, true)
      on conflict (user_id) do update set premium = true;
  end if;
end;
$$;
revoke execute on function public.creditar_compra(uuid, integer, boolean) from public;
revoke execute on function public.creditar_compra(uuid, integer, boolean) from anon;
revoke execute on function public.creditar_compra(uuid, integer, boolean) from authenticated;
grant execute on function public.creditar_compra(uuid, integer, boolean) to service_role;


-- >>>>>>>>>>>>>>>>>>>> 025_assinaturas.sql >>>>>>>>>>>>>>>>>>>>
-- 🔁 Assinatura recorrente do Passe Premium (cartão via Mercado Pago PreApproval).
-- Cobra R$9,90/mês até cancelar. O premium passa a ter VALIDADE: fica ativo enquanto
-- a assinatura paga; quando não renova (cancelou/falhou), expira sozinho.
-- Rode no Supabase: SQL Editor → cole → Run. Idempotente.

create table if not exists public.assinaturas (
  user_id uuid primary key references auth.users (id) on delete cascade,
  mp_preapproval_id text unique,
  status text not null default 'pendente',   -- pendente|autorizada|pausada|cancelada
  proximo_pagamento timestamptz,
  valor_centavos integer not null default 990,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.assinaturas enable row level security;

-- o cliente só LÊ a própria (pra mostrar status/data). Escrita é do servidor.
grant select on public.assinaturas to authenticated;

drop policy if exists "assinaturas: ler a propria" on public.assinaturas;
create policy "assinaturas: ler a propria" on public.assinaturas
  for select to authenticated using (auth.uid() = user_id);

-- premium com VALIDADE: ativo enquanto now() < premium_ate. Só o servidor escreve.
alter table public.battle_pass add column if not exists premium_ate timestamptz;
revoke update (premium_ate) on public.battle_pass from authenticated;

-- ativa/estende o premium até p_ate (SÓ service_role, chamado pelo webhook).
create or replace function public.ativar_premium(p_user_id uuid, p_ate timestamptz)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.battle_pass (user_id, premium_ate) values (p_user_id, p_ate)
    on conflict (user_id) do update set premium_ate = excluded.premium_ate;
end;
$$;
revoke execute on function public.ativar_premium(uuid, timestamptz) from public;
revoke execute on function public.ativar_premium(uuid, timestamptz) from anon;
revoke execute on function public.ativar_premium(uuid, timestamptz) from authenticated;
grant execute on function public.ativar_premium(uuid, timestamptz) to service_role;

