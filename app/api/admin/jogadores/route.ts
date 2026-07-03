import { rotaAdmin } from "@/lib/adminHandler";

export const dynamic = "force-dynamic";

// GET ?u=<uuid>  → ficha completa do jogador
// GET ?q=<termo> → busca por nick / e-mail / user_id
export const GET = rotaAdmin(async (admin, _ctx, req) => {
  const sp = new URL(req.url).searchParams;
  const u = sp.get("u");
  if (u) {
    const { data, error } = await admin.rpc("admin_ficha", { alvo: u });
    if (error) throw error;
    return data;
  }
  const q = (sp.get("q") ?? "").trim();
  if (!q) return [];
  const { data, error } = await admin.rpc("admin_buscar_jogador", { termo: q });
  if (error) throw error;
  return data ?? [];
});
