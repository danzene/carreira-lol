import { LOOP } from "@/data/loop";
import type { CareerState } from "./types";

// ⏱️ Progressão por tempo real: a energia regenera sozinha (2h → 100) e avançar/descansar
// a semana são limitados por janela (N usos a cada X horas). PURO (recebe `agora`).

const msPorPonto = LOOP.energiaCheiaMs / 100;

// Energia atual considerando o tempo passado desde a última atualização.
export function energiaAgora(career: CareerState, agora: number): number {
  const base = career.player.energia;
  if (base >= 100) return 100;
  const desde = career.energiaEm ?? agora;
  const ganho = Math.max(0, agora - desde) / msPorPonto;
  return Math.min(100, Math.round((base + ganho) * 10) / 10);
}

// Materializa a regeneração no estado (energia atualizada + carimbo de tempo).
export function sincronizarEnergia(career: CareerState, agora: number): CareerState {
  return { ...career, energiaEm: agora, player: { ...career.player, energia: energiaAgora(career, agora) } };
}

// ms que faltam para a energia encher (0 se já está cheia).
export function tempoParaEncher(career: CareerState, agora: number): number {
  const e = energiaAgora(career, agora);
  return e >= 100 ? 0 : Math.ceil((100 - e) * msPorPonto);
}

// ---- limite de avançar/descansar por janela ----
function naJanela(ts: number[] | undefined, agora: number): number[] {
  return (ts ?? []).filter((t) => agora - t < LOOP.janelaPassesMs);
}

export function usosRestantes(ts: number[] | undefined, agora: number): number {
  return Math.max(0, LOOP.maxPassesJanela - naJanela(ts, agora).length);
}

// ms até liberar o próximo uso (0 se há uso disponível agora).
export function proximoUsoEm(ts: number[] | undefined, agora: number): number {
  const janela = naJanela(ts, agora);
  if (janela.length < LOOP.maxPassesJanela) return 0;
  const maisAntigo = Math.min(...janela);
  return Math.max(0, maisAntigo + LOOP.janelaPassesMs - agora);
}

// Registra um uso agora, descartando os que saíram da janela.
export function registrarUso(ts: number[] | undefined, agora: number): number[] {
  return [...naJanela(ts, agora), agora];
}

// ---- cargas de partida de campeonato (liga/torneio) ----
// Regenera 1 carga a cada cargaPartidaMs, até maxCargasPartida. Começa cheio.
export function cargasPartida(career: CareerState, agora: number): number {
  const max = LOOP.maxCargasPartida;
  const stored = career.cargasPartida ?? max;
  const em = career.cargasEm ?? agora;
  const ganho = Math.max(0, agora - em) / LOOP.cargaPartidaMs;
  return Math.min(max, stored + ganho);
}

// Consome 1 carga (use só quando cargasPartida >= 1).
export function consumirCarga(career: CareerState, agora: number): CareerState {
  const atual = cargasPartida(career, agora);
  return { ...career, cargasPartida: Math.max(0, atual - 1), cargasEm: agora };
}

// ms até ganhar a próxima carga (0 se já está cheio).
export function tempoProximaCarga(career: CareerState, agora: number): number {
  const atual = cargasPartida(career, agora);
  if (atual >= LOOP.maxCargasPartida) return 0;
  const frac = atual - Math.floor(atual);
  return Math.ceil((1 - frac) * LOOP.cargaPartidaMs);
}
