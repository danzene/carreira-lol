import { MercadoPagoConfig, Payment, WebhookSignatureValidator } from "mercadopago";

// 💠 Integração Mercado Pago (Pix) — SÓ SERVIDOR. O Access Token (MP_ACCESS_TOKEN)
// nunca é NEXT_PUBLIC → nunca entra no bundle do cliente. Importe só em Route Handlers.

function token(): string | null {
  return process.env.MP_ACCESS_TOKEN || null;
}

export function mpConfigurado(): boolean {
  return Boolean(token());
}

function cliente(): Payment | null {
  const t = token();
  if (!t) return null;
  return new Payment(new MercadoPagoConfig({ accessToken: t }));
}

export interface PixCriado {
  mpPaymentId: string;
  qrCode: string; // "copia e cola"
  qrCodeBase64: string; // imagem do QR (base64, sem prefixo data:)
  ticketUrl: string | null;
  status: string;
}

// Cria uma cobrança Pix. `pedidoId` vira o external_reference (liga o pagamento
// ao nosso pedido) e a chave de idempotência (retry não duplica cobrança).
export async function criarPagamentoPix(params: {
  valorCentavos: number;
  descricao: string;
  email: string;
  pedidoId: string;
}): Promise<PixCriado | null> {
  const payment = cliente();
  if (!payment) return null;

  const res = await payment.create({
    body: {
      transaction_amount: Number((params.valorCentavos / 100).toFixed(2)),
      description: params.descricao,
      payment_method_id: "pix",
      payer: { email: params.email },
      external_reference: params.pedidoId,
    },
    requestOptions: { idempotencyKey: params.pedidoId },
  });

  const tx = res.point_of_interaction?.transaction_data;
  if (!res.id || !tx?.qr_code) return null;
  return {
    mpPaymentId: String(res.id),
    qrCode: tx.qr_code,
    qrCodeBase64: tx.qr_code_base64 ?? "",
    ticketUrl: tx.ticket_url ?? null,
    status: res.status ?? "pending",
  };
}

export interface PagamentoMP {
  status: string; // approved | pending | rejected | cancelled | refunded ...
  valorCentavos: number;
  pedidoRef: string | null; // external_reference = nosso pedido.id
}

// Busca a VERDADE do pagamento no MP (nunca confia no corpo do webhook).
export async function buscarPagamento(mpPaymentId: string): Promise<PagamentoMP | null> {
  const payment = cliente();
  if (!payment) return null;
  const res = await payment.get({ id: mpPaymentId });
  if (!res.id) return null;
  return {
    status: res.status ?? "unknown",
    valorCentavos: Math.round((res.transaction_amount ?? 0) * 100),
    pedidoRef: res.external_reference ?? null,
  };
}

// Valida a assinatura HMAC do webhook (lança InvalidWebhookSignatureError se falhar).
// Sem MP_WEBHOOK_SECRET, retorna false (fail-closed) em vez de aceitar cego.
export function assinaturaWebhookValida(params: {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string | null;
}): boolean {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) return false;
  try {
    WebhookSignatureValidator.validate({
      xSignature: params.xSignature,
      xRequestId: params.xRequestId,
      dataId: params.dataId,
      secret,
      toleranceSeconds: 300, // mitiga replay
    });
    return true;
  } catch {
    return false;
  }
}
