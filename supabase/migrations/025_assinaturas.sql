-- 🔁 Assinatura recorrente do Passe Premium (cartão via Mercado Pago PreApproval).
-- Cobra R$9,90/mês até cancelar. O premium passa a ter VALIDADE: fica ativo enquanto
-- a assinatura paga; quando não renova (cancelou/falhou), expira sozinho.
-- Rode no Supabase: SQL Editor → cole → Run. Idempotente.

create table if not exists public.assinaturas (
  user_id uuid primary key references auth.users (id) on delete cascade,
  mp_preapproval_id text unique,
  status text not null default 'pendente',   -- pendente|autorizada|pausada|cancelada
  proximo_pagamento timestamptz,
  valor_centavos integer not null default 990,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.assinaturas enable row level security;

-- o cliente só LÊ a própria (pra mostrar status/data). Escrita é do servidor.
grant select on public.assinaturas to authenticated;

drop policy if exists "assinaturas: ler a propria" on public.assinaturas;
create policy "assinaturas: ler a propria" on public.assinaturas
  for select to authenticated using (auth.uid() = user_id);

-- premium com VALIDADE: ativo enquanto now() < premium_ate. Só o servidor escreve.
alter table public.battle_pass add column if not exists premium_ate timestamptz;
revoke update (premium_ate) on public.battle_pass from authenticated;

-- ativa/estende o premium até p_ate (SÓ service_role, chamado pelo webhook).
create or replace function public.ativar_premium(p_user_id uuid, p_ate timestamptz)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.battle_pass (user_id, premium_ate) values (p_user_id, p_ate)
    on conflict (user_id) do update set premium_ate = excluded.premium_ate;
end;
$$;
revoke execute on function public.ativar_premium(uuid, timestamptz) from public;
revoke execute on function public.ativar_premium(uuid, timestamptz) from anon;
revoke execute on function public.ativar_premium(uuid, timestamptz) from authenticated;
grant execute on function public.ativar_premium(uuid, timestamptz) to service_role;
