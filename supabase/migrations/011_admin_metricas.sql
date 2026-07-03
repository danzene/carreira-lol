-- 🛠️ Admin Fase 1 — Visão Geral + Retenção. Tudo UTC; agregação NO POSTGRES.
-- Definições (ver docs/admin-metricas.md):
--  • "dia" = dia-calendário UTC.
--  • "ativo no dia" p/ retenção = teve >=1 `sessao_inicio` naquele dia.
--  • coorte = semana (segunda) do PRIMEIRO sessao_inicio do usuário.
--  • sessão = eventos do mesmo usuário com gap < 30 min; duração = fim - início.

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

-- ---- retenção por coorte semanal (percentuais D1/D3/D7/D14/D30) ----
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

-- ---- duração de sessão por dia (p50/p75/p90) + histograma ----
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

-- ---- curva de sobrevivência: % de usuários que "chegaram" ao dia N ----
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
