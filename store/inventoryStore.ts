import { create } from "zustand";
import { ITENS_ECON, SLOTS_GEAR, type Item, type SlotGear } from "@/data/itens";
import { cerimoniaDeDrop } from "@/engine/cerimonias";
import { gerarItem, rerollAfixos } from "@/engine/itens";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { useCerimonias } from "./cerimoniaStore";
import { useProfile } from "./profileStore";
import { usePasse } from "./passeStore";

// Inventário RPG por conta (servidor). Itens + o que está equipado por slot.
// Custos em CoinPoints (reroll/desmonte) passam pela função autoritativa do profileStore.

function seedAgora(): number {
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}

// Itens efetivamente equipados (deriva do mapa slot→id).
export function itensEquipadosDe(itens: Item[], equipado: Partial<Record<SlotGear, string>>): Item[] {
  return (Object.values(equipado) as string[])
    .map((id) => itens.find((i) => i.id === id))
    .filter((i): i is Item => Boolean(i));
}

interface InventoryStore {
  itens: Item[];
  equipado: Partial<Record<SlotGear, string>>;
  carregando: boolean;
  carregar: () => Promise<void>;
  equipar: (id: string) => void;
  desequipar: (slot: SlotGear) => void;
  adicionarItem: (item: Item) => void;
  dropDePartida: (iLvl: number, sorte?: number) => Item | null;
  reroll: (id: string) => Promise<boolean>;
  desmontar: (id: string) => void;
  ultimoDrop: Item | null; // último item dropado (pra mostrar no resultado da partida)
  novos: number; // itens novos não vistos (selo no dashboard)
  limparDrop: () => void;
  marcarVistos: () => void;
  limpar: () => void;
}

let timer: ReturnType<typeof setTimeout> | null = null;

export const useInventory = create<InventoryStore>((set, get) => {
  // upsert debounced no Supabase (igual ao cloudSync dos saves)
  function persistir(): void {
    if (!isSupabaseConfigured()) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(async () => {
      try {
        const sb = getSupabase();
        const { data: u } = await sb.auth.getUser();
        if (!u.user) return;
        const { itens, equipado } = get();
        await sb.from("inventario").upsert({ user_id: u.user.id, itens, equipado, updated_at: new Date().toISOString() });
      } catch {
        // falha de rede — tenta na próxima gravação
      }
    }, 1200);
  }

  return {
    itens: [],
    equipado: {},
    carregando: true,
    ultimoDrop: null,
    novos: 0,

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
          set({ itens: [], equipado: {}, carregando: false });
          return;
        }
        const { data } = await sb.from("inventario").select("itens, equipado").eq("user_id", u.user.id).maybeSingle();
        set({
          itens: (data?.itens as Item[]) ?? [],
          equipado: (data?.equipado as Partial<Record<SlotGear, string>>) ?? {},
          carregando: false,
        });
      } catch {
        set({ carregando: false });
      }
    },

    equipar: (id) => {
      const { itens, equipado } = get();
      const item = itens.find((i) => i.id === id);
      if (!item) return;
      set({ equipado: { ...equipado, [item.slot]: id } });
      persistir();
      usePasse.getState().progredir("equipar_item");
    },

    desequipar: (slot) => {
      const eq = { ...get().equipado };
      delete eq[slot];
      set({ equipado: eq });
      persistir();
    },

    adicionarItem: (item) => {
      set({ itens: [...get().itens, item] });
      persistir();
    },

    // Drop ao vencer: chance de cair um item de slot aleatório no iLvl dado.
    dropDePartida: (iLvl, sorte = 0) => {
      if (Math.random() > ITENS_ECON.dropChanceVitoria) return null;
      const slot = SLOTS_GEAR[Math.floor(Math.random() * SLOTS_GEAR.length)].slot;
      const item = gerarItem(slot, iLvl, seedAgora(), { sorte });
      set({ itens: [...get().itens, item], ultimoDrop: item, novos: get().novos + 1 });
      persistir();
      useCerimonias.getState().emitir(cerimoniaDeDrop(item));
      return item;
    },

    // Re-sorteia os afixos (custa CoinPoints no servidor).
    reroll: async (id) => {
      const item = get().itens.find((i) => i.id === id);
      if (!item) return false;
      const pago = await useProfile.getState().ajustar(-ITENS_ECON.custoReroll, "reroll-item");
      if (!pago) return false;
      const novo = rerollAfixos(item, seedAgora());
      set({ itens: get().itens.map((i) => (i.id === id ? novo : i)) });
      persistir();
      return true;
    },

    // Desmonta o item (remove + dá CoinPoints). Desequipa se estiver em uso.
    desmontar: (id) => {
      const { itens, equipado } = get();
      const item = itens.find((i) => i.id === id);
      if (!item) return;
      const eq = { ...equipado };
      if (eq[item.slot] === id) delete eq[item.slot];
      set({ itens: itens.filter((i) => i.id !== id), equipado: eq });
      void useProfile.getState().ajustar(ITENS_ECON.coinsDesmonte, "desmonte-item");
      persistir();
    },

    limparDrop: () => set({ ultimoDrop: null }),
    marcarVistos: () => set({ novos: 0 }),

    limpar: () => set({ itens: [], equipado: {}, carregando: true, ultimoDrop: null, novos: 0 }),
  };
});
