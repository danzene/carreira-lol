import { diasDoReq, rotaAdmin } from "@/lib/adminHandler";

export const dynamic = "force-dynamic";

export const GET = rotaAdmin(async (admin, _ctx, req) => {
  const dias = diasDoReq(req);
  const [eco, gacha, itens, anom, receita] = await Promise.all([
    admin.rpc("admin_economia", { dias }),
    admin.rpc("admin_gacha", { dias }),
    admin.rpc("admin_itens", { dias }),
    admin.rpc("admin_anomalias"),
    admin.rpc("admin_receita", { dias }),
  ]);
  for (const r of [eco, gacha, itens, anom]) if (r.error) throw r.error;
  // receita é aditiva: se a função ainda não existe (migration 024 não rodada), não quebra
  return { economia: eco.data, gacha: gacha.data, itens: itens.data, anomalias: anom.data ?? [], receita: receita.error ? null : receita.data };
});
