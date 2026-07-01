import { create } from "zustand";
import { SLOTS_GEAR } from "@/data/itens";
import type { Recompensa, TipoMissao } from "@/data/passe";
import { gerarItem } from "@/engine/itens";
import {
  criarPasse,
  marcarResgatada,
  podeResgatar,
  progredirPasse,
  renovarMissoes,
  type PasseState,
} from "@/engine/passe";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { useInventory } from "./inventoryStore";
import { useProfile } from "./profileStore";

// Passe de Batalha por conta (servidor). Progresso vem das ações do jogo (careerStore/inventory).

function seedAgora(): number {
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}

interface PasseStore {
  passe: PasseState | null;
  carregando: boolean;
  carregar: () => Promise<void>;
  progredir: (tipo: TipoMissao, qtd?: number) => void;
  resgatar: (r: Recompensa) => boolean;
  limpar: () => void;
}

let timer: ReturnType<typeof setTimeout> | null = null;

export const usePasse = create<PasseStore>((set, get) => {
  function persistir(): void {
    if (!isSupabaseConfigured()) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(async () => {
      try {
        const sb = getSupabase();
        const { data: u } = await sb.auth.getUser();
        if (!u.user) return;
        const estado = get().passe;
        if (!estado) return;
        await sb.from("battle_pass").upsert({ user_id: u.user.id, estado, updated_at: new Date().toISOString() });
      } catch {
        // tenta na próxima
      }
    }, 1200);
  }

  return {
    passe: null,
    carregando: true,

    carregar: async () => {
      if (!isSupabaseConfigured()) {
        set({ carregando: false });
        return;
      }
      set({ carregando: true });
      try {
        const sb = getSupabase();
        const { data: u } = await sb.auth.getUser();
        if (!u.user) {
          set({ passe: null, carregando: false });
          return;
        }
        const { data } = await sb.from("battle_pass").select("estado").eq("user_id", u.user.id).maybeSingle();
        const agora = Date.now();
        const salvo = data?.estado as PasseState | undefined;
        const criou = !salvo || Object.keys(salvo).length === 0;
        const base = criou ? criarPasse(seedAgora(), agora) : salvo;
        const passe = renovarMissoes(base, seedAgora(), agora);
        set({ passe, carregando: false });
        if (criou || passe !== base) persistir();
      } catch {
        set({ carregando: false });
      }
    },

    progredir: (tipo, qtd = 1) => {
      const p = get().passe;
      if (!p) return;
      const novo = progredirPasse(p, tipo, qtd);
      if (novo === p) return;
      set({ passe: novo });
      persistir();
    },

    resgatar: (r) => {
      const p = get().passe;
      if (!p || !podeResgatar(p, r)) return false;
      if (r.tipo === "coinpoints") {
        void useProfile.getState().ajustar(r.valor, "passe");
      } else if (r.tipo === "item") {
        const slot = SLOTS_GEAR[Math.floor(Math.random() * SLOTS_GEAR.length)].slot;
        useInventory.getState().adicionarItem(gerarItem(slot, r.valor, seedAgora(), { sorte: 0.1 }));
      }
      let novo = marcarResgatada(p, r);
      if (r.tipo === "ingresso") novo = { ...novo, ingressos: novo.ingressos + r.valor };
      set({ passe: novo });
      persistir();
      return true;
    },

    limpar: () => set({ passe: null, carregando: true }),
  };
});
