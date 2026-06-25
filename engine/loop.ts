import { GACHA } from "@/data/gacha";
import { LOOP } from "@/data/loop";
import { mod } from "@/data/opcoes";
import { PATCH } from "@/data/patch";
import { efeitoLendas } from "./gacha";
import { bonusInstalacoes } from "./transferencias";
import type { Attributes, AtributoKey, CareerState, TraitId } from "./types";

// Loop semanal (PURO): energia, atividades e avanço de tempo.

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}
const round2 = (v: number): number => Math.round(v * 100) / 100;

// Decaimento semanal dos atributos (estilo Punch Club): sem treinar, você enferruja.
function decair(attrs: Attributes, total: number): Attributes {
  if (total <= 0) return attrs;
  const novo: Attributes = { ...attrs };
  (Object.keys(novo) as AtributoKey[]).forEach((k) => {
    novo[k] = clamp(round2(novo[k] - total), 0, 100);
  });
  return novo;
}

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
  const energia = modo === "descanso" ? 100 : clamp(career.player.energia + LOOP.ganhoAvancoEnergia, 0, 100);

  let semanaAtual = career.semanaAtual + 1;
  let temporada = career.temporada;
  if (semanaAtual > LOOP.semanasPorTemporada) {
    semanaAtual = 1;
    temporada += 1;
  }

  // Auto Patch: meta muda a cada PATCH.semanasPorPatch semanas (corridas).
  const semanaGlobal = (temporada - 1) * LOOP.semanasPorTemporada + semanaAtual;
  const patchVigente = Math.floor((semanaGlobal - 1) / PATCH.semanasPorPatch) + 1;

  // o tempo passa: atributos decaem (mais no difícil; lendas reduzem).
  const decaimento = LOOP.decaimentoSemanal * mod(career.opcoes).decaimento * (1 - efeitoLendas(career).reducaoDecaimento);
  const atributos = decair(career.player.atributos, decaimento);
  const scoutPontos = (career.scoutPontos ?? 0) + GACHA.porSemana;

  return { ...career, semanaAtual, temporada, patchVigente, scoutPontos, player: { ...career.player, energia, moral, atributos } };
}
