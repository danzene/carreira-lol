-- 🛠️ Painel Admin — Fase 0: papel de admin, auditoria, config de live-ops e a
-- primeira função de agregação (sanidade). TUDO em UTC no banco.
--
-- SEGURANÇA: as funções de agregação são chamadas pelo servidor com a SERVICE ROLE
-- (bypassa RLS) SÓ depois do requireAdmin() verificar o papel. Por garantia extra,
-- revogamos EXECUTE de anon/authenticated nelas (só service_role chama).

-- ---- papel de admin + colunas de suporte no profiles ----
alter table public.profiles add column if not exists role text not null default 'player';
alter table public.profiles add column if not exists banned_at timestamptz;
alter table public.profiles add column if not exists flagged_at timestamptz;

-- o jogador NUNCA muda o proprio papel/ban/flag (so o servidor via service role)
revoke update (role) on public.profiles from authenticated;
revoke update (banned_at) on public.profiles from authenticated;
revoke update (flagged_at) on public.profiles from authenticated;

-- helper: este uid é admin?
create or replace function public.is_admin(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = uid and role = 'admin');
$$;
revoke execute on function public.is_admin(uuid) from public;

-- ---- auditoria: TODA acao administrativa loga aqui ----
create table if not exists public.admin_audit_log (
  id bigint generated always as identity primary key,
  admin_id uuid not null references auth.users (id) on delete set null,
  acao text not null,
  alvo_user_id uuid,
  detalhe jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.admin_audit_log enable row level security;
-- sem policies pra authenticated/anon: só a service role (que bypassa RLS) lê/escreve.
create index if not exists audit_created_idx on public.admin_audit_log (created_at desc);
create index if not exists audit_alvo_idx on public.admin_audit_log (alvo_user_id, created_at desc);

-- ---- live-ops: config chave/valor (mensagem do dia + feature flags) ----
create table if not exists public.app_config (
  chave text primary key,
  valor jsonb not null default '{}'::jsonb,
  publica boolean not null default false, -- chaves publicas o jogo le com a anon key
  updated_at timestamptz not null default now()
);
alter table public.app_config enable row level security;
grant select on public.app_config to authenticated, anon;
-- o jogo (logado ou nao) le SÓ as chaves publicas; escrita e só via service role.
drop policy if exists "config: ler publicas" on public.app_config;
create policy "config: ler publicas" on public.app_config
  for select to authenticated, anon using (publica = true);

-- defaults de live-ops (fail-open: ausencia = tudo ligado no jogo)
insert into public.app_config (chave, valor, publica) values
  ('feature_flags', '{"duelo_online":true,"prova_semanal":true,"gacha":true,"compartilhamento":true}'::jsonb, true),
  ('mensagem_do_dia', '{"ativo":false}'::jsonb, true)
on conflict (chave) do nothing;

-- índices de telemetria pra funis (evento+user). Os (evento,created_at) e
-- (user_id,created_at) já existem da migration 005.
create index if not exists telemetria_ev_user_idx on public.telemetria_eventos (evento, user_id, created_at);

-- ---- função de sanidade: DAU (usuários ativos por dia, UTC) ----
-- "ativo no dia" = teve >=1 evento naquele dia-calendário UTC.
create or replace function public.admin_dau(dias integer default 30)
returns table (dia date, usuarios bigint)
language sql stable security definer set search_path = public as $$
  select created_at::date as dia, count(distinct user_id) as usuarios
  from public.telemetria_eventos
  where created_at >= (now() - make_interval(days => dias))
  group by 1 order by 1;
$$;
revoke execute on function public.admin_dau(integer) from public;
