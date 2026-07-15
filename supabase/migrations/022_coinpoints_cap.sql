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
