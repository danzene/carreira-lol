import { requireUser } from "@/lib/userAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { sincronizarAssinatura } from "@/lib/aplicarAssinatura";

// GET /api/loja/assinatura — status da assinatura do usuário + validade do premium.
// Re-sincroniza com o MP (fallback pras renovações mensais: ao abrir a loja, atualiza
// o premium_ate a partir do próximo pagamento real).

export const runtime = "nodejs";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export async function GET(req: Request): Promise<Response> {
  const auth = await requireUser(req);
  if ("erro" in auth) return auth.erro;
  const { userId } = auth.ctx;

  const admin = getSupabaseAdmin();
  if (!admin) return json({ error: "backend" }, 503);

  const { data: ass } = await admin
    .from("assinaturas")
    .select("mp_preapproval_id, status")
    .eq("user_id", userId)
    .maybeSingle();

  // re-sincroniza se houver assinatura ainda ativa (pega renovação/cancelamento)
  if (ass?.mp_preapproval_id && ass.status !== "cancelada") {
    await sincronizarAssinatura(admin, ass.mp_preapproval_id);
  }

  const { data: fresco } = await admin
    .from("assinaturas")
    .select("status, proximo_pagamento")
    .eq("user_id", userId)
    .maybeSingle();
  const { data: bp } = await admin.from("battle_pass").select("premium_ate").eq("user_id", userId).maybeSingle();

  const premiumAte = bp?.premium_ate ?? null;
  const ativo = premiumAte ? new Date(premiumAte) > new Date() : false;

  return json({
    status: fresco?.status ?? "nenhuma",
    proximoPagamento: fresco?.proximo_pagamento ?? null,
    premiumAte,
    premiumAtivo: ativo,
  });
}
