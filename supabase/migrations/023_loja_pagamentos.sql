-- 💳 Loja de pagamentos (Mercado Pago / Pix) — tudo server-authoritative.
-- O cliente NUNCA credita moeda comprada nem liga o premium: quem faz isso é o
-- servidor (service_role) DEPOIS que o webhook do Mercado Pago confirma o pagamento.
-- Rode no Supabase: SQL Editor → New query → cole → Run. Idempotente.

-- ── Pedidos: a fonte da verdade de cada compra ──────────────────────────────
create table if not exists public.pedidos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  produto text not null,                 -- chave do catálogo (lib/produtos.ts)
  valor_centavos integer not null check (valor_centavos > 0),
  moedas integer not null default 0 check (moedas >= 0),
  concede_passe boolean not null default false,
  status text not null default 'pendente'
    check (status in ('pendente','aprovado','expirado','cancelado','erro')),
  mp_payment_id text unique,             -- id do pagamento no Mercado Pago (idempotência)
  creditado_at timestamptz,              -- trava: crédito acontece UMA vez só
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.pedidos enable row level security;

-- o cliente SÓ LÊ os próprios pedidos (pra saber se o Pix caiu — polling do QR).
-- NUNCA escreve: criação e mudança de status são do servidor (service_role ignora RLS).
grant select on public.pedidos to authenticated;

drop policy if exists "pedidos: ler os proprios" on public.pedidos;
create policy "pedidos: ler os proprios" on public.pedidos
  for select to authenticated using (auth.uid() = user_id);

create index if not exists pedidos_user_idx on public.pedidos (user_id, created_at desc);
create index if not exists pedidos_mp_idx on public.pedidos (mp_payment_id);
create index if not exists pedidos_status_idx on public.pedidos (status, created_at desc);

-- ── Passe premium AUTORITATIVO ──────────────────────────────────────────────
-- Hoje o premium mora no jsonb `estado` (que o cliente sobrescreve no upsert →
-- burlável). Passa a morar numa COLUNA que só o servidor liga. O cliente lê no
-- load, mas o UPDATE dessa coluna é revogado (o upsert dele nunca a inclui).
alter table public.battle_pass add column if not exists premium boolean not null default false;
revoke update (premium) on public.battle_pass from authenticated;

-- ── Crédito da compra (SÓ service_role, chamado pelo webhook) ────────────────
-- Incrementa moedas de forma ATÔMICA (evita lost-update se duas compras caírem
-- juntas) e liga o premium. NUNCA exposto ao cliente (auth/anon revogados).
create or replace function public.creditar_compra(p_user_id uuid, p_moedas integer, p_premium boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_moedas > 0 then
    update public.profiles set coinpoints = coinpoints + p_moedas where id = p_user_id;
  end if;
  if p_premium then
    insert into public.battle_pass (user_id, premium) values (p_user_id, true)
      on conflict (user_id) do update set premium = true;
  end if;
end;
$$;
revoke execute on function public.creditar_compra(uuid, integer, boolean) from public;
revoke execute on function public.creditar_compra(uuid, integer, boolean) from anon;
revoke execute on function public.creditar_compra(uuid, integer, boolean) from authenticated;
grant execute on function public.creditar_compra(uuid, integer, boolean) to service_role;
