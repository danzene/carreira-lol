import { PreApproval } from "mercadopago";
import { mpConfig } from "./mercadopago";

// 🔁 Assinatura recorrente do Passe Premium (cartão) — SÓ SERVIDOR. Usa a API de
// Assinaturas (PreApproval) do Mercado Pago: cobra todo mês no cartão até cancelar.

const VALOR_REAIS = 9.9; // R$ 9,90/mês

function pre(): PreApproval | null {
  const c = mpConfig();
  return c ? new PreApproval(c) : null;
}

export interface AssinaturaCriada {
  preapprovalId: string;
  initPoint: string; // URL onde a pessoa põe o cartão e autoriza
}

// Cria a assinatura (status pending). `userId` vira external_reference.
export async function criarAssinatura(params: {
  userId: string;
  email: string;
  baseUrl: string;
}): Promise<AssinaturaCriada | null> {
  const p = pre();
  if (!p) return null;
  const res = await p.create({
    body: {
      reason: "Passe Premium — Carreira LoL",
      external_reference: params.userId,
      payer_email: params.email,
      back_url: `${params.baseUrl}/loja?assinatura=ok`,
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: VALOR_REAIS,
        currency_id: "BRL",
      },
      status: "pending",
    },
  });
  if (!res.id || !res.init_point) return null;
  return { preapprovalId: String(res.id), initPoint: res.init_point };
}

export interface AssinaturaMP {
  status: string; // authorized | pending | paused | cancelled
  userRef: string | null; // external_reference = user_id
  proximoPagamento: string | null; // next_payment_date (ISO)
}

// Busca a verdade da assinatura no MP (usado pelo webhook).
export async function buscarAssinatura(preapprovalId: string): Promise<AssinaturaMP | null> {
  const p = pre();
  if (!p) return null;
  const res = await p.get({ id: preapprovalId });
  if (!res.id) return null;
  return {
    status: res.status ?? "unknown",
    userRef: res.external_reference ?? null,
    proximoPagamento: res.next_payment_date ?? null,
  };
}

// Cancela a assinatura no MP (para de cobrar). O premium segue válido até o fim do
// período já pago (premium_ate não é reduzido).
export async function cancelarAssinatura(preapprovalId: string): Promise<boolean> {
  const p = pre();
  if (!p) return false;
  try {
    await p.update({ id: preapprovalId, body: { status: "cancelled" } });
    return true;
  } catch {
    return false;
  }
}
