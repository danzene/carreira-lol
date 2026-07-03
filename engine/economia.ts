import { ECONOMIA } from "@/data/economia";
import { LOOP } from "@/data/loop";
import { mod } from "@/data/opcoes";
import { efeitoLendas } from "./gacha";
import type { Attributes, AtributoKey, CareerState } from "./types";

// Economia (PURO): salário, bônus e coach.

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

export function salarioSemanal(career: CareerState): number {
  const base = career.contratoAtual?.salarioSemanal ?? ECONOMIA.rendaBaseSemanal;
  return Math.round(base * mod(career.opcoes).dinheiro * efeitoLendas(career).dinheiroMult);
}

export function bonusVitoria(career: CareerState): number {
  const base = career.contratoAtual?.bonusPorVitoria ?? ECONOMIA.bonusBaseVitoria;
  return Math.round(base * mod(career.opcoes).dinheiro * efeitoLendas(career).dinheiroMult);
}

// Renda + coach, ao avançar a semana.
export function processarSemanaEconomia(career: CareerState): CareerState {
  let dinheiro = career.dinheiro + salarioSemanal(career);
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

// Sessão mental: com a MORAL BAIXA (<40) fica mais barata E mais eficaz — anti-tilt:
// quando você mais precisa, a ajuda custa menos e rende mais.
export function sessaoMental(career: CareerState): CareerState | null {
  const abalado = career.player.moral < 40;
  const custo = abalado ? Math.round(ECONOMIA.sessaoMental.custo / 2) : ECONOMIA.sessaoMental.custo;
  const ganhoMoral = abalado ? ECONOMIA.sessaoMental.moral + 15 : ECONOMIA.sessaoMental.moral;
  if (career.dinheiro < custo) return null;
  return {
    ...career,
    dinheiro: career.dinheiro - custo,
    player: {
      ...career.player,
      moral: clamp(career.player.moral + ganhoMoral, 0, 100),
      energia: clamp(career.player.energia + ECONOMIA.sessaoMental.energia, 0, 100),
    },
  };
}

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

// (Os periféricos antigos foram REMOVIDOS — o setup agora são os itens ARPG.
//  Saves com periféricos são reembolsados em $ na migração: normalizarCareer.)
