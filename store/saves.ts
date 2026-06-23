import type { CareerState, Role } from "@/engine/types";

// Save/load multi-slot. Os dados ficam em localStorage (cache) namespaceado por
// usuário, e são sincronizados com a nuvem (ver cloudSync.ts) via observador.

const PREFIXO = "carreira-lol";
let ns = "anon";
let aoMudar: (() => void) | null = null;

// Define o usuário atual (namespace dos saves). null = anônimo.
export function definirUsuario(userId: string | null): void {
  ns = userId ?? "anon";
}

// Registra um callback chamado a cada gravação local (usado pra empurrar pra nuvem).
export function observarSaves(cb: () => void): void {
  aoMudar = cb;
}

function chaveSaves(): string {
  return `${PREFIXO}:saves:v1:${ns}`;
}
function chaveAtual(): string {
  return `${PREFIXO}:slot-atual:v1:${ns}`;
}

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
    const raw = window.localStorage.getItem(chaveSaves());
    return raw ? (JSON.parse(raw) as Record<string, Slot>) : {};
  } catch {
    return {};
  }
}

function gravarTudo(slots: Record<string, Slot>): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(chaveSaves(), JSON.stringify(slots));
  aoMudar?.();
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
  if (id) window.localStorage.setItem(chaveAtual(), id);
  else window.localStorage.removeItem(chaveAtual());
}

export function lerSlotAtual(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(chaveAtual());
}

// ---- sincronização com a nuvem ----

// Blob de todos os saves do usuário atual (pra subir pra nuvem).
export function exportarTudo(): Record<string, Slot> {
  return lerTudo();
}

// Sobrescreve os saves locais com o que veio da nuvem (não dispara o observador).
export function importarTudo(dados: Record<string, Slot>): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(chaveSaves(), JSON.stringify(dados ?? {}));
}
