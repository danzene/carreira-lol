import { rotaAdmin } from "@/lib/adminHandler";

export const dynamic = "force-dynamic";

// Log de auditoria: TODA ação administrativa vive aqui (Regra 2).
export const GET = rotaAdmin(async (admin, _ctx, req) => {
  const lim = Number(new URL(req.url).searchParams.get("lim"));
  const { data, error } = await admin.rpc("admin_auditoria", { lim: Number.isFinite(lim) && lim > 0 ? Math.min(lim, 500) : 100 });
  if (error) throw error;
  return data ?? [];
});
