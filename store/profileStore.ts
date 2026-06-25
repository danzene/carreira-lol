import { create } from "zustand";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabaseClient";

// Perfil de conta (modo online — Fase A): nick + moldura + saldo de CoinPoints (POR CONTA).
// O saldo é a fonte da verdade no servidor; aqui guardamos um espelho pra UI.

export interface Perfil {
  nick: string;
  avatar_frame: string | null;
  coinpoints: number;
}

interface ProfileStore {
  perfil: Perfil | null;
  carregando: boolean;
  carregar: () => Promise<void>;
  criarPerfil: (nick: string) => Promise<string | null>; // null = sucesso; string = erro
  ajustar: (delta: number, motivo?: string) => Promise<boolean>;
  limpar: () => void;
}

export const useProfile = create<ProfileStore>((set, get) => ({
  perfil: null,
  carregando: true,

  carregar: async () => {
    if (!isSupabaseConfigured()) {
      set({ perfil: null, carregando: false });
      return;
    }
    set({ carregando: true });
    try {
      const sb = getSupabase();
      const { data: u } = await sb.auth.getUser();
      if (!u.user) {
        set({ perfil: null, carregando: false });
        return;
      }
      const { data } = await sb
        .from("profiles")
        .select("nick, avatar_frame, coinpoints")
        .eq("id", u.user.id)
        .maybeSingle();
      set({ perfil: (data as Perfil) ?? null, carregando: false });
    } catch {
      set({ perfil: null, carregando: false });
    }
  },

  criarPerfil: async (nick) => {
    const limpo = nick.trim();
    if (limpo.length < 3) return "Nick muito curto (mín. 3 letras).";
    if (limpo.length > 16) return "Nick muito longo (máx. 16).";
    if (!/^[A-Za-z0-9_ ]+$/.test(limpo)) return "Use só letras, números, espaço ou _.";
    try {
      const sb = getSupabase();
      const { data: u } = await sb.auth.getUser();
      if (!u.user) return "Você precisa estar logado.";
      const { error } = await sb.from("profiles").insert({ id: u.user.id, nick: limpo });
      if (error) {
        if (error.code === "23505") return "Esse nick já está em uso.";
        return error.message;
      }
      await get().carregar();
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : "Erro ao criar o perfil.";
    }
  },

  // Credita/debita CoinPoints no servidor (atômico). Retorna true em sucesso.
  ajustar: async (delta, motivo) => {
    if (!isSupabaseConfigured()) return false;
    try {
      const sb = getSupabase();
      const { data, error } = await sb.rpc("ajustar_coinpoints", { delta, motivo: motivo ?? null });
      if (error) return false;
      const novo = data as number;
      set((s) => (s.perfil ? { perfil: { ...s.perfil, coinpoints: novo } } : {}));
      return true;
    } catch {
      return false;
    }
  },

  limpar: () => set({ perfil: null, carregando: true }),
}));
