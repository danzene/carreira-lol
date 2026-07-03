import { rotaAdmin } from "@/lib/adminHandler";
import { validarAcao, type PayloadAcao } from "@/lib/adminAcoes";

export const dynamic = "force-dynamic";

// POST — executa UMA ação auditada. O `motivo` é gravado no admin_audit_log pela
// própria função SQL (transação atômica: ação + log). ctx.userId = admin autor.
export const POST = rotaAdmin(async (admin, ctx, req) => {
  const body = (await req.json().catch(() => ({}))) as Partial<PayloadAcao>;
  const erro = validarAcao(body);
  if (erro) throw new Error(erro);
  const p = body as PayloadAcao;

  switch (p.acao) {
    case "ajustar_coinpoints": {
      const { data, error } = await admin.rpc("admin_ajustar_coinpoints", { p_admin: ctx.userId, p_alvo: p.alvo, p_delta: p.delta, p_motivo: p.motivo });
      if (error) throw error;
      return { ok: true, saldo: data };
    }
    case "flag":
    case "unflag": {
      const { error } = await admin.rpc("admin_set_flag", { p_admin: ctx.userId, p_alvo: p.alvo, p_ativo: p.acao === "flag", p_motivo: p.motivo });
      if (error) throw error;
      return { ok: true };
    }
    case "ban":
    case "unban": {
      const { error } = await admin.rpc("admin_set_ban", { p_admin: ctx.userId, p_alvo: p.alvo, p_ativo: p.acao === "ban", p_motivo: p.motivo });
      if (error) throw error;
      return { ok: true };
    }
    case "invalidar_prova":
    case "revalidar_prova": {
      const { error } = await admin.rpc("admin_invalidar_prova", { p_admin: ctx.userId, p_alvo: p.alvo, p_semana: p.semana, p_ativo: p.acao === "invalidar_prova", p_motivo: p.motivo });
      if (error) throw error;
      return { ok: true };
    }
    default:
      throw new Error("Ação desconhecida.");
  }
});
