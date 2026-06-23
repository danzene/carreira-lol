import { create } from "zustand";
import { criarCareerState } from "@/engine/player";
import { regenerarEnergia } from "@/engine/energia";
import { gerarRoteiro, type RoteiroPartida } from "@/engine/partida";
import { aplicarResultado, simularPartida } from "@/engine/simularPartida";
import {
  avancarSemana as avancarSemanaEngine,
  gastarEnergiaSoloq,
  temEnergiaParaSoloq,
  treinar as treinarEngine,
} from "@/engine/semana";
import {
  alternarCoach,
  bootcampCoreia,
  comprarSetup,
  processarSemanaEconomia,
  sessaoMental,
  stream,
} from "@/engine/economia";
import type { AtributoKey, CareerState, MatchResult, Player } from "@/engine/types";
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
  prepararSoloq: () => { seed: number; roteiro: RoteiroPartida } | null;
  finalizarSoloq: (championId: string, seed: number, modificador: number) => MatchResult | null;
  treinar: (atributo: AtributoKey) => boolean;
  avancarSemana: (modo: "normal" | "descanso") => void;
  sincronizarEnergia: () => void;
  investir: (tipo: TipoInvestimento) => string | null;
  apagar: (slotId: string) => void;
  sair: () => void;
}

export type TipoInvestimento = "stream" | "setup" | "mental" | "bootcamp" | "coach";

export const useCareer = create<CareerStore>((set, get) => ({
  career: null,
  slotId: null,

  iniciarCarreira: (player) => {
    const career = regenerarEnergia(criarCareerState(player));
    const slotId = gerarId();
    salvarSlot(slotId, career);
    definirSlotAtual(slotId);
    set({ career, slotId });
    return slotId;
  },

  carregar: (slotId) => {
    const slot = lerSlot(slotId);
    if (!slot) return false;
    const career = regenerarEnergia(slot.state);
    definirSlotAtual(slotId);
    set({ career, slotId });
    if (career.player.energia !== slot.state.player.energia) salvarSlot(slotId, career);
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

  prepararSoloq: () => {
    const { career } = get();
    if (!career || !temEnergiaParaSoloq(career)) return null;
    const seed = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
    return { seed, roteiro: gerarRoteiro(career.player, seed) };
  },

  finalizarSoloq: (championId, seed, modificador) => {
    const { career, slotId } = get();
    if (!career) return null;
    const base = regenerarEnergia(career);
    const resultado = simularPartida(base.player, championId, seed, modificador);
    const novo = gastarEnergiaSoloq(aplicarResultado(base, resultado));
    set({ career: novo });
    if (slotId) salvarSlot(slotId, novo);
    return resultado;
  },

  treinar: (atributo) => {
    const { career, slotId } = get();
    if (!career) return false;
    const novo = treinarEngine(regenerarEnergia(career), atributo);
    if (!novo) return false;
    set({ career: novo });
    if (slotId) salvarSlot(slotId, novo);
    return true;
  },

  avancarSemana: (modo) => {
    const { career, slotId } = get();
    if (!career) return;
    const novo = processarSemanaEconomia(avancarSemanaEngine(career, modo));
    set({ career: novo });
    if (slotId) salvarSlot(slotId, novo);
  },

  sincronizarEnergia: () => {
    const { career, slotId } = get();
    if (!career) return;
    const regen = regenerarEnergia(career);
    if (regen.player.energia !== career.player.energia) {
      set({ career: regen });
      if (slotId) salvarSlot(slotId, regen);
    }
  },

  investir: (tipo) => {
    const { career, slotId } = get();
    if (!career) return "Sem carreira ativa.";
    const base = regenerarEnergia(career);

    let novo: CareerState | null;
    let erro: string;
    switch (tipo) {
      case "stream":
        novo = stream(base);
        erro = "Sem energia para a live.";
        break;
      case "setup":
        novo = comprarSetup(base);
        erro = base.setupComprado ? "Você já comprou o setup." : "Dinheiro insuficiente.";
        break;
      case "mental":
        novo = sessaoMental(base);
        erro = "Dinheiro insuficiente.";
        break;
      case "bootcamp":
        novo = bootcampCoreia(base);
        erro = "Dinheiro insuficiente.";
        break;
      case "coach":
        novo = alternarCoach(base);
        erro = "";
        break;
    }

    if (!novo) return erro;
    set({ career: novo });
    if (slotId) salvarSlot(slotId, novo);
    return null;
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
