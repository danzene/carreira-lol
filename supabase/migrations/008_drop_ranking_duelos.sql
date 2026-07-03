-- Fix do Security Advisor (CRITICAL): a view `ranking_duelos` era SECURITY DEFINER —
-- rodava com as permissões do criador, ignorando o RLS de quem consulta.
-- Ela ficou ÓRFÃ desde as temporadas do duelo (o ranking agora vem de
-- duel_snapshots.rating, com RLS normal). Remover resolve o alerta e limpa o schema.

drop view if exists public.ranking_duelos;
