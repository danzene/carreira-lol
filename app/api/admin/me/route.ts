import { rotaAdmin } from "@/lib/adminHandler";

export const dynamic = "force-dynamic";

// Confirma que quem chama é admin (usado pelo layout pra liberar/redirect).
export const GET = rotaAdmin(async (admin, ctx) => {
  const { data } = await admin.from("profiles").select("nick, role").eq("id", ctx.userId).maybeSingle();
  return { admin: true, nick: data?.nick ?? null };
});
