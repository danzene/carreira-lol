import { rotaAdmin } from "@/lib/adminHandler";

export const dynamic = "force-dynamic";

// GET — lê TODA a config de live-ops (admin vê inclusive chaves não públicas).
export const GET = rotaAdmin(async (admin) => {
  const { data, error } = await admin.from("app_config").select("chave, valor, publica, updated_at").order("chave");
  if (error) throw error;
  return data ?? [];
});

// POST { chave, valor, motivo } — grava via admin_set_config (audita; só chave existente).
export const POST = rotaAdmin(async (admin, ctx, req) => {
  const body = (await req.json().catch(() => ({}))) as { chave?: string; valor?: unknown; motivo?: string };
  if (!body.chave) throw new Error("Chave não informada.");
  if (!body.motivo || body.motivo.trim().length < 3) throw new Error("Motivo obrigatório (mín. 3 caracteres).");
  const { error } = await admin.rpc("admin_set_config", { p_admin: ctx.userId, p_chave: body.chave, p_valor: body.valor ?? {}, p_motivo: body.motivo });
  if (error) throw error;
  return { ok: true };
});
