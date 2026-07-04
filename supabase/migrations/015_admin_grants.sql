-- 🛠️ Admin Fase 4b — privilégios do service_role.
--
-- O painel usa a service role (SÓ no servidor, após requireAdmin) para:
--   (a) ler tabelas direto: profiles (checar o papel) e app_config (live-ops);
--   (b) executar as funções admin_* (todas com `revoke execute from public`).
--
-- Neste projeto o service_role estava SEM esses grants (provável efeito dos
-- ajustes do Security Advisor / do novo sistema de API keys). Sem eles o login
-- admin caía em 403 (permission denied). Concedemos aqui.
--
-- SEGURANÇA: isto NÃO enfraquece nada. A secret key vive só no servidor
-- (.env.local / Vercel), o service_role já bypassa RLS por natureza, e
-- anon/authenticated continuam sem acesso (o `revoke from public` segue valendo).

-- leitura direta das tabelas que o painel consulta fora de função
grant select on public.profiles to service_role;
grant select on public.app_config to service_role;
grant select, insert on public.admin_audit_log to service_role;

-- executar as funções de agregação/ação (que revogamos de public)
grant execute on all functions in schema public to service_role;

-- objetos futuros também acessíveis ao service_role (evita repetir isso depois)
alter default privileges in schema public grant execute on functions to service_role;
