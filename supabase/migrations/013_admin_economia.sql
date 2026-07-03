-- 🛠️ Admin Fase 3 — Economia + engajamento. Agregação no Postgres.
-- Fonte da economia: evento `coinpoints` {delta, motivo, saldo} (best-effort).

-- ---- economia: fluxo diário criado vs destruído, por motivo, saldos ----
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

-- ---- gacha: puxadas/dia, raridade OBSERVADA (por carta) e pity no 5★ ----
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
    'partidas_por_modo', coalesce((select jsonb_agg(jsonb_build_object('k', coalesce(props->>'modo','?'), 'v', c) order by c desc)
      from (select props->>'modo' modo, count(*) c from ev where evento='partida_fim' group by 1) z), '[]'::jsonb),
    'cartoes_por_tipo', coalesce((select jsonb_agg(jsonb_build_object('k', coalesce(props->>'tipo','?'), 'v', c) order by c desc)
      from (select props->>'tipo' tipo, count(*) c from ev where evento='cartao_compartilhado' group by 1) z), '[]'::jsonb),
    'duelos', (select count(*) from ev where evento='duelo_fim'),
    'provas', (select count(*) from ev where evento='prova_fim'),
    'passe_niveis', coalesce((select jsonb_agg(jsonb_build_object('k', nivel::text, 'v', q) order by nivel)
      from (select least(60, floor(coalesce((estado->>'pp')::int,0)/100.0)+1)::int nivel, count(*) q from public.battle_pass group by 1) z), '[]'::jsonb)
  );
$$;
revoke execute on function public.admin_engajamento(integer) from public;
