import { create } from "zustand";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import type { LiveConfig } from "@/lib/liveops";

// 🎛️ Live-Ops no jogo: lê as chaves PÚBLICAS de app_config (feature_flags +
// mensagem_do_dia) com a anon key. FAIL-OPEN: se falhar, config fica null e o
// helper featureLigada() trata tudo como ligado — a falha nunca tira o jogo do ar.

interface LiveOpsStore {
  config: LiveConfig | null;
  carregado: boolean;
  carregar: () => Promise<void>;
}

export const useLiveOps = create<LiveOpsStore>((set) => ({
  config: null,
  carregado: false,

  carregar: async () => {
    if (!isSupabaseConfigured()) {
      set({ config: null, carregado: true });
      return;
    }
    try {
      const sb = getSupabase();
      const { data, error } = await sb.from("app_config").select("chave, valor").in("chave", ["feature_flags", "mensagem_do_dia"]);
      if (error) throw error;
      const cfg: LiveConfig = {};
      for (const row of data ?? []) {
        if (row.chave === "feature_flags") cfg.feature_flags = row.valor as LiveConfig["feature_flags"];
        if (row.chave === "mensagem_do_dia") cfg.mensagem_do_dia = row.valor as LiveConfig["mensagem_do_dia"];
      }
      set({ config: cfg, carregado: true });
    } catch {
      // fail-open: mantém config null → tudo ligado, sem banner
      set({ config: null, carregado: true });
    }
  },
}));
