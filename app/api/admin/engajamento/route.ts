import { diasDoReq, rotaAdmin } from "@/lib/adminHandler";

export const dynamic = "force-dynamic";

export const GET = rotaAdmin(async (admin, _ctx, req) => {
  const dias = diasDoReq(req);
  const [eng, grind] = await Promise.all([
    admin.rpc("admin_engajamento", { dias }),
    admin.rpc("admin_grind", { dias }),
  ]);
  if (eng.error) throw eng.error;
  // grind tolerante a erro (migration 016 ainda não rodada → seção some, resto funciona)
  return { ...(eng.data as Record<string, unknown>), grind: grind.error ? null : grind.data };
});
