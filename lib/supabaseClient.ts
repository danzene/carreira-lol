import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase — INFRA PRONTA, AINDA NÃO USADA.
 *
 * O banco existe mas está vazio (sem schema). Este helper será consumido quando
 * implementarmos uma feature de nuvem (ex.: login + salvar a carreira na conta).
 * Até lá, o save do jogo continua em localStorage.
 *
 * Singleton preguiçoso: só cria o cliente quando alguém chama getSupabase(),
 * e dá um erro claro se as variáveis de ambiente não estiverem configuradas.
 */
let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Supabase não configurado: defina NEXT_PUBLIC_SUPABASE_URL e " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY no .env.local (e nas Environment Variables do Vercel).",
    );
  }

  client = createClient(url, anonKey);
  return client;
}

/** true se as variáveis do Supabase estão presentes (pra UI checar antes de usar). */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
