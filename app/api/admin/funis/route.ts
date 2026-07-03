import { diasDoReq, rotaAdmin } from "@/lib/adminHandler";

export const dynamic = "force-dynamic";

export const GET = rotaAdmin(async (admin, _ctx, req) => {
  const dias = diasDoReq(req);
  const [onb, prog, aband, ritual] = await Promise.all([
    admin.rpc("admin_funil_onboarding"),
    admin.rpc("admin_funil_progressao"),
    admin.rpc("admin_abandono"),
    admin.rpc("admin_ritual", { dias }),
  ]);
  for (const r of [onb, prog, aband, ritual]) if (r.error) throw r.error;
  return { onboarding: onb.data ?? [], progressao: prog.data ?? [], abandono: aband.data, ritual: ritual.data };
});
