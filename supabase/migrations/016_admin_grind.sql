-- 🛠️ Admin — adoção do Grind de Normais (camada idle, seção Endgame do Engajamento).
-- Dois números que dizem se a feature reteve ou virou ruído:
--   1) % dos ativos do dia que usaram o grind (qualquer evento grind_*)
--   2) distribuição de "horas até o teto" por usuário-dia (partidas × ~9min)

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
