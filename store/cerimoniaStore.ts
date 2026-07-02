import { create } from "zustand";
import { ehFullscreen, type Cerimonia } from "@/engine/cerimonias";

// 🎉 Fila de cerimônias pendentes (transiente — NUNCA vai pro save). Os stores de jogo
// emitem eventos derivados por funções puras do engine; o CeremonyManager consome
// uma fullscreen por vez (nunca duas sobrepostas) e os toasts em paralelo.

interface CerimoniaStore {
  fila: Cerimonia[]; // fullscreen, apresentadas uma a uma na ordem
  toasts: Cerimonia[]; // discretas, canto da tela
  emitir: (eventos: Cerimonia | Cerimonia[] | null | undefined) => void;
  dispensar: () => void; // remove a fullscreen atual
  removerToast: (idx: number) => void;
  limpar: () => void;
}

export const useCerimonias = create<CerimoniaStore>((set, get) => ({
  fila: [],
  toasts: [],

  emitir: (eventos) => {
    if (!eventos) return;
    const lista = Array.isArray(eventos) ? eventos : [eventos];
    if (lista.length === 0) return;
    const fs = lista.filter(ehFullscreen);
    const ts = lista.filter((e) => !ehFullscreen(e));
    set({
      fila: fs.length ? [...get().fila, ...fs] : get().fila,
      toasts: ts.length ? [...get().toasts, ...ts] : get().toasts,
    });
  },

  dispensar: () => set({ fila: get().fila.slice(1) }),
  removerToast: (idx) => set({ toasts: get().toasts.filter((_, i) => i !== idx) }),
  limpar: () => set({ fila: [], toasts: [] }),
}));
