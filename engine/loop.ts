import { LOOP } from "@/data/loop";
import { bonusInstalacoes } from "./transferencias";
import type { AtributoKey, CareerState, TraitId } from "./types";

// Loop semanal (PURO): energia, atividades e avanço de tempo.

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}
const round2 = (v: number): number => Math.round(v * 100) / 100;

export function temEnergia(career: CareerState, custo: number): boolean {
  return career.player.energia >= custo;
}

// Treino focado (especial=false) ou especial (boost maior, custo maior).
export function treinar(career: CareerState, atributo: AtributoKey, especial = false): CareerState | null {
  const custo = especial ? LOOP.custoEspecial : LOOP.custoTreino;
  if (career.player.energia < custo) return null;
  // instalações do time aceleram o treino
  const ganho = (especial ? LOOP.ganhoEspecial : LOOP.ganhoTreino) * (1 + bonusInstalacoes(career));
  return {
    ...career,
    player: {
      ...career.player,
      energia: clamp(career.player.energia - custo, 0, 100),
      atributos: {
        ...career.player.atributos,
        [atributo]: clamp(round2(career.player.atributos[atributo] + ganho), 0, 100),
      },
    },
  };
}

export function streaming(career: CareerState): CareerState | null {
  if (career.player.energia < LOOP.custoStream) return null;
  return {
    ...career,
    dinheiro: career.dinheiro + LOOP.ganhoStream,
    player: {
      ...career.player,
      energia: clamp(career.player.energia - LOOP.custoStream, 0, 100),
      reputacao: clamp(career.player.reputacao + LOOP.repStream, 0, 100),
    },
  };
}

// Alteração mental: ganha um traço novo (até o limite). null se faltar energia / cheio / já tem.
export function alteracaoMental(career: CareerState, traco: TraitId): CareerState | null {
  if (career.player.energia < LOOP.custoAlteracao) return null;
  if (career.player.tracos.includes(traco) || career.player.tracos.length >= LOOP.maxTracos) return null;
  return {
    ...career,
    player: {
      ...career.player,
      energia: clamp(career.player.energia - LOOP.custoAlteracao, 0, 100),
      tracos: [...career.player.tracos, traco],
    },
  };
}

export function gastarEnergiaSoloq(career: CareerState): CareerState {
  return {
    ...career,
    player: { ...career.player, energia: clamp(career.player.energia - LOOP.custoSoloq, 0, 100) },
  };
}

export function formaRecente(career: CareerState): number {
  const ult = career.historicoPartidas.slice(0, LOOP.janelaForma);
  if (ult.length === 0) return 5;
  return ult.reduce((acc, m) => acc + m.notaPerformance, 0) / ult.length;
}

// Única forma de recuperar energia: o tempo passar. "descanso" recupera tudo + moral.
export function avancarSemana(career: CareerState, modo: "normal" | "descanso" = "normal"): CareerState {
  const drift = (formaRecente(career) - 5) * LOOP.moralPorForma;
  const bonus = modo === "descanso" ? LOOP.moralDescanso : 0;
  const moral = clamp(Math.round((career.player.moral + drift + bonus) * 10) / 10, 0, 100);
  const energia = modo === "descanso" ? 100 : clamp(career.player.energia + LOOP.recuperaEnergiaSemana, 0, 100);

  let semanaAtual = career.semanaAtual + 1;
  let temporada = career.temporada;
  if (semanaAtual > LOOP.semanasPorTemporada) {
    semanaAtual = 1;
    temporada += 1;
  }

  return { ...career, semanaAtual, temporada, player: { ...career.player, energia, moral } };
}
