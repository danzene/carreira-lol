-- 🛠️ Admin Fase 4 — Ficha de jogador, ações auditadas, integridade e live-ops.
--
-- TODAS as funções de mutação são SECURITY DEFINER, gravam no admin_audit_log na
-- MESMA transação (Regra 2: nada muda sem log com motivo) e exigem `motivo` não-vazio.
-- `revoke execute from public`: só a service role (após requireAdmin) chama.
--
-- Ajuste de saldo de OUTRA conta não cabe no ajustar_coinpoints (que opera no
-- auth.uid() do próprio jogador). Por isso admin_ajustar_coinpoints — mesma regra
-- (nunca UPDATE direto solto, sempre com motivo e via função controlada).

-- prova: marca de invalidação (preserva o score original em `detalhe`)
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

-- ---- ficha completa: perfil + save + inventário + passe + duelos + provas + eventos ----
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

-- ---- AÇÃO: ajustar CoinPoints de uma conta (nunca negativo; motivo obrigatório) ----
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

-- ---- AÇÃO: sinalizar/limpar suspeita ----
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

-- ---- AÇÃO: banir/desbanir. O JOGO checa banned_at no login/sync e bloqueia. ----
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

-- ---- AÇÃO: invalidar/revalidar score de prova (zera visível, preserva original) ----
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

-- ---- INTEGRIDADE: z-score dos scores de prova na semana (default = última) ----
-- Validação DEFINITIVA vem por Edge Function na rodada de monetização; aqui é triagem.
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

-- ---- INTEGRIDADE: winrates impossíveis de duelo (>=10 jogos e taxa >= 90%) ----
create or replace function public.admin_duelo_suspeitos()
returns table (user_id uuid, nick text, jogos bigint, vitorias bigint, taxa numeric)
language sql stable security definer set search_path = public as $$
  select user_id, nick, jogos, vitorias,
         case when jogos > 0 then round((vitorias::numeric / jogos), 3) else 0 end taxa
  from public.ranking_duelos
  where jogos >= 10 and vitorias::numeric / nullif(jogos, 0) >= 0.9
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

-- ---- LIVE-OPS: escrever config (audita; só atualiza chave existente) ----
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
