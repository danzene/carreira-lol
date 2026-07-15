import { getSupabaseAdmin } from "./supabaseAdmin";

// 🔐 Autenticação de usuário comum (não-admin) para Route Handlers. Espelha o
// requireAdmin, mas sem checar papel: só confirma que há uma sessão válida e
// devolve o userId + email (o Pix do Mercado Pago exige um e-mail de pagador).

export interface UserCtx {
  userId: string;
  email: string | null;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export async function requireUser(req: Request): Promise<{ ctx: UserCtx } | { erro: Response }> {
  const admin = getSupabaseAdmin();
  if (!admin) return { erro: json({ error: "backend_nao_configurado" }, 503) };

  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return { erro: json({ error: "sem_token" }, 401) };

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return { erro: json({ error: "token_invalido" }, 401) };

  return { ctx: { userId: data.user.id, email: data.user.email ?? null } };
}
