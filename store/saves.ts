import type { CareerState, Role } from "@/engine/types";

// Save/load em localStorage com múltiplos slots. Tudo guardado num mapa só.

const KEY = "carreira-lol:saves:v1";
const KEY_ATUAL = "carreira-lol:slot-atual:v1";

export interface Slot {
  id: string;
  criadoEm: number;
  atualizadoEm: number;
  state: CareerState;
}

export interface SlotResumo {
  id: string;
  nome: string;
  rota: Role;
  nacionalidade: string;
  elo: string;
  semana: number;
  temporada: number;
  atualizadoEm: number;
}

function lerTudo(): Record<string, Slot> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, Slot>) : {};
  } catch {
    return {};
  }
}

function gravarTudo(slots: Record<string, Slot>): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(slots));
}

export function gerarId(): string {
  return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function listarResumos(): SlotResumo[] {
  return Object.values(lerTudo())
    .map((s) => ({
      id: s.id,
      nome: s.state.player.nome,
      rota: s.state.player.rota,
      nacionalidade: s.state.player.nacionalidade,
      elo: s.state.player.rankSoloq.elo,
      semana: s.state.semanaAtual,
      temporada: s.state.temporada,
      atualizadoEm: s.atualizadoEm,
    }))
    .sort((a, b) => b.atualizadoEm - a.atualizadoEm);
}

export function lerSlot(id: string): Slot | null {
  return lerTudo()[id] ?? null;
}

export function salvarSlot(id: string, state: CareerState): Slot {
  const slots = lerTudo();
  const agora = Date.now();
  const existente = slots[id];
  const slot: Slot = {
    id,
    criadoEm: existente?.criadoEm ?? agora,
    atualizadoEm: agora,
    state,
  };
  slots[id] = slot;
  gravarTudo(slots);
  return slot;
}

export function apagarSlot(id: string): void {
  const slots = lerTudo();
  delete slots[id];
  gravarTudo(slots);
  if (lerSlotAtual() === id) definirSlotAtual(null);
}

export function definirSlotAtual(id: string | null): void {
  if (typeof window === "undefined") return;
  if (id) window.localStorage.setItem(KEY_ATUAL, id);
  else window.localStorage.removeItem(KEY_ATUAL);
}

export function lerSlotAtual(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(KEY_ATUAL);
}
