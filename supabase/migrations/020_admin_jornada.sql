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
