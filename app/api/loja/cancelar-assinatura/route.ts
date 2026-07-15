import { requireUser } from "@/lib/userAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { cancelarAssinatura } from "@/lib/assinatura";

// POST /api/loja/cancelar-assinatura — cancela a assinatura do usuário no MP (para de
// cobrar). O premium segue válido até o fim do período já pago (premium_ate não muda).

export const runtime = "nodejs";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export async function POST(req: Request): Promise<Response> {
  const auth = await requireUser(req);
  if ("erro" in auth) return auth.erro;
  const { userId } = auth.ctx;

  const admin = getSupabaseAdmin();
  if (!admin) return json({ error: "backend_nao_configurado" }, 503);

  const { data: ass } = await admin
    .from("assinaturas")
    .select("mp_preapproval_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!ass?.mp_preapproval_id) return json({ error: "sem_assinatura" }, 404);

  const ok = await cancelarAssinatura(ass.mp_preapproval_id);
  if (!ok) return json({ error: "falha_cancelar" }, 502);

  await admin
    .from("assinaturas")
    .update({ status: "cancelada", updated_at: new Date().toISOString() })
    .eq("user_id", userId);

  return json({ cancelada: true });
}
