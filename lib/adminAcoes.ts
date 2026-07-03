// 🛡️ Ações administrativas — catálogo + validação. Regra 2/3: NENHUMA ação sem
// motivo (é gravado no admin_audit_log pela função SQL). Aqui validamos ANTES de
// bater no servidor (a função SQL também recusa motivo vazio — defesa em profundidade).

export type AcaoAdmin = "ajustar_coinpoints" | "flag" | "unflag" | "ban" | "unban" | "invalidar_prova" | "revalidar_prova";

export const ROTULO_ACAO: Record<AcaoAdmin, string> = {
  ajustar_coinpoints: "Ajustar CoinPoints",
  flag: "Sinalizar suspeita",
  unflag: "Remover sinalização",
  ban: "Banir conta",
  unban: "Desbanir conta",
  invalidar_prova: "Invalidar score de prova",
  revalidar_prova: "Revalidar score de prova",
};

export interface PayloadAcao {
  acao: AcaoAdmin;
  alvo: string; // user_id
  motivo: string;
  delta?: number; // ajustar_coinpoints
  semana?: number; // (in)validar_prova
}

// Retorna null se ok, ou uma mensagem de erro. Motivo é SEMPRE obrigatório.
export function validarAcao(p: Partial<PayloadAcao>): string | null {
  if (!p.acao) return "Ação inválida.";
  if (!p.alvo) return "Alvo não informado.";
  if (!p.motivo || p.motivo.trim().length < 3) return "Motivo obrigatório (mín. 3 caracteres) — vai pro log de auditoria.";
  if (p.acao === "ajustar_coinpoints") {
    if (typeof p.delta !== "number" || !Number.isFinite(p.delta) || p.delta === 0) return "Informe um delta de CoinPoints diferente de zero.";
  }
  if ((p.acao === "invalidar_prova" || p.acao === "revalidar_prova") && (typeof p.semana !== "number" || !Number.isFinite(p.semana))) {
    return "Informe a semana da prova.";
  }
  return null;
}
