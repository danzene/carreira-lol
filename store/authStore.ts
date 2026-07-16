import { create } from "zustand";
import type { User } from "@supabase/supabase-js";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { definirUsuario, migrarAnonParaUsuario, observarSaves } from "./saves";
import { agendarPush, puxarDoCloud } from "./cloudSync";
import { useCareer } from "./careerStore";

interface AuthStore {
  user: User | null;
  carregando: boolean;
  configurado: boolean;
  init: () => void;
  entrar: (email: string, senha: string) => Promise<string | null>;
  cadastrar: (email: string, senha: string) => Promise<string | null>;
  entrarComGoogle: () => Promise<string | null>;
  sairConta: () => Promise<void>;
}

let iniciado = false;
// Guarda o ÚLTIMO id de usuário aplicado. O Supabase dispara onAuthStateChange com
// frequência (TOKEN_REFRESHED periódico, refoco de aba, revalidação disparada por
// getUser). Se re-aplicarmos a sessão a cada evento, o puxarDoCloud sobrescreve o
// jogo em andamento e o set({user}) faz o AuthGate recarregar tudo — vira loop de
// reset. Só reagimos quando a IDENTIDADE muda (login/logout), não em refresh.
let ultimoUserId: string | null | undefined = undefined; // undefined = ainda não aplicado

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
    // ⚠️ ORDEM IMPORTA: esquece a carreira em memória ANTES de trocar o namespace dos
    // saves. Senão, entre o definirUsuario(novo) e as páginas recarregarem, um save
    // (ex.: heartbeat do grind) gravaria a carreira da conta ANTERIOR no namespace da
    // NOVA — contaminação cruzada. Roda em toda troca/login/logout (no-op se já vazio).
    useCareer.getState().esquecerCarreira();
    definirUsuario(user?.id ?? null);
    if (user) {
      migrarAnonParaUsuario(user.id); // 1º login: traz a carreira anônima pra conta (e limpa o anon)
      await puxarDoCloud();
    }
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
        const u = data.session?.user ?? null;
        const uid = u?.id ?? null;
        set({ carregando: false });
        if (uid === ultimoUserId) return; // já aplicado pelo onAuthStateChange
        ultimoUserId = uid;
        await aplicarSessao(u);
      });

      sb.auth.onAuthStateChange((_evento, session) => {
        const uid = session?.user?.id ?? null;
        if (uid === ultimoUserId) return; // MESMO usuário (refresh/refoco) → não repuxa a nuvem nem reseta
        ultimoUserId = uid;
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

    entrarComGoogle: async () => {
      const sb = getSupabase();
      const { error } = await sb.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: typeof window !== "undefined" ? window.location.origin : undefined },
      });
      // em sucesso o navegador é redirecionado pro Google; o retorno só importa em erro.
      return error ? traduzErro(error.message) : null;
    },

    sairConta: async () => {
      const sb = getSupabase();
      await sb.auth.signOut();
      definirUsuario(null);
      set({ user: null });
    },
  };
});
