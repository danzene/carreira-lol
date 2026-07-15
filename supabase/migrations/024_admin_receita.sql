-- 💵 Admin: receita real (pedidos pagos). Chamada pelo servidor com service_role,
-- só depois do requireAdmin(). Valores em CENTAVOS (o cliente formata em R$).

create or replace function public.admin_receita(dias integer default 30)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with ped as (
    select produto, valor_centavos, created_at
      from public.pedidos
     where status = 'aprovado'
       and created_at >= now() - make_interval(days => dias)
  )
  select jsonb_build_object(
    'total_centavos', coalesce((select sum(valor_centavos) from ped), 0),
    'pedidos', (select count(*) from ped),
    'por_dia', coalesce((
      select jsonb_agg(jsonb_build_object('dia', d, 'v', v) order by d)
        from (select to_char(created_at, 'YYYY-MM-DD') d, sum(valor_centavos) v from ped group by 1) x
    ), '[]'::jsonb),
    'por_produto', coalesce((
      select jsonb_agg(jsonb_build_object('k', produto, 'v', v) order by v desc)
        from (select produto, sum(valor_centavos) v from ped group by 1) y
    ), '[]'::jsonb)
  );
$$;

revoke execute on function public.admin_receita(integer) from public;
revoke execute on function public.admin_receita(integer) from anon;
revoke execute on function public.admin_receita(integer) from authenticated;
grant execute on function public.admin_receita(integer) to service_role;
