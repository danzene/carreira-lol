import { requireUser } from "@/lib/userAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { produto } from "@/lib/produtos";
import { criarPagamentoPix, mpConfigurado } from "@/lib/mercadopago";

// POST /api/loja/checkout — cria um pedido (server-authoritative) e a cobrança Pix
// no Mercado Pago. Body: { produto: "<id do catálogo>" }. O cliente NUNCA manda o
// preço — o valor vem do catálogo no servidor.

export const runtime = "nodejs";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export async function POST(req: Request): Promise<Response> {
  const auth = await requireUser(req);
  if ("erro" in auth) return auth.erro;
  const { userId, email } = auth.ctx;

  if (!mpConfigurado()) return json({ error: "pagamento_nao_configurado" }, 503);
  if (!email) return json({ error: "sem_email" }, 400); // Pix exige e-mail do pagador

  let corpo: { produto?: string };
  try {
    corpo = await req.json();
  } catch {
    return json({ error: "body_invalido" }, 400);
  }

  const p = corpo.produto ? produto(corpo.produto) : null;
  if (!p) return json({ error: "produto_invalido" }, 400);

  const admin = getSupabaseAdmin();
  if (!admin) return json({ error: "backend_nao_configurado" }, 503);

  // 1) cria o pedido pendente (fonte da verdade; id vira external_reference no MP)
  const { data: pedido, error: erroPedido } = await admin
    .from("pedidos")
    .insert({
      user_id: userId,
      produto: p.id,
      valor_centavos: p.valorCentavos,
      moedas: p.moedas,
      concede_passe: p.concedePasse,
      status: "pendente",
    })
    .select("id")
    .single();
  if (erroPedido || !pedido) return json({ error: "falha_criar_pedido" }, 500);

  // 2) cria a cobrança Pix no Mercado Pago
  let pix;
  try {
    pix = await criarPagamentoPix({
      valorCentavos: p.valorCentavos,
      descricao: `Carreira LoL — ${p.nome}`,
      email,
      pedidoId: pedido.id,
    });
  } catch {
    pix = null;
  }
  if (!pix) {
    await admin.from("pedidos").update({ status: "erro", updated_at: new Date().toISOString() }).eq("id", pedido.id);
    return json({ error: "falha_cobranca_pix" }, 502);
  }

  // 3) guarda o id do pagamento MP no pedido (o webhook casa por ele)
  await admin
    .from("pedidos")
    .update({ mp_payment_id: pix.mpPaymentId, updated_at: new Date().toISOString() })
    .eq("id", pedido.id);

  return json({
    pedidoId: pedido.id,
    produto: p.id,
    nome: p.nome,
    valorCentavos: p.valorCentavos,
    qrCode: pix.qrCode,
    qrCodeBase64: pix.qrCodeBase64,
    ticketUrl: pix.ticketUrl,
  });
}
