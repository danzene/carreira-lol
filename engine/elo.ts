import { DIFICULDADE_ELO, ELO_LADDER, RANK } from "@/data/simulacao";
import type { RankSoloq } from "./types";

// Índice do elo na ladder (0 = Ferro IV).
export function idxElo(elo: string): number {
  const i = ELO_LADDER.indexOf(elo as (typeof ELO_LADDER)[number]);
  return i < 0 ? 0 : i;
}

// Penalidade de vitória na soloq pelo elo: negativa no elo baixo (ajuda), positiva no alto (aperta).
export function dificuldadeSoloq(elo: string): number {
  return (idxElo(elo) - DIFICULDADE_ELO.pivo) * DIFICULDADE_ELO.fator;
}

export function eloDeMmr(mmr: number): { elo: string; lp: number } {
  const acima = Math.max(0, mmr - RANK.mmrBase);
  const idx = Math.min(Math.floor(acima / RANK.mmrPorDivisao), ELO_LADDER.length - 1);
  const lp = Math.min(100, Math.max(0, Math.round(mmr - (RANK.mmrBase + idx * RANK.mmrPorDivisao))));
  return { elo: ELO_LADDER[idx], lp };
}

export interface ResultadoRank {
  rank: RankSoloq;
  lpDelta: number;
}

// Próxima sequência: vitória soma (ou zera derrotas e vira 1); derrota o inverso.
export function proximoStreak(streak: number, vitoria: boolean): number {
  if (vitoria) return streak >= 0 ? streak + 1 : 1;
  return streak <= 0 ? streak - 1 : -1;
}

export function aplicarResultadoRank(rank: RankSoloq, vitoria: boolean, mmrInimigo: number): ResultadoRank {
  const ajuste = Math.round((mmrInimigo - rank.mmr) / 40);
  let ganho = RANK.ganhoBase + (vitoria ? ajuste : -ajuste);
  ganho = Math.min(RANK.ganhoMax, Math.max(RANK.ganhoMin, ganho));

  // Bônus de sequência (estilo LoL): cada vitória/derrota seguida (da 2ª em diante)
  // aumenta o ganho/perda de PDL — quem está quente sobe mais, quem está frio cai mais.
  const streak = proximoStreak(rank.streak ?? 0, vitoria);
  const bonus = Math.min(RANK.streakBonusMax, Math.max(0, Math.abs(streak) - 1) * RANK.streakBonusPasso);
  ganho += bonus;

  const delta = vitoria ? ganho : -ganho;
  const novoMmr = Math.max(RANK.mmrBase, rank.mmr + delta);
  const lpDelta = novoMmr - rank.mmr;
  const { elo, lp } = eloDeMmr(novoMmr);
  return { rank: { elo, lp, mmr: novoMmr, streak }, lpDelta };
}
