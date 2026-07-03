import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { requireAdmin, type AdminCtx } from "./adminAuth";

// Embrulho pra Route Handlers admin: requireAdmin() → executa a função com o cliente
// service-role e o ctx → serializa. Erros viram 500. GET por padrão.
export function rotaAdmin(
  fn: (admin: SupabaseClient, ctx: AdminCtx, req: Request) => Promise<unknown>,
): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    const r = await requireAdmin(req);
    if ("erro" in r) return r.erro;
    try {
      const dados = await fn(getSupabaseAdmin()!, r.ctx, req);
      return Response.json(dados);
    } catch (e) {
      return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
    }
  };
}

// Período global (7/14/30 dias; 0 = tudo) vindo do ?dias=. Default 30.
export function diasDoReq(req: Request): number {
  const d = Number(new URL(req.url).searchParams.get("dias"));
  return Number.isFinite(d) && d >= 0 ? d : 30;
}
