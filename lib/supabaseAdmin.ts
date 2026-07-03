import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// 🔐 Cliente Supabase com SERVICE ROLE — SÓ SERVIDOR. A chave vem de
// SUPABASE_SERVICE_ROLE_KEY (NUNCA prefixada com NEXT_PUBLIC → nunca entra no bundle
// do cliente). Este módulo só deve ser importado por Route Handlers (app/api/admin/*).
// Bypassa RLS: por isso TODA rota admin chama requireAdmin() ANTES de usá-lo.

let admin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null; // sem service key → admin desabilitado (fail-closed)
  if (!admin) admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return admin;
}
