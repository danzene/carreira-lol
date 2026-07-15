import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { assinaturaWebhookValida } from "@/lib/mercadopago";
import { creditarSePago } from "@/lib/creditarPedido";

// POST /api/webhooks/mercadopago — o Mercado Pago chama aqui quando um pagamento muda.
// Valida a ASSINATURA, e o crédito (idempotente) fica no helper creditarSePago, que
// busca a verdade no MP. É o caminho que credita moeda comprada / liga o premium.

export const runtime = "nodejs";

function ok(body: unknown = { ok: true }, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export async function POST(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const dataIdQuery = url.searchParams.get("data.id");

  // assinatura (fail-closed: sem secret ou assinatura inválida → 401)
  const valida = assinaturaWebhookValida({
    xSignature: req.headers.get("x-signature"),
    xRequestId: req.headers.get("x-request-id"),
    dataId: dataIdQuery,
  });
  if (!valida) return ok({ error: "assinatura_invalida" }, 401);

  // tipo + id do pagamento (vem em query e/ou corpo)
  let corpo: { type?: string; action?: string; data?: { id?: string } } = {};
  try {
    corpo = await req.json();
  } catch {
    /* corpo vazio é ok — usamos a query */
  }
  const tipo = corpo.type ?? url.searchParams.get("type") ?? url.searchParams.get("topic");
  const paymentId = String(dataIdQuery ?? corpo.data?.id ?? "");
  if (tipo !== "payment" || !paymentId) return ok({ ignorado: true });

  const admin = getSupabaseAdmin();
  if (!admin) return ok({ error: "backend" }, 503);

  const r = await creditarSePago(admin, paymentId);
  // 500 só quando o crédito falhou de fato (pra MP reenviar); o resto é 200 (ack)
  if (r.estado === "erro" && r.motivo === "falha_credito") return ok(r, 500);
  return ok(r);
}
