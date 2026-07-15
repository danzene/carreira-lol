import { requireUser } from "@/lib/userAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { creditarSePago } from "@/lib/creditarPedido";

// GET /api/loja/pedido/[id] — o cliente consulta enquanto o QR está na tela.
// Se ainda pendente, tenta confirmar direto no MP (fallback caso o webhook atrase).
// Só o dono do pedido lê.

export const runtime = "nodejs";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export async function GET(req: Request, { params }: { params: { id: string } }): Promise<Response> {
  const auth = await requireUser(req);
  if ("erro" in auth) return auth.erro;

  const admin = getSupabaseAdmin();
  if (!admin) return json({ error: "backend" }, 503);

  const { data: pedido } = await admin
    .from("pedidos")
    .select("id, user_id, status, mp_payment_id")
    .eq("id", params.id)
    .maybeSingle();
  if (!pedido || pedido.user_id !== auth.ctx.userId) return json({ error: "nao_encontrado" }, 404);

  // fallback: ainda não aprovado? tenta confirmar no MP agora
  if (pedido.status !== "aprovado" && pedido.mp_payment_id) {
    await creditarSePago(admin, pedido.mp_payment_id);
    const { data: fresco } = await admin.from("pedidos").select("status").eq("id", pedido.id).maybeSingle();
    return json({ status: fresco?.status ?? pedido.status });
  }

  return json({ status: pedido.status });
}
