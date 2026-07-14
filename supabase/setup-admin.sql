-- ============================================================================
-- SETUP DO PAINEL ADMIN - Carreira LoL  (v11 - inclui 021 gaming house)
-- Cole TUDO isto no Supabase (SQL Editor -> New query -> Run). Idempotente.
-- Pre-requisito: as migrations 001..009 (tabelas base do jogo) ja rodadas.
-- ============================================================================

-- >>>>>>>>>>>>>>>>>>>> 010_admin_fundacao.sql >>>>>>>>>>>>>>>>>>>>
-- ðŸ› ï¸ Painel Admin â€” Fase 0: papel de admin, auditoria, config de live-ops e a
-- primeira funÃ§Ã£o de agregaÃ§Ã£o (sanidade). TUDO em UTC no banco.
--
-- SEGURANÃ‡A: as funÃ§Ãµes de agregaÃ§Ã£o sÃ£o chamadas pelo servidor com a SERVICE ROLE
-- (bypassa RLS) SÃ“ depois do requireAdmin() verificar o papel. Por garantia extra,
-- revogamos EXECUTE de anon/authenticated nelas (sÃ³ service_role chama).

-- ---- papel de admin + colunas de suporte no profiles ----
alter table public.profiles add column if not exists role text not null default 'player';
alter table public.profiles add column if not exists banned_at timestamptz;
alter table public.profiles add column if not exists flagged_at timestamptz;

-- o jogador NUNCA muda o proprio papel/ban/flag (so o servidor via service role)
revoke update (role) on public.profiles from authenticated;
revoke update (banned_at) on public.profiles from authenticated;
revoke update (flagged_at) on public.profiles from authenticated;

-- helper: este uid Ã© admin?
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
-- sem policies pra authenticated/anon: sÃ³ a service role (que bypassa RLS) lÃª/escreve.
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
-- o jogo (logado ou nao) le SÃ“ as chaves publicas; escrita e sÃ³ via service role.
drop policy if exists "config: ler publicas" on public.app_config;
create policy "config: ler publicas" on public.app_config
  for select to authenticated, anon using (publica = true);

-- defaults de live-ops (fail-open: ausencia = tudo ligado no jogo)
insert into public.app_config (chave, valor, publica) values
  ('feature_flags', '{"duelo_online":true,"prova_semanal":true,"gacha":true,"compartilhamento":true}'::jsonb, true),
  ('mensagem_do_dia', '{"ativo":false}'::jsonb, true)
on conflict (chave) do nothing;

-- Ã­ndices de telemetria pra funis (evento+user). Os (evento,created_at) e
-- (user_id,created_at) jÃ¡ existem da migration 005.
create index if not exists telemetria_ev_user_idx on public.telemetria_eventos (evento, user_id, created_at);

-- ---- funÃ§Ã£o de sanidade: DAU (usuÃ¡rios ativos por dia, UTC) ----
-- "ativo no dia" = teve >=1 evento naquele dia-calendÃ¡rio UTC.
create or replace function public.admin_dau(dias integer default 30)
returns table (dia date, usuarios bigint)
language sql stable security definer set search_path = public as $$
  select created_at::date as dia, count(distinct user_id) as usuarios
  from public.telemetria_eventos
  where created_at >= (now() - make_interval(days => dias))
  group by 1 order by 1;
$$;
revoke execute on function public.admin_dau(integer) from public;


-- >>>>>>>>>>>>>>>>>>>> 011_admin_metricas.sql >>>>>>>>>>>>>>>>>>>>
-- ðŸ› ï¸ Admin Fase 1 â€” VisÃ£o Geral + RetenÃ§Ã£o. Tudo UTC; agregaÃ§Ã£o NO POSTGRES.
-- DefiniÃ§Ãµes (ver docs/admin-metricas.md):
--  â€¢ "dia" = dia-calendÃ¡rio UTC.
--  â€¢ "ativo no dia" p/ retenÃ§Ã£o = teve >=1 `sessao_inicio` naquele dia.
--  â€¢ coorte = semana (segunda) do PRIMEIRO sessao_inicio do usuÃ¡rio.
--  â€¢ sessÃ£o = eventos do mesmo usuÃ¡rio com gap < 30 min; duraÃ§Ã£o = fim - inÃ­cio.

-- ---- KPIs da home (um jsonb) ----
create or replace function public.admin_kpis(dias integer default 30)
returns jsonb language sql stable security definer set search_path = public as $$
  with janela as (select (now() - make_interval(days => greatest(dias,1))) as ini),
  ev as (select * from public.telemetria_eventos, janela where dias = 0 or created_at >= ini),
  prim as (select user_id, min(created_at) as t0 from public.telemetria_eventos where evento='sessao_inicio' group by 1),
  sess as (
    select user_id, sum(nova) over (partition by user_id order by created_at) as sid, created_at
    from (
      select user_id, created_at,
        case when lag(created_at) over (partition by user_id order by created_at) is null
             or created_at - lag(created_at) over (partition by user_id order by created_at) > interval '30 min'
             then 1 else 0 end as nova
      from ev
    ) x
  ),
  durs as (select extract(epoch from (max(created_at)-min(created_at)))/60 as dur from sess group by user_id, sid),
  ret as (
    select p.user_id, p.t0::date as d0,
      exists(select 1 from public.telemetria_eventos e where e.user_id=p.user_id and e.evento='sessao_inicio' and e.created_at::date = p.t0::date + 1) as v1,
      exists(select 1 from public.telemetria_eventos e where e.user_id=p.user_id and e.evento='sessao_inicio' and e.created_at::date = p.t0::date + 7) as v7
    from prim p
  )
  select jsonb_build_object(
    'jogadores_total', (select count(*) from public.profiles),
    'novos', (select count(*) from prim, janela where dias=0 or t0 >= ini),
    'dau', (select count(distinct user_id) from public.telemetria_eventos where created_at::date = now()::date),
    'wau', (select count(distinct user_id) from public.telemetria_eventos where created_at >= now() - interval '7 days'),
    'sessoes', (select count(*) from durs),
    'dur_mediana', coalesce((select round(percentile_cont(0.5) within group (order by dur)::numeric,1) from durs), 0),
    'd1', coalesce((select round(100.0*count(*) filter (where v1)/nullif(count(*),0)) from ret where d0 <= now()::date - 1),0),
    'd7', coalesce((select round(100.0*count(*) filter (where v7)/nullif(count(*),0)) from ret where d0 <= now()::date - 7),0),
    'partidas', (select count(*) from ev where evento='partida_fim'),
    'pct_online', coalesce((select round(100.0*count(distinct user_id)/nullif((select count(*) from public.profiles),0))
                            from public.telemetria_eventos
                            where evento='duelo_fim' or (evento='feature_desbloqueada' and props->>'feature'='online')),0)
  );
$$;
revoke execute on function public.admin_kpis(integer) from public;

-- ---- DAU + novos cadastros por dia ----
create or replace function public.admin_dau_novos(dias integer default 30)
returns table (dia date, dau bigint, novos bigint)
language sql stable security definer set search_path = public as $$
  with prim as (select user_id, min(created_at)::date as d0 from public.telemetria_eventos where evento='sessao_inicio' group by 1)
  select g::date as dia,
    (select count(distinct user_id) from public.telemetria_eventos e where e.created_at::date = g::date) as dau,
    (select count(*) from prim where d0 = g::date) as novos
  from generate_series((now() - make_interval(days => greatest(dias,7)))::date, now()::date, '1 day') g
  order by 1;
$$;
revoke execute on function public.admin_dau_novos(integer) from public;

-- ---- retenÃ§Ã£o por coorte semanal (percentuais D1/D3/D7/D14/D30) ----
create or replace function public.admin_retencao_coortes()
returns table (coorte text, tamanho bigint, d1 int, d3 int, d7 int, d14 int, d30 int)
language sql stable security definer set search_path = public as $$
  with prim as (select user_id, min(created_at)::date as d0 from public.telemetria_eventos where evento='sessao_inicio' group by 1),
  ativos as (select distinct user_id, created_at::date as dia from public.telemetria_eventos where evento='sessao_inicio'),
  base as (select p.user_id, date_trunc('week', p.d0)::date as cs, (a.dia - p.d0) as off from prim p join ativos a using (user_id))
  select to_char(cs,'YYYY-MM-DD') as coorte,
    count(distinct user_id) as tamanho,
    round(100.0*count(distinct user_id) filter (where off=1)/nullif(count(distinct user_id),0))::int as d1,
    round(100.0*count(distinct user_id) filter (where off=3)/nullif(count(distinct user_id),0))::int as d3,
    round(100.0*count(distinct user_id) filter (where off=7)/nullif(count(distinct user_id),0))::int as d7,
    round(100.0*count(distinct user_id) filter (where off=14)/nullif(count(distinct user_id),0))::int as d14,
    round(100.0*count(distinct user_id) filter (where off=30)/nullif(count(distinct user_id),0))::int as d30
  from base group by cs order by cs desc;
$$;
revoke execute on function public.admin_retencao_coortes() from public;

-- ---- duraÃ§Ã£o de sessÃ£o por dia (p50/p75/p90) + histograma ----
create or replace function public.admin_sessoes(dias integer default 30)
returns table (dia date, sessoes bigint, p50 numeric, p75 numeric, p90 numeric)
language sql stable security definer set search_path = public as $$
  with ev as (select * from public.telemetria_eventos where dias=0 or created_at >= now() - make_interval(days => dias)),
  sess as (
    select user_id, sum(nova) over (partition by user_id order by created_at) as sid, created_at from (
      select user_id, created_at, case when lag(created_at) over (partition by user_id order by created_at) is null
        or created_at - lag(created_at) over (partition by user_id order by created_at) > interval '30 min' then 1 else 0 end as nova
      from ev) x),
  durs as (select min(created_at)::date as dia, extract(epoch from (max(created_at)-min(created_at)))/60 as dur from sess group by user_id, sid)
  select dia, count(*) as sessoes,
    round(percentile_cont(0.5) within group (order by dur)::numeric,1) as p50,
    round(percentile_cont(0.75) within group (order by dur)::numeric,1) as p75,
    round(percentile_cont(0.9) within group (order by dur)::numeric,1) as p90
  from durs group by dia order by dia;
$$;
revoke execute on function public.admin_sessoes(integer) from public;

create or replace function public.admin_sessoes_hist(dias integer default 30)
returns table (faixa text, ordem int, qtd bigint)
language sql stable security definer set search_path = public as $$
  with ev as (select * from public.telemetria_eventos where dias=0 or created_at >= now() - make_interval(days => dias)),
  sess as (
    select user_id, sum(nova) over (partition by user_id order by created_at) as sid, created_at from (
      select user_id, created_at, case when lag(created_at) over (partition by user_id order by created_at) is null
        or created_at - lag(created_at) over (partition by user_id order by created_at) > interval '30 min' then 1 else 0 end as nova
      from ev) x),
  durs as (select extract(epoch from (max(created_at)-min(created_at)))/60 as dur from sess group by user_id, sid),
  faixas as (
    select case when dur < 1 then '<1m' when dur < 3 then '1-3m' when dur < 5 then '3-5m'
                when dur < 10 then '5-10m' when dur < 20 then '10-20m' else '20m+' end as faixa,
           case when dur < 1 then 0 when dur < 3 then 1 when dur < 5 then 2 when dur < 10 then 3 when dur < 20 then 4 else 5 end as ordem
    from durs)
  select faixa, ordem, count(*) as qtd from faixas group by faixa, ordem order by ordem;
$$;
revoke execute on function public.admin_sessoes_hist(integer) from public;

-- ---- curva de sobrevivÃªncia: % de usuÃ¡rios que "chegaram" ao dia N ----
create or replace function public.admin_sobrevivencia()
returns table (dia_n int, pct int)
language sql stable security definer set search_path = public as $$
  with prim as (select user_id, min(created_at)::date as d0 from public.telemetria_eventos where evento='sessao_inicio' group by 1),
  maxoff as (select p.user_id, p.d0, max(e.created_at::date - p.d0) as off_max
             from prim p join public.telemetria_eventos e using (user_id) where e.evento='sessao_inicio' group by 1,2)
  select n as dia_n,
    coalesce(round(100.0*count(*) filter (where off_max >= n)/nullif(count(*) filter (where d0 <= now()::date - n),0)),0)::int as pct
  from generate_series(0,30) n cross join maxoff
  group by n order by n;
$$;
revoke execute on function public.admin_sobrevivencia() from public;


-- >>>>>>>>>>>>>>>>>>>> 012_admin_funis.sql >>>>>>>>>>>>>>>>>>>>
-- ðŸ› ï¸ Admin Fase 2 â€” Funis, ponto de abandono e ritual diÃ¡rio. AgregaÃ§Ã£o no Postgres.
-- Passos de funil = distinct users que alcanÃ§aram cada etapa (contagem monotÃ´nica nÃ£o
-- garantida por passo; Ã© a leitura padrÃ£o de funil por evento). Detalhes em docs.

-- ---- funil de onboarding (primeiros passos) ----
create or replace function public.admin_funil_onboarding()
returns table (etapa text, ordem int, usuarios bigint)
language sql stable security definer set search_path = public as $$
  with u as (
    select
      count(distinct case when evento in ('carreira_criada','sessao_inicio') then user_id end) as criou,
      count(distinct case when evento='partida_fim' then user_id end) as partida,
      count(distinct case when evento='partida_fim' and (props->>'vitoria')::boolean then user_id end) as vitoria,
      count(distinct case when evento='drop_item' then user_id end) as dropi,
      count(distinct case when evento='gacha_puxada' then user_id end) as gacha
    from public.telemetria_eventos
  ),
  d1 as (
    select count(*)::bigint n from (
      select p.user_id from (select user_id, min(created_at)::date d0 from public.telemetria_eventos where evento='sessao_inicio' group by 1) p
      where exists (select 1 from public.telemetria_eventos e where e.user_id=p.user_id and e.evento='sessao_inicio' and e.created_at::date=p.d0+1)
    ) x
  )
  -- `etapa` Ã© uma CHAVE sem acento (o rÃ³tulo bonito vive no cliente, evitando
  -- corrupÃ§Ã£o de encoding no caminho SQL->banco).
  select * from (values
    ('cadastro', 0, (select count(*)::bigint from public.profiles)),
    ('criou', 1, (select criou from u)),
    ('partida1', 2, (select partida from u)),
    ('vitoria1', 3, (select vitoria from u)),
    ('drop1', 4, (select dropi from u)),
    ('gacha1', 5, (select gacha from u)),
    ('d1', 6, (select n from d1))
  ) t(etapa, ordem, usuarios) order by ordem;
$$;
revoke execute on function public.admin_funil_onboarding() from public;

-- ---- funil de progressÃ£o longa (usa feature_desbloqueada e passe_nivel) ----
create or replace function public.admin_funil_progressao()
returns table (etapa text, ordem int, usuarios bigint)
language sql stable security definer set search_path = public as $$
  with feat as (
    select props->>'feature' as f, count(distinct user_id) as n
    from public.telemetria_eventos where evento='feature_desbloqueada' group by 1
  ),
  u as (
    select
      count(distinct case when evento in ('carreira_criada','sessao_inicio') then user_id end) as criou,
      count(distinct case when evento='sessao_inicio' and coalesce((props->>'semana')::int,1) >= 2 then user_id end) as sem2,
      count(distinct case when evento='passe_nivel' and coalesce((props->>'nivel')::int,0) >= 10 then user_id end) as p10,
      count(distinct case when evento='passe_nivel' and coalesce((props->>'nivel')::int,0) >= 60 then user_id end) as p60,
      count(distinct case when evento='duelo_fim' then user_id end) as duelo,
      count(distinct case when evento='prova_fim' then user_id end) as prova
    from public.telemetria_eventos
  )
  -- `etapa` = chave sem acento; rÃ³tulo bonito no cliente.
  select * from (values
    ('criou', 0, (select criou from u)),
    ('sem2', 1, (select sem2 from u)),
    ('booster', 2, coalesce((select n from feat where f='booster'),0)),
    ('itens', 3, coalesce((select n from feat where f='itens'),0)),
    ('passe', 4, coalesce((select n from feat where f='passe'),0)),
    ('passe10', 5, (select p10 from u)),
    ('passe60', 6, (select p60 from u)),
    ('online', 7, coalesce((select n from feat where f='online'),0)),
    ('duelo1', 8, (select duelo from u)),
    ('prova1', 9, (select prova from u))
  ) t(etapa, ordem, usuarios) order by ordem;
$$;
revoke execute on function public.admin_funil_progressao() from public;

-- ---- ponto de abandono: contexto dos churned (inativos hÃ¡ 7+ dias) ----
create or replace function public.admin_abandono()
returns jsonb language sql stable security definer set search_path = public as $$
  with ult as (select user_id, max(created_at) as ultimo from public.telemetria_eventos group by 1),
  churned as (select user_id from ult where ultimo < now() - interval '7 days'),
  us as (select distinct on (user_id) user_id, props->>'elo' as elo, props->>'semana' as semana
         from public.telemetria_eventos where evento='sessao_inicio' order by user_id, created_at desc),
  ut as (select distinct on (user_id) user_id, props->>'rota' as rota
         from public.telemetria_eventos where evento='tela_visitada' order by user_id, created_at desc)
  select jsonb_build_object(
    'total', (select count(*) from churned),
    'por_elo', coalesce((select jsonb_agg(jsonb_build_object('k', coalesce(elo,'?'), 'v', c) order by c desc)
                         from (select s.elo, count(*) c from churned ch join us s using (user_id) group by 1) z), '[]'::jsonb),
    'por_semana', coalesce((select jsonb_agg(jsonb_build_object('k', coalesce(semana,'?'), 'v', c) order by (case when semana ~ '^\d+$' then semana::int else 999 end))
                            from (select s.semana, count(*) c from churned ch join us s using (user_id) group by 1) z), '[]'::jsonb),
    'por_tela', coalesce((select jsonb_agg(jsonb_build_object('k', coalesce(rota,'?'), 'v', c) order by c desc)
                          from (select t.rota, count(*) c from churned ch join ut t using (user_id) group by 1) z), '[]'::jsonb)
  );
$$;
revoke execute on function public.admin_abandono() from public;

-- ---- ritual diÃ¡rio: puxada grÃ¡tis, streaks e escudos ----
create or replace function public.admin_ritual(dias integer default 30)
returns jsonb language sql stable security definer set search_path = public as $$
  with strk as (select distinct on (user_id) user_id, coalesce((props->>'streak')::int,0) as s
                from public.telemetria_eventos where evento='streak_dia' order by user_id, created_at desc)
  select jsonb_build_object(
    'serie', coalesce((select jsonb_agg(jsonb_build_object('dia', to_char(g,'YYYY-MM-DD'),
               'dau', (select count(distinct user_id) from public.telemetria_eventos e where e.created_at::date=g),
               'gratis', (select count(distinct user_id) from public.telemetria_eventos e where e.created_at::date=g and e.evento='gacha_puxada' and (e.props->>'gratis')::boolean)) order by g)
             from generate_series((now()-make_interval(days => greatest(dias,7)))::date, now()::date, '1 day') g), '[]'::jsonb),
    'streaks', coalesce((select jsonb_agg(jsonb_build_object('k', faixa, 'v', qtd) order by ord)
               from (select case when s=0 then '0' when s<=2 then '1-2' when s<=6 then '3-6' when s<=13 then '7-13' else '14+' end as faixa,
                            case when s=0 then 0 when s<=2 then 1 when s<=6 then 2 when s<=13 then 3 else 4 end as ord, count(*) qtd
                     from strk group by 1,2) z), '[]'::jsonb),
    'escudos_usados', (select count(*) from public.telemetria_eventos where evento='streak_dia' and props->>'evento'='escudo')
  );
$$;
revoke execute on function public.admin_ritual(integer) from public;


-- >>>>>>>>>>>>>>>>>>>> 013_admin_economia.sql >>>>>>>>>>>>>>>>>>>>
-- ðŸ› ï¸ Admin Fase 3 â€” Economia + engajamento. AgregaÃ§Ã£o no Postgres.
-- Fonte da economia: evento `coinpoints` {delta, motivo, saldo} (best-effort).

-- ---- economia: fluxo diÃ¡rio criado vs destruÃ­do, por motivo, saldos ----
create or replace function public.admin_economia(dias integer default 30)
returns jsonb language sql stable security definer set search_path = public as $$
  with ev as (select created_at, (props->>'delta')::int as d, props->>'motivo' as m
              from public.telemetria_eventos where evento='coinpoints' and (dias=0 or created_at >= now()-make_interval(days => dias)))
  select jsonb_build_object(
    'serie', coalesce((select jsonb_agg(jsonb_build_object('dia', to_char(g,'YYYY-MM-DD'),
        'criado', (select coalesce(sum(d),0) from ev where created_at::date=g and d>0),
        'destruido', (select coalesce(-sum(d),0) from ev where created_at::date=g and d<0)) order by g)
      from generate_series((now()-make_interval(days => greatest(dias,7)))::date, now()::date, '1 day') g), '[]'::jsonb),
    'por_motivo', coalesce((select jsonb_agg(jsonb_build_object('k', coalesce(m,'?'), 'v', soma) order by abs(soma) desc)
      from (select m, sum(d) soma from ev group by m) z), '[]'::jsonb),
    'saldo_hist', coalesce((select jsonb_agg(jsonb_build_object('k', faixa, 'v', q) order by ord)
      from (select case when coinpoints=0 then '0' when coinpoints<200 then '<200' when coinpoints<1000 then '200-1k'
                        when coinpoints<5000 then '1k-5k' else '5k+' end faixa,
                   case when coinpoints=0 then 0 when coinpoints<200 then 1 when coinpoints<1000 then 2 when coinpoints<5000 then 3 else 4 end ord,
                   count(*) q from public.profiles group by 1,2) z), '[]'::jsonb),
    'top_saldos', coalesce((select jsonb_agg(jsonb_build_object('user_id', id, 'nick', nick, 'saldo', coinpoints))
      from (select id, nick, coinpoints from public.profiles order by coinpoints desc limit 20) z), '[]'::jsonb)
  );
$$;
revoke execute on function public.admin_economia(integer) from public;

-- ---- gacha: puxadas/dia, raridade OBSERVADA (por carta) e pity no 5â˜… ----
create or replace function public.admin_gacha(dias integer default 30)
returns jsonb language sql stable security definer set search_path = public as $$
  with ev as (select * from public.telemetria_eventos where evento='gacha_puxada' and (dias=0 or created_at >= now()-make_interval(days => dias)))
  select jsonb_build_object(
    'puxadas_dia', coalesce((select jsonb_agg(jsonb_build_object('dia', to_char(g,'YYYY-MM-DD'),
        'v', (select coalesce(sum(coalesce((props->>'qtd')::int,1)),0) from ev where created_at::date=g)) order by g)
      from generate_series((now()-make_interval(days => greatest(dias,7)))::date, now()::date, '1 day') g), '[]'::jsonb),
    'raridade_obs', coalesce((select jsonb_agg(jsonb_build_object('k', r::text, 'v', q) order by r)
      from (select r::int as r, count(*) q from (select jsonb_array_elements_text(props->'raridades') r from ev where props ? 'raridades') s group by 1) z), '[]'::jsonb),
    'pity_5', coalesce((select jsonb_agg(jsonb_build_object('k', faixa, 'v', q) order by ord)
      from (select case when p<20 then '0-19' when p<40 then '20-39' when p<60 then '40-59' when p<80 then '60-79' else '80+' end faixa,
                   case when p<20 then 0 when p<40 then 1 when p<60 then 2 when p<80 then 3 else 4 end ord, count(*) q
            from (select coalesce((props->>'pity')::int,0) p from ev where coalesce((props->>'melhor')::int,0) >= 5) s group by 1,2) z), '[]'::jsonb)
  );
$$;
revoke execute on function public.admin_gacha(integer) from public;

-- ---- itens: drops por raridade + reroll/desmonte ----
create or replace function public.admin_itens(dias integer default 30)
returns jsonb language sql stable security definer set search_path = public as $$
  with ev as (select * from public.telemetria_eventos where dias=0 or created_at >= now()-make_interval(days => dias))
  select jsonb_build_object(
    'drops_por_raridade', coalesce((select jsonb_agg(jsonb_build_object('k', r::text, 'v', q) order by r)
      from (select coalesce((props->>'raridade')::int,0) r, count(*) q from ev where evento='drop_item' group by 1) z), '[]'::jsonb),
    'reroll', (select count(*) from ev where evento='item_reroll'),
    'desmonte', (select count(*) from ev where evento='item_desmonte'),
    'drops_total', (select count(*) from ev where evento='drop_item')
  );
$$;
revoke execute on function public.admin_itens(integer) from public;

-- ---- detector de anomalia: saldo vs soma dos deltas (classificacao no TS) ----
create or replace function public.admin_anomalias()
returns table (user_id uuid, nick text, saldo integer, soma_eventos bigint)
language sql stable security definer set search_path = public as $$
  select * from (
    select p.id as user_id, p.nick, p.coinpoints as saldo,
      coalesce((select sum((e.props->>'delta')::int) from public.telemetria_eventos e where e.user_id=p.id and e.evento='coinpoints'),0)::bigint as soma_eventos
    from public.profiles p
  ) x where abs(saldo - soma_eventos) > 100 order by abs(saldo - soma_eventos) desc;
$$;
revoke execute on function public.admin_anomalias() from public;

-- ---- engajamento: skip de cerimonia (taxa), uso por feature, niveis do passe ----
create or replace function public.admin_engajamento(dias integer default 30)
returns jsonb language sql stable security definer set search_path = public as $$
  with ev as (select * from public.telemetria_eventos where dias=0 or created_at >= now()-make_interval(days => dias))
  select jsonb_build_object(
    'skip_por_tipo', coalesce((select jsonb_agg(jsonb_build_object('tipo', tipo, 'vista', v, 'pulada', p, 'taxa', case when v>0 then round(100.0*p/v) else 0 end) order by v desc)
      from (select coalesce(vs.tipo, pl.tipo) tipo, coalesce(vs.n,0) v, coalesce(pl.n,0) p
            from (select props->>'tipo' tipo, count(*) n from ev where evento='cerimonia_vista' group by 1) vs
            full join (select props->>'tipo' tipo, count(*) n from ev where evento='cerimonia_pulada' group by 1) pl using (tipo)) z), '[]'::jsonb),
    'partidas_por_modo', coalesce((select jsonb_agg(jsonb_build_object('k', coalesce(modo,'?'), 'v', c) order by c desc)
      from (select props->>'modo' modo, count(*) c from ev where evento='partida_fim' group by 1) z), '[]'::jsonb),
    'cartoes_por_tipo', coalesce((select jsonb_agg(jsonb_build_object('k', coalesce(tipo,'?'), 'v', c) order by c desc)
      from (select props->>'tipo' tipo, count(*) c from ev where evento='cartao_compartilhado' group by 1) z), '[]'::jsonb),
    'duelos', (select count(*) from ev where evento='duelo_fim'),
    'provas', (select count(*) from ev where evento='prova_fim'),
    'passe_niveis', coalesce((select jsonb_agg(jsonb_build_object('k', nivel::text, 'v', q) order by nivel)
      from (select least(60, floor(coalesce((estado->>'pp')::int,0)/100.0)+1)::int nivel, count(*) q from public.battle_pass group by 1) z), '[]'::jsonb)
  );
$$;
revoke execute on function public.admin_engajamento(integer) from public;


-- >>>>>>>>>>>>>>>>>>>> 014_admin_ficha_liveops.sql >>>>>>>>>>>>>>>>>>>>
-- ðŸ› ï¸ Admin Fase 4 â€” Ficha de jogador, aÃ§Ãµes auditadas, integridade e live-ops.
--
-- TODAS as funÃ§Ãµes de mutaÃ§Ã£o sÃ£o SECURITY DEFINER, gravam no admin_audit_log na
-- MESMA transaÃ§Ã£o (Regra 2: nada muda sem log com motivo) e exigem `motivo` nÃ£o-vazio.
-- `revoke execute from public`: sÃ³ a service role (apÃ³s requireAdmin) chama.
--
-- Ajuste de saldo de OUTRA conta nÃ£o cabe no ajustar_coinpoints (que opera no
-- auth.uid() do prÃ³prio jogador). Por isso admin_ajustar_coinpoints â€” mesma regra
-- (nunca UPDATE direto solto, sempre com motivo e via funÃ§Ã£o controlada).

-- prova: marca de invalidaÃ§Ã£o (preserva o score original em `detalhe`)
alter table public.prova_semanal_scores add column if not exists invalido boolean not null default false;

-- busca por nick sem depender de case
create index if not exists profiles_nick_lower_idx on public.profiles (lower(nick));

-- ---- busca de jogador: nick (ilike), e-mail (ilike) ou user_id exato ----
create or replace function public.admin_buscar_jogador(termo text)
returns table (user_id uuid, nick text, email text, coinpoints integer, role text, banned_at timestamptz, flagged_at timestamptz, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.nick, u.email, p.coinpoints, p.role, p.banned_at, p.flagged_at, p.created_at
  from public.profiles p
  left join auth.users u on u.id = p.id
  where (termo ~ '^[0-9a-fA-F-]{36}$' and p.id = termo::uuid)
     or (p.nick ilike '%' || termo || '%')
     or (u.email ilike '%' || termo || '%')
  order by p.nick
  limit 30;
$$;
revoke execute on function public.admin_buscar_jogador(text) from public;

-- ---- ficha completa: perfil + save + inventÃ¡rio + passe + duelos + provas + eventos ----
create or replace function public.admin_ficha(alvo uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'perfil', (select jsonb_build_object('user_id', p.id, 'nick', p.nick, 'email', u.email,
                 'coinpoints', p.coinpoints, 'role', p.role, 'banned_at', p.banned_at,
                 'flagged_at', p.flagged_at, 'created_at', p.created_at)
               from public.profiles p left join auth.users u on u.id = p.id where p.id = alvo),
    'save', (select jsonb_build_object('updated_at', updated_at,
                 'slots', (select count(*) from jsonb_object_keys(data))) from public.user_saves where user_id = alvo),
    'inventario', (select jsonb_build_object('updated_at', updated_at,
                 'itens', jsonb_array_length(itens),
                 'equipado', (select count(*) from jsonb_object_keys(equipado))) from public.inventario where user_id = alvo),
    'passe_nivel', (select least(60, floor(coalesce((estado->>'pp')::int, 0) / 100.0) + 1)::int from public.battle_pass where user_id = alvo),
    'duelos', (select jsonb_build_object(
                 'jogos', count(*),
                 'vitorias', count(*) filter (where vencedor = alvo),
                 'recentes', coalesce((select jsonb_agg(jsonb_build_object('quando', criado_at,
                     'adv', case when desafiante = alvo then oponente_nick else desafiante_nick end,
                     'venceu', vencedor = alvo) order by criado_at desc)
                   from (select * from public.duelos where desafiante = alvo or oponente = alvo order by criado_at desc limit 10) r), '[]'::jsonb))
               from public.duelos where desafiante = alvo or oponente = alvo),
    'provas', coalesce((select jsonb_agg(jsonb_build_object('semana', semana, 'score', score, 'invalido', invalido) order by semana desc)
                 from public.prova_semanal_scores where user_id = alvo), '[]'::jsonb),
    'coinpoints_soma_eventos', coalesce((select sum((props->>'delta')::int) from public.telemetria_eventos where user_id = alvo and evento = 'coinpoints'), 0),
    'eventos', coalesce((select jsonb_agg(jsonb_build_object('evento', evento, 'props', props, 'quando', created_at) order by created_at desc)
                 from (select * from public.telemetria_eventos where user_id = alvo order by created_at desc limit 100) e), '[]'::jsonb)
  );
$$;
revoke execute on function public.admin_ficha(uuid) from public;

-- ---- AÃ‡ÃƒO: ajustar CoinPoints de uma conta (nunca negativo; motivo obrigatÃ³rio) ----
create or replace function public.admin_ajustar_coinpoints(p_admin uuid, p_alvo uuid, p_delta integer, p_motivo text)
returns integer language plpgsql security definer set search_path = public as $$
declare novo integer; m text := btrim(coalesce(p_motivo, ''));
begin
  if m = '' then raise exception 'motivo_obrigatorio'; end if;
  update public.profiles set coinpoints = coinpoints + p_delta
    where id = p_alvo and coinpoints + p_delta >= 0
    returning coinpoints into novo;
  if novo is null then raise exception 'saldo_insuficiente_ou_inexistente'; end if;
  insert into public.admin_audit_log (admin_id, acao, alvo_user_id, detalhe)
    values (p_admin, 'ajustar_coinpoints', p_alvo, jsonb_build_object('delta', p_delta, 'motivo', m, 'saldo_novo', novo));
  return novo;
end; $$;
revoke execute on function public.admin_ajustar_coinpoints(uuid, uuid, integer, text) from public;

-- ---- AÃ‡ÃƒO: sinalizar/limpar suspeita ----
create or replace function public.admin_set_flag(p_admin uuid, p_alvo uuid, p_ativo boolean, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare m text := btrim(coalesce(p_motivo, ''));
begin
  if m = '' then raise exception 'motivo_obrigatorio'; end if;
  update public.profiles set flagged_at = case when p_ativo then now() else null end where id = p_alvo;
  if not found then raise exception 'perfil_inexistente'; end if;
  insert into public.admin_audit_log (admin_id, acao, alvo_user_id, detalhe)
    values (p_admin, case when p_ativo then 'flag' else 'unflag' end, p_alvo, jsonb_build_object('motivo', m));
end; $$;
revoke execute on function public.admin_set_flag(uuid, uuid, boolean, text) from public;

-- ---- AÃ‡ÃƒO: banir/desbanir. O JOGO checa banned_at no login/sync e bloqueia. ----
create or replace function public.admin_set_ban(p_admin uuid, p_alvo uuid, p_ativo boolean, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare m text := btrim(coalesce(p_motivo, ''));
begin
  if m = '' then raise exception 'motivo_obrigatorio'; end if;
  update public.profiles set banned_at = case when p_ativo then now() else null end where id = p_alvo;
  if not found then raise exception 'perfil_inexistente'; end if;
  insert into public.admin_audit_log (admin_id, acao, alvo_user_id, detalhe)
    values (p_admin, case when p_ativo then 'ban' else 'unban' end, p_alvo, jsonb_build_object('motivo', m));
end; $$;
revoke execute on function public.admin_set_ban(uuid, uuid, boolean, text) from public;

-- ---- AÃ‡ÃƒO: invalidar/revalidar score de prova (zera visÃ­vel, preserva original) ----
create or replace function public.admin_invalidar_prova(p_admin uuid, p_alvo uuid, p_semana integer, p_ativo boolean, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare m text := btrim(coalesce(p_motivo, ''));
begin
  if m = '' then raise exception 'motivo_obrigatorio'; end if;
  if p_ativo then
    update public.prova_semanal_scores
      set invalido = true,
          detalhe = detalhe || jsonb_build_object('invalidado', true, 'score_original', coalesce((detalhe->>'score_original')::int, score), 'motivo', m),
          score = 0
      where user_id = p_alvo and semana = p_semana;
  else
    update public.prova_semanal_scores
      set invalido = false,
          score = coalesce((detalhe->>'score_original')::int, score),
          detalhe = detalhe - 'invalidado' - 'score_original'
      where user_id = p_alvo and semana = p_semana;
  end if;
  if not found then raise exception 'score_inexistente'; end if;
  insert into public.admin_audit_log (admin_id, acao, alvo_user_id, detalhe)
    values (p_admin, case when p_ativo then 'invalidar_prova' else 'revalidar_prova' end, p_alvo, jsonb_build_object('semana', p_semana, 'motivo', m));
end; $$;
revoke execute on function public.admin_invalidar_prova(uuid, uuid, integer, boolean, text) from public;

-- ---- INTEGRIDADE: z-score dos scores de prova na semana (default = Ãºltima) ----
-- ValidaÃ§Ã£o DEFINITIVA vem por Edge Function na rodada de monetizaÃ§Ã£o; aqui Ã© triagem.
create or replace function public.admin_prova_outliers(p_semana integer default null)
returns table (user_id uuid, nick text, semana integer, score integer, z numeric, invalido boolean)
language sql stable security definer set search_path = public as $$
  with sem as (select coalesce(p_semana, (select max(semana) from public.prova_semanal_scores)) s),
  base as (
    select ps.user_id, ps.nick, ps.semana, ps.score, ps.invalido,
           avg(ps.score) over () mu, stddev_pop(ps.score) over () sd
    from public.prova_semanal_scores ps, sem where ps.semana = sem.s
  )
  select user_id, nick, semana, score,
         case when sd is null or sd = 0 then 0 else round(((score - mu) / sd)::numeric, 2) end as z,
         invalido
  from base order by score desc;
$$;
revoke execute on function public.admin_prova_outliers(integer) from public;

-- ---- INTEGRIDADE: winrates impossÃ­veis de duelo (>=10 jogos e taxa >= 90%) ----
create or replace function public.admin_duelo_suspeitos()
returns table (user_id uuid, nick text, jogos bigint, vitorias bigint, taxa numeric)
language sql stable security definer set search_path = public as $$
  -- Fonte da verdade = tabela `duelos` (a view ranking_duelos foi removida na 008).
  -- Cada duelo vira 2 linhas (uma por participante) com a flag de vitÃ³ria.
  with participacoes as (
    select desafiante as uid, (vencedor = desafiante) as venceu from public.duelos
    union all
    select oponente as uid, (vencedor = oponente) as venceu from public.duelos
  ),
  agg as (
    select uid, count(*) as jogos, count(*) filter (where venceu) as vitorias
    from participacoes group by uid
  )
  select a.uid as user_id, p.nick, a.jogos, a.vitorias,
         round((a.vitorias::numeric / a.jogos), 3) as taxa
  from agg a
  left join public.profiles p on p.id = a.uid
  where a.jogos >= 10 and a.vitorias::numeric / a.jogos >= 0.9
  order by taxa desc, jogos desc;
$$;
revoke execute on function public.admin_duelo_suspeitos() from public;

-- ---- AUDITORIA: leitura do log (com nick do admin e do alvo) ----
create or replace function public.admin_auditoria(lim integer default 100)
returns table (id bigint, quando timestamptz, admin_nick text, acao text, alvo_nick text, alvo_user_id uuid, detalhe jsonb)
language sql stable security definer set search_path = public as $$
  select a.id, a.created_at, pa.nick, a.acao, pt.nick, a.alvo_user_id, a.detalhe
  from public.admin_audit_log a
  left join public.profiles pa on pa.id = a.admin_id
  left join public.profiles pt on pt.id = a.alvo_user_id
  order by a.created_at desc
  limit lim;
$$;
revoke execute on function public.admin_auditoria(integer) from public;

-- ---- LIVE-OPS: escrever config (audita; sÃ³ atualiza chave existente) ----
create or replace function public.admin_set_config(p_admin uuid, p_chave text, p_valor jsonb, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare m text := btrim(coalesce(p_motivo, ''));
begin
  if m = '' then raise exception 'motivo_obrigatorio'; end if;
  update public.app_config set valor = p_valor, updated_at = now() where chave = p_chave;
  if not found then raise exception 'chave_inexistente'; end if;
  insert into public.admin_audit_log (admin_id, acao, alvo_user_id, detalhe)
    values (p_admin, 'set_config', null, jsonb_build_object('chave', p_chave, 'valor', p_valor, 'motivo', m));
end; $$;
revoke execute on function public.admin_set_config(uuid, text, jsonb, text) from public;


-- >>>>>>>>>>>>>>>>>>>> 015_admin_grants.sql >>>>>>>>>>>>>>>>>>>>
-- ðŸ› ï¸ Admin Fase 4b â€” privilÃ©gios do service_role.
--
-- O painel usa a service role (SÃ“ no servidor, apÃ³s requireAdmin) para:
--   (a) ler tabelas direto: profiles (checar o papel) e app_config (live-ops);
--   (b) executar as funÃ§Ãµes admin_* (todas com `revoke execute from public`).
--
-- Neste projeto o service_role estava SEM esses grants (provÃ¡vel efeito dos
-- ajustes do Security Advisor / do novo sistema de API keys). Sem eles o login
-- admin caÃ­a em 403 (permission denied). Concedemos aqui.
--
-- SEGURANÃ‡A: isto NÃƒO enfraquece nada. A secret key vive sÃ³ no servidor
-- (.env.local / Vercel), o service_role jÃ¡ bypassa RLS por natureza, e
-- anon/authenticated continuam sem acesso (o `revoke from public` segue valendo).

-- leitura direta das tabelas que o painel consulta fora de funÃ§Ã£o
grant select on public.profiles to service_role;
grant select on public.app_config to service_role;
grant select, insert on public.admin_audit_log to service_role;

-- executar as funÃ§Ãµes de agregaÃ§Ã£o/aÃ§Ã£o (que revogamos de public)
grant execute on all functions in schema public to service_role;

-- objetos futuros tambÃ©m acessÃ­veis ao service_role (evita repetir isso depois)
alter default privileges in schema public grant execute on functions to service_role;


-- >>>>>>>>>>>>>>>>>>>> 016_admin_grind.sql >>>>>>>>>>>>>>>>>>>>
-- ðŸ› ï¸ Admin â€” adoÃ§Ã£o do Grind de Normais (camada idle, seÃ§Ã£o Endgame do Engajamento).
-- Dois nÃºmeros que dizem se a feature reteve ou virou ruÃ­do:
--   1) % dos ativos do dia que usaram o grind (qualquer evento grind_*)
--   2) distribuiÃ§Ã£o de "horas atÃ© o teto" por usuÃ¡rio-dia (partidas Ã— ~9min)

create or replace function public.admin_grind(dias integer default 30)
returns jsonb language sql stable security definer set search_path = public as $$
  with ev as (select user_id, evento, created_at from public.telemetria_eventos
              where dias=0 or created_at >= now()-make_interval(days => dias)),
  ativos as (select created_at::date d, count(distinct user_id) n from ev group by 1),
  grinders as (select created_at::date d, count(distinct user_id) n from ev where evento like 'grind\_%' group by 1),
  pd as (select user_id, created_at::date d, count(*) partidas from ev where evento='grind_partida' group by 1,2)
  select jsonb_build_object(
    'adocao', coalesce((select jsonb_agg(jsonb_build_object(
        'dia', to_char(a.d,'YYYY-MM-DD'), 'ativos', a.n, 'grinders', coalesce(g.n,0)) order by a.d)
      from ativos a left join grinders g using (d)), '[]'::jsonb),
    'pct_geral', (select case when count(distinct user_id) = 0 then 0
      else round(100.0 * count(distinct user_id) filter (where evento like 'grind\_%') / count(distinct user_id)) end from ev),
    'horas_hist', coalesce((select jsonb_agg(jsonb_build_object('k', faixa, 'v', q) order by ord)
      from (select case when partidas >= 20 then '3h (teto)' when partidas >= 14 then '2-3h'
                        when partidas >= 7 then '1-2h' else '<1h' end faixa,
                   case when partidas >= 20 then 3 when partidas >= 14 then 2 when partidas >= 7 then 1 else 0 end ord,
                   count(*) q
            from pd group by 1,2) z), '[]'::jsonb),
    'teto_dias', (select count(*) from ev where evento='grind_teto_atingido')
  );
$$;
revoke execute on function public.admin_grind(integer) from public;
grant execute on function public.admin_grind(integer) to service_role;


-- >>>>>>>>>>>>>>>>>>>> 017_admin_diorama.sql >>>>>>>>>>>>>>>>>>>>
-- ðŸ› ï¸ Admin â€” adoÃ§Ã£o do Diorama do Grind (a vitrine). Recria admin_grind com os
-- sinais da apresentaÃ§Ã£o: % com diorama visÃ­vel vs. ocultado (o sinal de rejeiÃ§Ã£o
-- mais importante) e adoÃ§Ã£o da Picture-in-Picture.

create or replace function public.admin_grind(dias integer default 30)
returns jsonb language sql stable security definer set search_path = public as $$
  with ev as (select user_id, evento, created_at from public.telemetria_eventos
              where dias=0 or created_at >= now()-make_interval(days => dias)),
  ativos as (select created_at::date d, count(distinct user_id) n from ev group by 1),
  grinders as (select created_at::date d, count(distinct user_id) n from ev where evento like 'grind\_%' group by 1),
  pd as (select user_id, created_at::date d, count(*) partidas from ev where evento='grind_partida' group by 1,2)
  select jsonb_build_object(
    'adocao', coalesce((select jsonb_agg(jsonb_build_object(
        'dia', to_char(a.d,'YYYY-MM-DD'), 'ativos', a.n, 'grinders', coalesce(g.n,0)) order by a.d)
      from ativos a left join grinders g using (d)), '[]'::jsonb),
    'pct_geral', (select case when count(distinct user_id) = 0 then 0
      else round(100.0 * count(distinct user_id) filter (where evento like 'grind\_%') / count(distinct user_id)) end from ev),
    'horas_hist', coalesce((select jsonb_agg(jsonb_build_object('k', faixa, 'v', q) order by ord)
      from (select case when partidas >= 20 then '3h (teto)' when partidas >= 14 then '2-3h'
                        when partidas >= 7 then '1-2h' else '<1h' end faixa,
                   case when partidas >= 20 then 3 when partidas >= 14 then 2 when partidas >= 7 then 1 else 0 end ord,
                   count(*) q
            from pd group by 1,2) z), '[]'::jsonb),
    'teto_dias', (select count(*) from ev where evento='grind_teto_atingido'),
    -- ðŸŽ¬ diorama: quem rejeitou a cena (ocultou/preferiu pÃ­lula) e quem abraÃ§ou (PiP)
    'diorama', jsonb_build_object(
      'usuarios_grind', (select count(distinct user_id) from ev where evento like 'grind\_%'),
      'ocultaram', (select count(distinct user_id) from ev where evento='diorama_ocultado'),
      'pilula', (select count(distinct user_id) from ev where evento='diorama_pilula'),
      'pip_usuarios', (select count(distinct user_id) from ev where evento='diorama_pip_aberto'),
      'pip_aberturas', (select count(*) from ev where evento='diorama_pip_aberto'),
      'pip_seg_medio', (select coalesce(round(avg((props->>'segundos')::int)),0) from public.telemetria_eventos
                        where evento='diorama_pip_fechado' and (dias=0 or created_at >= now()-make_interval(days => dias))),
      'expandiram', (select count(distinct user_id) from ev where evento='diorama_expandido'),
      'reduzidos', (select count(distinct user_id) from ev where evento='diorama_reduzido')
    )
  );
$$;
revoke execute on function public.admin_grind(integer) from public;
grant execute on function public.admin_grind(integer) to service_role;

-- >>>>>>>>>>>>>>>>>>>> 018_admin_grind_proposito.sql >>>>>>>>>>>>>>>>>>>>
-- Admin — Grind com Propósito. Estende admin_grind com os sinais dos 3 sistemas:
-- distribuição REAL de tiers de baú (validar contra as constantes 84/15/1%), adoção
-- da árvore (% dos usuários do grind com ≥1 talento) e Sucata (economia interna).

create or replace function public.admin_grind(dias integer default 30)
returns jsonb language sql stable security definer set search_path = public as $$
  with ev as (select user_id, evento, props, created_at from public.telemetria_eventos
              where dias=0 or created_at >= now()-make_interval(days => dias)),
  ativos as (select created_at::date d, count(distinct user_id) n from ev group by 1),
  grinders as (select created_at::date d, count(distinct user_id) n from ev where evento like 'grind\_%' group by 1),
  pd as (select user_id, created_at::date d, count(*) partidas from ev where evento='grind_partida' group by 1,2),
  usu_grind as (select count(distinct user_id) n from ev where evento like 'grind\_%'),
  baus as (select props->>'tier' tier, count(*) q from ev where evento='grind_bau_aberto' group by 1)
  select jsonb_build_object(
    'adocao', coalesce((select jsonb_agg(jsonb_build_object(
        'dia', to_char(a.d,'YYYY-MM-DD'), 'ativos', a.n, 'grinders', coalesce(g.n,0)) order by a.d)
      from ativos a left join grinders g using (d)), '[]'::jsonb),
    'pct_geral', (select case when count(distinct user_id) = 0 then 0
      else round(100.0 * count(distinct user_id) filter (where evento like 'grind\_%') / count(distinct user_id)) end from ev),
    'horas_hist', coalesce((select jsonb_agg(jsonb_build_object('k', faixa, 'v', q) order by ord)
      from (select case when partidas >= 20 then '3h (teto)' when partidas >= 14 then '2-3h'
                        when partidas >= 7 then '1-2h' else '<1h' end faixa,
                   case when partidas >= 20 then 3 when partidas >= 14 then 2 when partidas >= 7 then 1 else 0 end ord,
                   count(*) q
            from pd group by 1,2) z), '[]'::jsonb),
    'teto_dias', (select count(*) from ev where evento='grind_teto_atingido'),
    'diorama', jsonb_build_object(
      'usuarios_grind', (select n from usu_grind),
      'ocultaram', (select count(distinct user_id) from ev where evento='diorama_ocultado'),
      'pilula', (select count(distinct user_id) from ev where evento='diorama_pilula'),
      'pip_usuarios', (select count(distinct user_id) from ev where evento='diorama_pip_aberto'),
      'pip_aberturas', (select count(*) from ev where evento='diorama_pip_aberto'),
      'pip_seg_medio', (select coalesce(round(avg((props->>'segundos')::int)),0) from public.telemetria_eventos
                        where evento='diorama_pip_fechado' and (dias=0 or created_at >= now()-make_interval(days => dias))),
      'expandiram', (select count(distinct user_id) from ev where evento='diorama_expandido'),
      'reduzidos', (select count(distinct user_id) from ev where evento='diorama_reduzido')
    ),
    -- 🎯 Grind com Propósito
    'proposito', jsonb_build_object(
      -- distribuição real dos tiers abertos (comparar com 84/15/1% + pity)
      'baus_por_tier', coalesce((select jsonb_agg(jsonb_build_object('k', coalesce(tier,'?'), 'v', q) order by q desc) from baus), '[]'::jsonb),
      'baus_total', (select coalesce(sum(q),0) from baus),
      'baus_pity', (select count(*) from ev where evento='grind_bau_aberto' and (props->>'pity')::boolean),
      -- adoção da árvore: % dos usuários do grind que compraram ≥1 talento
      'talento_usuarios', (select count(distinct user_id) from ev where evento='grind_talento_comprado'),
      'talento_pct', (select case when (select n from usu_grind) = 0 then 0
        else round(100.0 * (select count(distinct user_id) from ev where evento='grind_talento_comprado') / (select n from usu_grind)) end),
      'respecs', (select count(*) from ev where evento='grind_respec'),
      'cosmeticos_equipados', (select count(*) from ev where evento='grind_cosmetico_equipado')
    )
  );
$$;
revoke execute on function public.admin_grind(integer) from public;
grant execute on function public.admin_grind(integer) to service_role;

-- >>>>>>>>>>>>>>>>>>>> 019_admin_expedicao.sql >>>>>>>>>>>>>>>>>>>>
-- Admin — Expedição (modo ativo). Recria admin_grind adicionando o objeto 'expedicao':
-- distribuição da fase-final, taxa continuar×recuar e % que usa a Expedição vs só o passivo.

create or replace function public.admin_grind(dias integer default 30)
returns jsonb language sql stable security definer set search_path = public as $$
  with ev as (select user_id, evento, props, created_at from public.telemetria_eventos
              where dias=0 or created_at >= now()-make_interval(days => dias)),
  ativos as (select created_at::date d, count(distinct user_id) n from ev group by 1),
  grinders as (select created_at::date d, count(distinct user_id) n from ev where evento like 'grind\_%' group by 1),
  pd as (select user_id, created_at::date d, count(*) partidas from ev where evento='grind_partida' group by 1,2),
  usu_grind as (select count(distinct user_id) n from ev where evento like 'grind\_%'),
  baus as (select props->>'tier' tier, count(*) q from ev where evento='grind_bau_aberto' group by 1),
  fases as (select (props->>'fase')::int fase, count(*) q from ev where evento='expedicao_fim' and props ? 'fase' group by 1)
  select jsonb_build_object(
    'adocao', coalesce((select jsonb_agg(jsonb_build_object(
        'dia', to_char(a.d,'YYYY-MM-DD'), 'ativos', a.n, 'grinders', coalesce(g.n,0)) order by a.d)
      from ativos a left join grinders g using (d)), '[]'::jsonb),
    'pct_geral', (select case when count(distinct user_id) = 0 then 0
      else round(100.0 * count(distinct user_id) filter (where evento like 'grind\_%') / count(distinct user_id)) end from ev),
    'horas_hist', coalesce((select jsonb_agg(jsonb_build_object('k', faixa, 'v', q) order by ord)
      from (select case when partidas >= 20 then '3h (teto)' when partidas >= 14 then '2-3h'
                        when partidas >= 7 then '1-2h' else '<1h' end faixa,
                   case when partidas >= 20 then 3 when partidas >= 14 then 2 when partidas >= 7 then 1 else 0 end ord,
                   count(*) q
            from pd group by 1,2) z), '[]'::jsonb),
    'teto_dias', (select count(*) from ev where evento='grind_teto_atingido'),
    'diorama', jsonb_build_object(
      'usuarios_grind', (select n from usu_grind),
      'ocultaram', (select count(distinct user_id) from ev where evento='diorama_ocultado'),
      'pilula', (select count(distinct user_id) from ev where evento='diorama_pilula'),
      'pip_usuarios', (select count(distinct user_id) from ev where evento='diorama_pip_aberto'),
      'pip_aberturas', (select count(*) from ev where evento='diorama_pip_aberto'),
      'pip_seg_medio', (select coalesce(round(avg((props->>'segundos')::int)),0) from public.telemetria_eventos
                        where evento='diorama_pip_fechado' and (dias=0 or created_at >= now()-make_interval(days => dias))),
      'expandiram', (select count(distinct user_id) from ev where evento='diorama_expandido'),
      'reduzidos', (select count(distinct user_id) from ev where evento='diorama_reduzido')
    ),
    'proposito', jsonb_build_object(
      'baus_por_tier', coalesce((select jsonb_agg(jsonb_build_object('k', coalesce(tier,'?'), 'v', q) order by q desc) from baus), '[]'::jsonb),
      'baus_total', (select coalesce(sum(q),0) from baus),
      'baus_pity', (select count(*) from ev where evento='grind_bau_aberto' and (props->>'pity')::boolean),
      'talento_usuarios', (select count(distinct user_id) from ev where evento='grind_talento_comprado'),
      'talento_pct', (select case when (select n from usu_grind) = 0 then 0
        else round(100.0 * (select count(distinct user_id) from ev where evento='grind_talento_comprado') / (select n from usu_grind)) end),
      'respecs', (select count(*) from ev where evento='grind_respec'),
      'cosmeticos_equipados', (select count(*) from ev where evento='grind_cosmetico_equipado')
    ),
    -- 🗺️ Expedição (push-your-luck)
    'expedicao', jsonb_build_object(
      'usuarios', (select count(distinct user_id) from ev where evento='expedicao_iniciada'),
      'pct_dos_grinders', (select case when (select n from usu_grind) = 0 then 0
        else round(100.0 * (select count(distinct user_id) from ev where evento='expedicao_iniciada') / (select n from usu_grind)) end),
      'corridas', (select count(*) from ev where evento='expedicao_iniciada'),
      'fase_final_hist', coalesce((select jsonb_agg(jsonb_build_object('k', fase::text, 'v', q) order by fase) from fases), '[]'::jsonb),
      'escolhas_continuar', (select count(*) from ev where evento='expedicao_escolha' and props->>'escolha'='continuar'),
      'escolhas_recuar', (select count(*) from ev where evento='expedicao_escolha' and props->>'escolha'='recuar'),
      'taxa_continuar', (select case when count(*)=0 then 0
        else round(100.0 * count(*) filter (where props->>'escolha'='continuar') / count(*)) end
        from ev where evento='expedicao_escolha'),
      'mortes', (select count(*) from ev where evento='expedicao_fim' and (props->>'morreu')::boolean),
      'recuos', (select count(*) from ev where evento='expedicao_fim' and not coalesce((props->>'morreu')::boolean, false))
    )
  );
$$;
revoke execute on function public.admin_grind(integer) from public;
grant execute on function public.admin_grind(integer) to service_role;


-- >>>>>>>>>>>>>>>>>>>> 020_admin_jornada.sql >>>>>>>>>>>>>>>>>>>>
-- 🛠️ Admin — Jornada de Treino (estilo TBH). Recria admin_grind adicionando o objeto
-- 'jornada': distribuição de fase das partidas (onde os jogadores estão farmando/parede
-- real), farm×avançar, adoção de skills e o funil do Desafio de Região (tentativas ×
-- conquistas). Mantém tudo de 018 (proposito) e 019 (expedicao).

create or replace function public.admin_grind(dias integer default 30)
returns jsonb language sql stable security definer set search_path = public as $$
  with ev as (select user_id, evento, props, created_at from public.telemetria_eventos
              where dias=0 or created_at >= now()-make_interval(days => dias)),
  ativos as (select created_at::date d, count(distinct user_id) n from ev group by 1),
  grinders as (select created_at::date d, count(distinct user_id) n from ev where evento like 'grind\_%' group by 1),
  pd as (select user_id, created_at::date d, count(*) partidas from ev where evento='grind_partida' group by 1,2),
  usu_grind as (select count(distinct user_id) n from ev where evento like 'grind\_%'),
  baus as (select props->>'tier' tier, count(*) q from ev where evento='grind_bau_aberto' group by 1),
  fases as (select (props->>'fase')::int fase, count(*) q from ev where evento='expedicao_fim' and props ? 'fase' group by 1),
  -- 🗺️ faixas de fase da jornada (F1-5, F6-10, ...) a partir das partidas do passivo
  jfases as (select ((((props->>'fase')::int - 1) / 5) * 5 + 1) f0, count(*) q
             from ev where evento='grind_partida' and props ? 'fase' and props->>'fase' is not null group by 1)
  select jsonb_build_object(
    'adocao', coalesce((select jsonb_agg(jsonb_build_object(
        'dia', to_char(a.d,'YYYY-MM-DD'), 'ativos', a.n, 'grinders', coalesce(g.n,0)) order by a.d)
      from ativos a left join grinders g using (d)), '[]'::jsonb),
    'pct_geral', (select case when count(distinct user_id) = 0 then 0
      else round(100.0 * count(distinct user_id) filter (where evento like 'grind\_%') / count(distinct user_id)) end from ev),
    'horas_hist', coalesce((select jsonb_agg(jsonb_build_object('k', faixa, 'v', q) order by ord)
      from (select case when partidas >= 20 then '3h (teto)' when partidas >= 14 then '2-3h'
                        when partidas >= 7 then '1-2h' else '<1h' end faixa,
                   case when partidas >= 20 then 3 when partidas >= 14 then 2 when partidas >= 7 then 1 else 0 end ord,
                   count(*) q
            from pd group by 1,2) z), '[]'::jsonb),
    'teto_dias', (select count(*) from ev where evento='grind_teto_atingido'),
    'diorama', jsonb_build_object(
      'usuarios_grind', (select n from usu_grind),
      'ocultaram', (select count(distinct user_id) from ev where evento='diorama_ocultado'),
      'pilula', (select count(distinct user_id) from ev where evento='diorama_pilula'),
      'pip_usuarios', (select count(distinct user_id) from ev where evento='diorama_pip_aberto'),
      'pip_aberturas', (select count(*) from ev where evento='diorama_pip_aberto'),
      'pip_seg_medio', (select coalesce(round(avg((props->>'segundos')::int)),0) from public.telemetria_eventos
                        where evento='diorama_pip_fechado' and (dias=0 or created_at >= now()-make_interval(days => dias))),
      'expandiram', (select count(distinct user_id) from ev where evento='diorama_expandido'),
      'reduzidos', (select count(distinct user_id) from ev where evento='diorama_reduzido')
    ),
    'proposito', jsonb_build_object(
      'baus_por_tier', coalesce((select jsonb_agg(jsonb_build_object('k', coalesce(tier,'?'), 'v', q) order by q desc) from baus), '[]'::jsonb),
      'baus_total', (select coalesce(sum(q),0) from baus),
      'baus_pity', (select count(*) from ev where evento='grind_bau_aberto' and (props->>'pity')::boolean),
      'talento_usuarios', (select count(distinct user_id) from ev where evento='grind_talento_comprado'),
      'talento_pct', (select case when (select n from usu_grind) = 0 then 0
        else round(100.0 * (select count(distinct user_id) from ev where evento='grind_talento_comprado') / (select n from usu_grind)) end),
      'respecs', (select count(*) from ev where evento='grind_respec'),
      'cosmeticos_equipados', (select count(*) from ev where evento='grind_cosmetico_equipado')
    ),
    'expedicao', jsonb_build_object(
      'usuarios', (select count(distinct user_id) from ev where evento='expedicao_iniciada'),
      'pct_dos_grinders', (select case when (select n from usu_grind) = 0 then 0
        else round(100.0 * (select count(distinct user_id) from ev where evento='expedicao_iniciada') / (select n from usu_grind)) end),
      'corridas', (select count(*) from ev where evento='expedicao_iniciada'),
      'fase_final_hist', coalesce((select jsonb_agg(jsonb_build_object('k', fase::text, 'v', q) order by fase) from fases), '[]'::jsonb),
      'escolhas_continuar', (select count(*) from ev where evento='expedicao_escolha' and props->>'escolha'='continuar'),
      'escolhas_recuar', (select count(*) from ev where evento='expedicao_escolha' and props->>'escolha'='recuar'),
      'taxa_continuar', (select case when count(*)=0 then 0
        else round(100.0 * count(*) filter (where props->>'escolha'='continuar') / count(*)) end
        from ev where evento='expedicao_escolha'),
      'mortes', (select count(*) from ev where evento='expedicao_fim' and (props->>'morreu')::boolean),
      'recuos', (select count(*) from ev where evento='expedicao_fim' and not coalesce((props->>'morreu')::boolean, false))
    ),
    -- 🗺️ Jornada de Treino
    'jornada', jsonb_build_object(
      -- onde os jogadores ESTÃO (faixas de fase das partidas do passivo — a parede real)
      'fase_hist', coalesce((select jsonb_agg(jsonb_build_object('k', 'F'||f0||'-'||(f0+4), 'v', q) order by f0) from jfases), '[]'::jsonb),
      -- a alavanca: escolhas de modo (avançar × farm)
      'modo_avancar', (select count(*) from ev where evento='jornada_modo' and props->>'modo'='avancar'),
      'modo_farm', (select count(*) from ev where evento='jornada_modo' and props->>'modo'='farm'),
      -- skills: adoção e volume
      'skills_usuarios', (select count(distinct user_id) from ev where evento='skill_comprada'),
      'skills_compradas', (select count(*) from ev where evento='skill_comprada'),
      'skills_respecs', (select count(*) from ev where evento='skill_respec'),
      -- funil do Desafio: tentativas × regiões conquistadas (por gate)
      'desafio_tentativas', (select count(*) from ev where evento='expedicao_iniciada' and props ? 'gate'),
      'regioes_conquistadas', coalesce((select jsonb_agg(jsonb_build_object('k', gate, 'v', q) order by gate::int)
        from (select props->>'gate' gate, count(*) q from ev where evento='jornada_regiao_conquistada' and props ? 'gate' group by 1) z), '[]'::jsonb),
      'conquistas_total', (select count(*) from ev where evento='jornada_regiao_conquistada')
    )
  );
$$;
revoke execute on function public.admin_grind(integer) from public;
grant execute on function public.admin_grind(integer) to service_role;

-- >>>>>>>>>>>>>>>>>>>> 021_admin_casa.sql >>>>>>>>>>>>>>>>>>>>
-- 🛠️ Admin — Gaming House. Função NOVA (admin_casa): distribuição de uso por estação
-- (detecta estação morta), taxa de burnout (se alta demais, a fadiga está cruel —
-- recalibrar), adoção do Foco da Semana, tipos de stream e análises de adversário.

create or replace function public.admin_casa(dias integer default 30)
returns jsonb language sql stable security definer set search_path = public as $$
  with ev as (select user_id, evento, props, created_at from public.telemetria_eventos
              where dias=0 or created_at >= now()-make_interval(days => dias)),
  sess as (select user_id, props->>'estacao' estacao, props->>'intensidade' intensidade
           from ev where evento='sessao_treino'),
  usu_sess as (select count(distinct user_id) n from sess)
  select jsonb_build_object(
    -- estação morta aparece aqui (uso por estação)
    'estacao_hist', coalesce((select jsonb_agg(jsonb_build_object('k', coalesce(estacao,'?'), 'v', q) order by q desc)
      from (select estacao, count(*) q from sess group by 1) z), '[]'::jsonb),
    'intensidade_hist', coalesce((select jsonb_agg(jsonb_build_object('k', coalesce(intensidade,'?'), 'v', q) order by q desc)
      from (select intensidade, count(*) q from sess group by 1) z), '[]'::jsonb),
    'sessoes_total', (select count(*) from sess),
    'usuarios', (select n from usu_sess),
    -- fadiga cruel? % dos treinadores que ENTRARAM em burnout no período
    'burnout_usuarios', (select count(distinct user_id) from ev where evento='burnout_entrou'),
    'burnout_taxa', (select case when (select n from usu_sess) = 0 then 0
      else round(100.0 * (select count(distinct user_id) from ev where evento='burnout_entrou') / (select n from usu_sess)) end),
    -- adoção do Foco da Semana (o loop de especialização fecha?)
    'foco_usuarios', (select count(distinct user_id) from ev where evento='foco_semana_definido'),
    'foco_pct', (select case when (select n from usu_sess) = 0 then 0
      else round(100.0 * (select count(distinct user_id) from ev where evento='foco_semana_definido') / (select n from usu_sess)) end),
    -- stream: qual tipo o povo escolhe
    'stream_tipos', coalesce((select jsonb_agg(jsonb_build_object('k', coalesce(tipo,'?'), 'v', q) order by q desc)
      from (select props->>'tipo' tipo, count(*) q from ev where evento='stream_tipo' group by 1) z), '[]'::jsonb),
    -- a joia: quantos estudam o adversário
    'analises', (select count(*) from ev where evento='analise_adversario_usada')
  );
$$;
revoke execute on function public.admin_casa(integer) from public;
grant execute on function public.admin_casa(integer) to service_role;
