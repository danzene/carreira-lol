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
