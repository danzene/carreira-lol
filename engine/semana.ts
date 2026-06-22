import { LOOP } from "@/data/loop";
import type { AtributoKey, CareerState } from "./types";

// Lógica PURA do loop semanal: energia, treino e avanço de tempo.

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export const CUSTO_SOLOQ = LOOP.custoSoloq;
export const CUSTO_TREINO = LOOP.custoTreino;

export function temEnergiaParaSoloq(career: CareerState): boolean {
  return career.player.energia >= LOOP.custoSoloq;
}

export function gastarEnergiaSoloq(career: CareerState): CareerState {
  return {
    ...career,
    player: { ...career.player, energia: clamp(career.player.energia - LOOP.custoSoloq, 0, 100) },
  };
}

// Treino focado: gasta energia e dá XP num atributo. null se faltar energia.
export function treinar(career: CareerState, atributo: AtributoKey): CareerState | null {
  if (career.player.energia < LOOP.custoTreino) return null;
  const atual = career.player.atributos[atributo];
  return {
    ...career,
    player: {
      ...career.player,
      energia: clamp(career.player.energia - LOOP.custoTreino, 0, 100),
      atributos: {
        ...career.player.atributos,
        [atributo]: clamp(Math.round((atual + LOOP.ganhoTreino) * 100) / 100, 0, 100),
      },
    },
  };
}

// Nota média das últimas partidas (5 por padrão). 5 = neutro quando não há histórico.
export function formaRecente(career: CareerState): number {
  const ult = career.historicoPartidas.slice(0, LOOP.janelaForma);
  if (ult.length === 0) return 5;
  return ult.reduce((acc, m) => acc + m.notaPerformance, 0) / ult.length;
}

// Avança o tempo. "normal" = recupera parte da energia; "descanso" = recupera tudo + moral.
export function avancarSemana(career: CareerState, modo: "normal" | "descanso"): CareerState {
  const drift = (formaRecente(career) - 5) * LOOP.moralPorForma;
  const bonusDescanso = modo === "descanso" ? LOOP.moralDescanso : 0;
  const energia =
    modo === "descanso" ? 100 : clamp(career.player.energia + LOOP.recuperaEnergiaSemana, 0, 100);
  const moral = clamp(Math.round((career.player.moral + drift + bonusDescanso) * 10) / 10, 0, 100);

  let semanaAtual = career.semanaAtual + 1;
  let temporada = career.temporada;
  if (semanaAtual > LOOP.semanasPorTemporada) {
    semanaAtual = 1;
    temporada += 1;
  }

  return {
    ...career,
    semanaAtual,
    temporada,
    player: { ...career.player, energia, moral },
  };
}
