import { getSupabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { exportarTudo, importarTudo, type Slot } from "./saves";

// Sincroniza os saves locais (namespaceados por usuário) com a tabela user_saves.

export async function puxarDoCloud(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  try {
    const sb = getSupabase();
    const { data } = await sb.from("user_saves").select("data").maybeSingle();
    if (data && data.data) importarTudo(data.data as Record<string, Slot>);
  } catch {
    // sem conexão ou sem linha ainda — segue com o cache local
  }
}

let timer: ReturnType<typeof setTimeout> | null = null;

// Agenda o envio (debounced) — chamado a cada gravação local.
export function agendarPush(): void {
  if (!isSupabaseConfigured()) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void empurrar(), 1500);
}

async function empurrar(): Promise<void> {
  try {
    const sb = getSupabase();
    const { data: u } = await sb.auth.getUser();
    if (!u.user) return;
    await sb.from("user_saves").upsert({
      user_id: u.user.id,
      data: exportarTudo(),
      updated_at: new Date().toISOString(),
    });
  } catch {
    // falha de rede — tenta de novo no próximo save
  }
}
