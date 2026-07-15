import { requireUser } from "@/lib/userAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { criarAssinatura } from "@/lib/assinatura";
import { mpConfigurado } from "@/lib/mercadopago";

// POST /api/loja/assinar — cria a assinatura recorrente do Passe Premium (cartão).
// Devolve o init_point (página do MP onde a pessoa põe o cartão e autoriza).

export const runtime = "nodejs";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export async function POST(req: Request): Promise<Response> {
  const auth = await requireUser(req);
  if ("erro" in auth) return auth.erro;
  const { userId, email } = auth.ctx;

  if (!mpConfigurado()) return json({ error: "pagamento_nao_configurado" }, 503);
  if (!email) return json({ error: "sem_email" }, 400);

  const admin = getSupabaseAdmin();
  if (!admin) return json({ error: "backend_nao_configurado" }, 503);

  const baseUrl = new URL(req.url).origin;
  let ass;
  try {
    ass = await criarAssinatura({ userId, email, baseUrl });
  } catch {
    ass = null;
  }
  if (!ass) return json({ error: "falha_assinatura" }, 502);

  // registra a assinatura como pendente (o webhook liga o premium quando autorizada)
  await admin.from("assinaturas").upsert(
    { user_id: userId, mp_preapproval_id: ass.preapprovalId, status: "pendente", updated_at: new Date().toISOString() },
    { onConflict: "user_id" },
  );

  return json({ initPoint: ass.initPoint });
}
