import { ECONOMIA } from "@/data/economia";
import { LOOP } from "@/data/loop";
import type { Attributes, AtributoKey, CareerState } from "./types";

// Economia: renda semanal, upkeep do coach e investimentos. Tudo puro.

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

const round2 = (v: number): number => Math.round(v * 100) / 100;

function somaXpTodos(attrs: Attributes, porAtributo: number): Attributes {
  const novo: Attributes = { ...attrs };
  (Object.keys(novo) as AtributoKey[]).forEach((k) => {
    novo[k] = clamp(round2(novo[k] + porAtributo), 0, 100);
  });
  return novo;
}

// Processa a economia da semana (chamado junto com avancarSemana): renda + coach.
export function processarSemanaEconomia(career: CareerState): CareerState {
  let dinheiro = career.dinheiro + ECONOMIA.rendaBaseSemanal + (career.contratoAtual?.salarioSemanal ?? 0);
  let atributos = career.player.atributos;
  let coachAtivo = career.coachAtivo ?? false;

  if (coachAtivo) {
    if (dinheiro >= ECONOMIA.coach.upkeepSemanal) {
      dinheiro -= ECONOMIA.coach.upkeepSemanal;
      atributos = somaXpTodos(atributos, ECONOMIA.coach.xpPorAtributo);
    } else {
      coachAtivo = false; // sem grana pro coach: contrato encerrado
    }
  }

  return { ...career, dinheiro, coachAtivo, player: { ...career.player, atributos } };
}

// Live de stream: troca energia por dinheiro (+ um pouco de moral).
export function stream(career: CareerState): CareerState | null {
  if (career.player.energia < ECONOMIA.stream.energia) return null;
  return {
    ...career,
    dinheiro: career.dinheiro + ECONOMIA.stream.dinheiro,
    player: {
      ...career.player,
      energia: clamp(career.player.energia - ECONOMIA.stream.energia, 0, 100),
      moral: clamp(career.player.moral + ECONOMIA.stream.moral, 0, 100),
    },
  };
}

// Upgrade de setup: +mecânica permanente, só pode comprar uma vez.
export function comprarSetup(career: CareerState): CareerState | null {
  if (career.setupComprado || career.dinheiro < ECONOMIA.setup.custo) return null;
  return {
    ...career,
    dinheiro: career.dinheiro - ECONOMIA.setup.custo,
    setupComprado: true,
    player: {
      ...career.player,
      atributos: {
        ...career.player.atributos,
        mecanica: clamp(round2(career.player.atributos.mecanica + ECONOMIA.setup.mecanica), 0, 100),
      },
    },
  };
}

// Sessão com psicólogo/nutricionista: recupera moral e energia.
export function sessaoMental(career: CareerState): CareerState | null {
  if (career.dinheiro < ECONOMIA.sessaoMental.custo) return null;
  return {
    ...career,
    dinheiro: career.dinheiro - ECONOMIA.sessaoMental.custo,
    player: {
      ...career.player,
      moral: clamp(career.player.moral + ECONOMIA.sessaoMental.moral, 0, 100),
      energia: clamp(career.player.energia + ECONOMIA.sessaoMental.energia, 0, 100),
    },
  };
}

// Bootcamp na Coreia: caro, consome semanas, dá um bom XP geral (permanente).
export function bootcampCoreia(career: CareerState): CareerState | null {
  if (career.dinheiro < ECONOMIA.bootcamp.custo) return null;

  let semanaAtual = career.semanaAtual + ECONOMIA.bootcamp.semanas;
  let temporada = career.temporada;
  while (semanaAtual > LOOP.semanasPorTemporada) {
    semanaAtual -= LOOP.semanasPorTemporada;
    temporada += 1;
  }

  return {
    ...career,
    dinheiro: career.dinheiro - ECONOMIA.bootcamp.custo,
    semanaAtual,
    temporada,
    player: { ...career.player, atributos: somaXpTodos(career.player.atributos, ECONOMIA.bootcamp.xpTotal / 8) },
  };
}

export function alternarCoach(career: CareerState): CareerState {
  return { ...career, coachAtivo: !(career.coachAtivo ?? false) };
}
