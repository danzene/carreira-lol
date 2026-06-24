import { create } from "zustand";
import { criarCareerState } from "@/engine/player";
import { aplicarResultado } from "@/engine/simularPartida";
import {
  alteracaoMental as alteracaoMentalEngine,
  avancarSemana as avancarSemanaEngine,
  gastarEnergiaSoloq,
  streaming as streamingEngine,
  treinar as treinarEngine,
} from "@/engine/loop";
import {
  alternarCoach as alternarCoachEngine,
  bonusVitoria,
  bootcampCoreia,
  processarSemanaEconomia,
  sessaoMental as sessaoMentalEngine,
  upgradeEquip as upgradeEquipEngine,
} from "@/engine/economia";
import type { AtributoKey, CareerState, Equip, MatchResult, Player, TraitId } from "@/engine/types";
import {
  apagarSlot,
  definirSlotAtual,
  gerarId,
  lerSlot,
  lerSlotAtual,
  salvarSlot,
} from "./saves";

// Estado global da carreira atual + integração com os slots (localStorage).
// Fase 1: só guarda/carrega; as ações de jogo entram nas fases seguintes.

interface CareerStore {
  career: CareerState | null;
  slotId: string | null;
  iniciarCarreira: (player: Player) => string;
  carregar: (slotId: string) => boolean;
  recarregarAtual: () => boolean;
  aplicarPartida: (resultado: MatchResult) => void;
  treinar: (atributo: AtributoKey, especial?: boolean) => boolean;
  streaming: () => boolean;
  alteracaoMental: (traco: TraitId) => boolean;
  avancarSemana: (modo?: "normal" | "descanso") => void;
  bootcamp: () => boolean;
  alternarCoach: () => void;
  sessaoMental: () => boolean;
  upgradeEquip: (tipo: Equip["tipo"]) => boolean;
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

  aplicarPartida: (resultado) => {
    const { career, slotId } = get();
    if (!career) return;
    let novo = gastarEnergiaSoloq(aplicarResultado(career, resultado));
    if (resultado.vitoria) novo = { ...novo, dinheiro: novo.dinheiro + bonusVitoria(career) };
    set({ career: novo });
    if (slotId) salvarSlot(slotId, novo);
  },

  treinar: (atributo, especial = false) => {
    const { career, slotId } = get();
    if (!career) return false;
    const novo = treinarEngine(career, atributo, especial);
    if (!novo) return false;
    set({ career: novo });
    if (slotId) salvarSlot(slotId, novo);
    return true;
  },

  streaming: () => {
    const { career, slotId } = get();
    if (!career) return false;
    const novo = streamingEngine(career);
    if (!novo) return false;
    set({ career: novo });
    if (slotId) salvarSlot(slotId, novo);
    return true;
  },

  alteracaoMental: (traco) => {
    const { career, slotId } = get();
    if (!career) return false;
    const novo = alteracaoMentalEngine(career, traco);
    if (!novo) return false;
    set({ career: novo });
    if (slotId) salvarSlot(slotId, novo);
    return true;
  },

  avancarSemana: (modo = "normal") => {
    const { career, slotId } = get();
    if (!career) return;
    const novo = processarSemanaEconomia(avancarSemanaEngine(career, modo));
    set({ career: novo });
    if (slotId) salvarSlot(slotId, novo);
  },

  bootcamp: () => {
    const { career, slotId } = get();
    if (!career) return false;
    const novo = bootcampCoreia(career);
    if (!novo) return false;
    set({ career: novo });
    if (slotId) salvarSlot(slotId, novo);
    return true;
  },

  alternarCoach: () => {
    const { career, slotId } = get();
    if (!career) return;
    const novo = alternarCoachEngine(career);
    set({ career: novo });
    if (slotId) salvarSlot(slotId, novo);
  },

  sessaoMental: () => {
    const { career, slotId } = get();
    if (!career) return false;
    const novo = sessaoMentalEngine(career);
    if (!novo) return false;
    set({ career: novo });
    if (slotId) salvarSlot(slotId, novo);
    return true;
  },

  upgradeEquip: (tipo) => {
    const { career, slotId } = get();
    if (!career) return false;
    const novo = upgradeEquipEngine(career, tipo);
    if (!novo) return false;
    set({ career: novo });
    if (slotId) salvarSlot(slotId, novo);
    return true;
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
