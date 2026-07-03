import { diasDoReq, rotaAdmin } from "@/lib/adminHandler";

export const dynamic = "force-dynamic";

export const GET = rotaAdmin(async (admin, _ctx, req) => {
  const dias = diasDoReq(req);
  const [coortes, sessoes, hist, sobrev] = await Promise.all([
    admin.rpc("admin_retencao_coortes"),
    admin.rpc("admin_sessoes", { dias }),
    admin.rpc("admin_sessoes_hist", { dias }),
    admin.rpc("admin_sobrevivencia"),
  ]);
  for (const r of [coortes, sessoes, hist, sobrev]) if (r.error) throw r.error;
  return { coortes: coortes.data ?? [], sessoes: sessoes.data ?? [], hist: hist.data ?? [], sobrev: sobrev.data ?? [] };
});
