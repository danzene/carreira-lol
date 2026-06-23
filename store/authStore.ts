import { create } from "zustand";
import type { User } from "@supabase/supabase-js";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { definirUsuario, observarSaves } from "./saves";
import { agendarPush, puxarDoCloud } from "./cloudSync";

interface AuthStore {
  user: User | null;
  carregando: boolean;
  configurado: boolean;
  init: () => void;
  entrar: (email: string, senha: string) => Promise<string | null>;
  cadastrar: (email: string, senha: string) => Promise<string | null>;
  sairConta: () => Promise<void>;
}

let iniciado = false;

function traduzErro(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login") || m.includes("invalid credentials")) return "Email ou senha incorretos.";
  if (m.includes("already") && m.includes("registered")) return "Esse email já tem conta — faça login.";
  if (m.includes("at least 6") || (m.includes("password") && m.includes("6"))) return "A senha precisa ter ao menos 6 caracteres.";
  if (m.includes("valid email") || m.includes("invalid email")) return "Email inválido.";
  return msg;
}

export const useAuth = create<AuthStore>((set) => {
  async function aplicarSessao(user: User | null): Promise<void> {
    definirUsuario(user?.id ?? null);
    if (user) await puxarDoCloud();
    set({ user });
  }

  return {
    user: null,
    carregando: true,
    configurado: true,

    init: () => {
      if (iniciado) return;
      iniciado = true;

      if (!isSupabaseConfigured()) {
        set({ carregando: false, configurado: false });
        return;
      }

      observarSaves(() => agendarPush());
      const sb = getSupabase();

      sb.auth.getSession().then(async ({ data }) => {
        await aplicarSessao(data.session?.user ?? null);
        set({ carregando: false });
      });

      sb.auth.onAuthStateChange((_evento, session) => {
        void aplicarSessao(session?.user ?? null);
      });
    },

    entrar: async (email, senha) => {
      const sb = getSupabase();
      const { error } = await sb.auth.signInWithPassword({ email, password: senha });
      return error ? traduzErro(error.message) : null;
    },

    cadastrar: async (email, senha) => {
      const sb = getSupabase();
      const { data, error } = await sb.auth.signUp({ email, password: senha });
      if (error) return traduzErro(error.message);
      if (!data.session) return "CONFIRME_EMAIL"; // confirmação de email está ligada
      return null;
    },

    sairConta: async () => {
      const sb = getSupabase();
      await sb.auth.signOut();
      definirUsuario(null);
      set({ user: null });
    },
  };
});
