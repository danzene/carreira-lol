import type { SupabaseClient } from "@supabase/supabase-js";
import { buscarAssinatura } from "./assinatura";

// 🔁 Sincroniza a assinatura com a verdade do Mercado Pago e ajusta o premium.
// Usado pelo webhook (evento subscription_preapproval) E pelo GET de status (fallback
// pras renovações mensais: toda vez que a pessoa abre a loja, re-sincroniza).

const MAP: Record<string, string> = {
  authorized: "autorizada",
  pending: "pendente",
  paused: "pausada",
  cancelled: "cancelada",
};
const GRACA_MS = 3 * 24 * 3600 * 1000; // 3 dias de tolerância após o próximo pagamento
const UM_MES_MS = 31 * 24 * 3600 * 1000;

export async function sincronizarAssinatura(admin: SupabaseClient, preapprovalId: string): Promise<string | null> {
  const a = await buscarAssinatura(preapprovalId);
  if (!a || !a.userRef) return null;

  const status = MAP[a.status] ?? "pendente";
  const prox = a.proximoPagamento ? new Date(a.proximoPagamento) : null;

  await admin.from("assinaturas").upsert(
    {
      user_id: a.userRef,
      mp_preapproval_id: preapprovalId,
      status,
      proximo_pagamento: prox ? prox.toISOString() : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  // premium ativo enquanto autorizada: validade = próximo pagamento + graça
  if (status === "autorizada") {
    const base = prox ?? new Date(Date.now() + UM_MES_MS);
    const ate = new Date(base.getTime() + GRACA_MS);
    await admin.rpc("ativar_premium", { p_user_id: a.userRef, p_ate: ate.toISOString() });
  }
  // cancelada/pausada: NÃO reduz premium_ate — segue válido até o período já pago acabar.

  return status;
}
