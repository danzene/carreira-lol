-- Hardening do Security Advisor: funções SECURITY DEFINER não podem ser executáveis
-- por anon/public (por default o Postgres dá EXECUTE a PUBLIC em toda função).

-- ajustar_coinpoints: SÓ usuários logados (o fluxo autoritativo da moeda exige
-- authenticated — o warning "signed-in can execute" é o débito CONHECIDO da rodada
-- de monetização: mover a concessão pra Edge Function antes de dinheiro real).
revoke execute on function public.ajustar_coinpoints(integer, text) from public;
revoke execute on function public.ajustar_coinpoints(integer, text) from anon;
grant execute on function public.ajustar_coinpoints(integer, text) to authenticated;

-- rls_auto_enable: helper interno — NINGUÉM precisa executar manualmente.
revoke execute on function public.rls_auto_enable() from public;
revoke execute on function public.rls_auto_enable() from anon;
revoke execute on function public.rls_auto_enable() from authenticated;
