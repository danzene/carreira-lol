import type { SupabaseClient } from "@supabase/supabase-js";
import { buscarPagamento, buscarPagamentoIdPorRef } from "./mercadopago";

// 💰 Crédito idempotente de um pagamento aprovado. Usado pelo WEBHOOK e pelo POLLING
// (fallback: se o webhook atrasar/falhar, o cliente consultando o pedido também
// dispara a confirmação). Recebe o client service_role. Credita UMA vez só via
// claim atômico (update ... where creditado_at is null).

export type ResultadoCredito =
  | { estado: "creditado" }
  | { estado: "ja_creditado" }
  | { estado: "pendente"; status: string }
  | { estado: "erro"; motivo: string };

const COLS = "id, user_id, moedas, concede_passe, valor_centavos, creditado_at";

export async function creditarSePago(admin: SupabaseClient, mpPaymentId: string): Promise<ResultadoCredito> {
  // a verdade vem do Mercado Pago, nunca do corpo do webhook
  const pago = await buscarPagamento(mpPaymentId);
  if (!pago) return { estado: "erro", motivo: "pagamento_nao_encontrado" };
  if (pago.status !== "approved") return { estado: "pendente", status: pago.status };

  // acha o pedido (por payment id; fallback pelo external_reference)
  let { data: pedido } = await admin.from("pedidos").select(COLS).eq("mp_payment_id", mpPaymentId).maybeSingle();
  if (!pedido && pago.pedidoRef) {
    ({ data: pedido } = await admin.from("pedidos").select(COLS).eq("id", pago.pedidoRef).maybeSingle());
  }
  if (!pedido) return { estado: "erro", motivo: "pedido_nao_encontrado" };

  // valor pago tem que cobrir o preço (guarda contra adulteração)
  if (pago.valorCentavos < pedido.valor_centavos) {
    await admin.from("pedidos").update({ status: "erro", updated_at: new Date().toISOString() }).eq("id", pedido.id);
    return { estado: "erro", motivo: "valor_insuficiente" };
  }

  // CLAIM atômico: só um caminho consegue setar creditado_at
  const { data: claim } = await admin
    .from("pedidos")
    .update({ creditado_at: new Date().toISOString(), mp_payment_id: mpPaymentId, updated_at: new Date().toISOString() })
    .eq("id", pedido.id)
    .is("creditado_at", null)
    .select("id")
    .maybeSingle();
  if (!claim) return { estado: "ja_creditado" };

  // credita (atômico no banco). Se falhar, libera o claim pra tentar de novo.
  const { error } = await admin.rpc("creditar_compra", {
    p_user_id: pedido.user_id,
    p_moedas: pedido.moedas,
    p_premium: pedido.concede_passe,
  });
  if (error) {
    await admin.from("pedidos").update({ creditado_at: null, updated_at: new Date().toISOString() }).eq("id", pedido.id);
    return { estado: "erro", motivo: "falha_credito" };
  }

  await admin.from("pedidos").update({ status: "aprovado", updated_at: new Date().toISOString() }).eq("id", pedido.id);
  return { estado: "creditado" };
}

// Confirma um pedido pelo ID DELE (external_reference), buscando o pagamento no MP.
// É o caminho do Checkout Pro (o pedido não guarda mp_payment_id de antemão). Usado
// pelo polling e pela auto-cura da loja — funciona sem depender do webhook.
export async function creditarPorRef(admin: SupabaseClient, pedidoId: string): Promise<ResultadoCredito> {
  const paymentId = await buscarPagamentoIdPorRef(pedidoId);
  if (!paymentId) return { estado: "pendente", status: "sem_pagamento" };
  return creditarSePago(admin, paymentId);
}
