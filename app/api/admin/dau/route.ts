import { diasDoReq, rotaAdmin } from "@/lib/adminHandler";

export const dynamic = "force-dynamic";

// DAU por dia (sanidade ponta a ponta). Agregação no Postgres (admin_dau).
export const GET = rotaAdmin(async (admin, _ctx, req) => {
  const { data, error } = await admin.rpc("admin_dau", { dias: diasDoReq(req) || 3650 });
  if (error) throw error;
  return { serie: data ?? [] };
});
