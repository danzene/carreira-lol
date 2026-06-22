import { create } from "zustand";
import { criarCareerState } from "@/engine/player";
import { aplicarResultado, simularPartida } from "@/engine/simularPartida";
import type { CareerState, MatchResult, Player } from "@/engine/types";
import {
  apagarSlot,
  definirSlotAtual,
  gerarId,
  lerSlot,
  lerSlotAtual,
  salvarSlot,
} from "./saves";

// Estado global da carreira atual (em memória) + integração com os slots do localStorage.

interface CareerStore {
  career: CareerState | null;
  slotId: string | null;
  iniciarCarreira: (player: Player) => string;
  carregar: (slotId: string) => boolean;
  recarregarAtual: () => boolean;
  persistir: () => void;
  jogarPartida: (championId: string) => MatchResult | null;
  apagar: (slotId: string) => void;
  sair: () => void;
}

export const useCareer = create<CareerStore>((set, get) => ({
  career: null,
  slotId: null,

  iniciarCarreira: (player) => {
    const career = criarCareerState(player);
    const slotId = gerarId();
    salvarSlot(slotId, career);
    definirSlotAtual(slotId);
    set({ career, slotId });
    return slotId;
  },

  carregar: (slotId) => {
    const slot = lerSlot(slotId);
    if (!slot) return false;
    definirSlotAtual(slotId);
    set({ career: slot.state, slotId });
    return true;
  },

  recarregarAtual: () => {
    const atual = lerSlotAtual();
    if (!atual) return false;
    return get().carregar(atual);
  },

  persistir: () => {
    const { career, slotId } = get();
    if (career && slotId) salvarSlot(slotId, career);
  },

  jogarPartida: (championId) => {
    const { career, slotId } = get();
    if (!career) return null;
    const seed = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
    const resultado = simularPartida(career.player, championId, seed);
    const novo = aplicarResultado(career, resultado);
    set({ career: novo });
    if (slotId) salvarSlot(slotId, novo);
    return resultado;
  },

  apagar: (slotId) => {
    apagarSlot(slotId);
    if (get().slotId === slotId) set({ career: null, slotId: null });
  },

  sair: () => {
    definirSlotAtual(null);
    set({ career: null, slotId: null });
  },
}));
