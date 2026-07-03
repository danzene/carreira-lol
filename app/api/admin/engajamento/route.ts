import { diasDoReq, rotaAdmin } from "@/lib/adminHandler";

export const dynamic = "force-dynamic";

export const GET = rotaAdmin(async (admin, _ctx, req) => {
  const { data, error } = await admin.rpc("admin_engajamento", { dias: diasDoReq(req) });
  if (error) throw error;
  return data;
});
