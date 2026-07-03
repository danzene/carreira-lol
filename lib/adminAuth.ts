import { getSupabaseAdmin } from "./supabaseAdmin";

// 🛡️ Autorização admin — o ÚNICO limite de segurança real do painel (middleware é só
// UX). Cada Route Handler admin chama requireAdmin() antes de tocar em qualquer dado.

// Decisão pura (testável): só 'admin' passa.
export function autorizarAdmin(role: string | null | undefined): boolean {
  return role === "admin";
}

export interface AdminCtx {
  userId: string;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

// Verifica o Bearer token (via service role) + o papel em profiles. Devolve o ctx OU
// uma Response de erro (401 sem/inválido, 403 não-admin, 503 admin não configurado).
export async function requireAdmin(req: Request): Promise<{ ctx: AdminCtx } | { erro: Response }> {
  const admin = getSupabaseAdmin();
  if (!admin) return { erro: json({ error: "admin_nao_configurado" }, 503) };

  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return { erro: json({ error: "sem_token" }, 401) };

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return { erro: json({ error: "token_invalido" }, 401) };

  const { data: perfil } = await admin.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
  if (!autorizarAdmin(perfil?.role)) return { erro: json({ error: "forbidden" }, 403) };

  return { ctx: { userId: data.user.id } };
}

// Registra uma ação administrativa no audit log (Regra 2: TUDO loga).
export async function registrarAuditoria(
  adminId: string,
  acao: string,
  alvoUserId: string | null,
  detalhe: Record<string, unknown> = {},
): Promise<void> {
  const admin = getSupabaseAdmin();
  if (!admin) return;
  await admin.from("admin_audit_log").insert({ admin_id: adminId, acao, alvo_user_id: alvoUserId, detalhe });
}
