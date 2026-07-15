-- 🔑 Garante que a role `service_role` (usada pelo servidor via SUPABASE_SERVICE_ROLE_KEY
-- / chave secreta) tem acesso total às tabelas. Em projetos com o NOVO sistema de chaves
-- do Supabase, tabelas criadas pelo SQL Editor às vezes NÃO recebem o grant automático
-- pra service_role → o servidor toma "permission denied for table X" ao inserir.
-- Idempotente. Rode no Supabase: SQL Editor → cole → Run.

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- tabelas/sequences futuras também
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
