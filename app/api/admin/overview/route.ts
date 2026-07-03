import { diasDoReq, rotaAdmin } from "@/lib/adminHandler";

export const dynamic = "force-dynamic";

export const GET = rotaAdmin(async (admin, _ctx, req) => {
  const dias = diasDoReq(req);
  const [kpis, serie] = await Promise.all([admin.rpc("admin_kpis", { dias }), admin.rpc("admin_dau_novos", { dias })]);
  if (kpis.error) throw kpis.error;
  if (serie.error) throw serie.error;
  return { kpis: kpis.data, serie: serie.data ?? [] };
});
