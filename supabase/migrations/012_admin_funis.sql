-- 🛠️ Admin Fase 2 — Funis, ponto de abandono e ritual diário. Agregação no Postgres.
-- Passos de funil = distinct users que alcançaram cada etapa (contagem monotônica não
-- garantida por passo; é a leitura padrão de funil por evento). Detalhes em docs.

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
  -- `etapa` é uma CHAVE sem acento (o rótulo bonito vive no cliente, evitando
  -- corrupção de encoding no caminho SQL->banco).
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

-- ---- funil de progressão longa (usa feature_desbloqueada e passe_nivel) ----
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
  -- `etapa` = chave sem acento; rótulo bonito no cliente.
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

-- ---- ponto de abandono: contexto dos churned (inativos há 7+ dias) ----
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

-- ---- ritual diário: puxada grátis, streaks e escudos ----
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
