import { requireUser } from "@/lib/userAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { produto } from "@/lib/produtos";
import { criarPreferencia, mpConfigurado } from "@/lib/mercadopago";

// POST /api/loja/checkout — cria um pedido (server-authoritative) e uma preferência
// de Checkout Pro (Pix + cartão). Body: { produto: "<id do catálogo>" }. O cliente
// NUNCA manda o preço — o valor vem do catálogo no servidor. O passe premium NÃO passa
// por aqui (é assinatura recorrente → /api/loja/assinar).

export const runtime = "nodejs";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export async function POST(req: Request): Promise<Response> {
  const auth = await requireUser(req);
  if ("erro" in auth) return auth.erro;
  const { userId, email } = auth.ctx;

  if (!mpConfigurado()) return json({ error: "pagamento_nao_configurado" }, 503);
  if (!email) return json({ error: "sem_email" }, 400); // o MP exige e-mail do pagador

  let corpo: { produto?: string };
  try {
    corpo = await req.json();
  } catch {
    return json({ error: "body_invalido" }, 400);
  }

  const p = corpo.produto ? produto(corpo.produto) : null;
  if (!p) return json({ error: "produto_invalido" }, 400);
  if (p.concedePasse) return json({ error: "use_assinatura" }, 400); // passe = /api/loja/assinar

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
      concede_passe: false,
      status: "pendente",
    })
    .select("id")
    .single();
  if (erroPedido || !pedido) return json({ error: "falha_criar_pedido" }, 500);

  // 2) cria a preferência de Checkout Pro (página do MP com Pix + cartão)
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const baseUrl = host ? `${proto}://${host}` : new URL(req.url).origin;
  let pref = null;
  let detalhe = "";
  try {
    pref = await criarPreferencia({
      produtoId: p.id,
      nome: `Carreira LoL — ${p.nome}`,
      valorCentavos: p.valorCentavos,
      email,
      pedidoId: pedido.id,
      baseUrl,
    });
  } catch (e) {
    detalhe = e instanceof Error ? e.message : String(e);
    console.error("checkout criarPreferencia falhou:", detalhe);
  }
  if (!pref) {
    await admin.from("pedidos").update({ status: "erro", updated_at: new Date().toISOString() }).eq("id", pedido.id);
    return json({ error: "falha_checkout", detalhe }, 502);
  }

  return json({ pedidoId: pedido.id, produto: p.id, nome: p.nome, valorCentavos: p.valorCentavos, initPoint: pref.initPoint });
}
