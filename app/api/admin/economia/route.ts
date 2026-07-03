import { diasDoReq, rotaAdmin } from "@/lib/adminHandler";

export const dynamic = "force-dynamic";

export const GET = rotaAdmin(async (admin, _ctx, req) => {
  const dias = diasDoReq(req);
  const [eco, gacha, itens, anom] = await Promise.all([
    admin.rpc("admin_economia", { dias }),
    admin.rpc("admin_gacha", { dias }),
    admin.rpc("admin_itens", { dias }),
    admin.rpc("admin_anomalias"),
  ]);
  for (const r of [eco, gacha, itens, anom]) if (r.error) throw r.error;
  return { economia: eco.data, gacha: gacha.data, itens: itens.data, anomalias: anom.data ?? [] };
});
