import { diasDoReq, rotaAdmin } from "@/lib/adminHandler";

export const dynamic = "force-dynamic";

export const GET = rotaAdmin(async (admin, _ctx, req) => {
  const dias = diasDoReq(req);
  const [eng, grind, casa] = await Promise.all([
    admin.rpc("admin_engajamento", { dias }),
    admin.rpc("admin_grind", { dias }),
    admin.rpc("admin_casa", { dias }),
  ]);
  if (eng.error) throw eng.error;
  // grind/casa tolerantes a erro (migration ainda não rodada → a seção some, o resto funciona)
  return {
    ...(eng.data as Record<string, unknown>),
    grind: grind.error ? null : grind.data,
    casa: casa.error ? null : casa.data,
  };
});
