import { ECONOMIA, EQUIP_INFO, EQUIP_MAX_NIVEL } from "@/data/economia";
import { LOOP } from "@/data/loop";
import { mod } from "@/data/opcoes";
import { efeitoLendas } from "./gacha";
import type { Attributes, AtributoKey, CareerState, Equip } from "./types";

// Economia (PURO): salário, bônus, coach e crafting de periféricos.

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

// Soma os bônus de atributo de todos os periféricos.
export function bonusEquipamentos(equipamentos: Equip[]): Partial<Attributes> {
  const b: Partial<Attributes> = {};
  for (const e of equipamentos) {
    for (const [k, v] of Object.entries(e.bonus) as [AtributoKey, number][]) {
      b[k] = (b[k] ?? 0) + v;
    }
  }
  return b;
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

export function nivelEquip(career: CareerState, tipo: Equip["tipo"]): number {
  return career.equipamentos.find((e) => e.tipo === tipo)?.nivel ?? 0;
}

export function custoUpgrade(nivelAtual: number): number {
  return ECONOMIA.custoEquipBase + nivelAtual * ECONOMIA.custoEquipPorNivel;
}

export function upgradeEquip(career: CareerState, tipo: Equip["tipo"]): CareerState | null {
  const nivel = nivelEquip(career, tipo);
  if (nivel >= EQUIP_MAX_NIVEL) return null;
  const custo = custoUpgrade(nivel);
  if (career.dinheiro < custo) return null;

  const info = EQUIP_INFO[tipo];
  const novoNivel = nivel + 1;
  const novo: Equip = { tipo, nivel: novoNivel, bonus: { [info.atributo]: round2(info.bonusPorNivel * novoNivel) } };
  const equipamentos = [...career.equipamentos.filter((e) => e.tipo !== tipo), novo];
  return { ...career, dinheiro: career.dinheiro - custo, equipamentos };
}
