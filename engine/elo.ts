import { ELO_LADDER, RANK } from "@/data/simulacao";
import type { RankSoloq } from "./types";

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

export function aplicarResultadoRank(rank: RankSoloq, vitoria: boolean, mmrInimigo: number): ResultadoRank {
  const ajuste = Math.round((mmrInimigo - rank.mmr) / 40);
  let ganho = RANK.ganhoBase + (vitoria ? ajuste : -ajuste);
  ganho = Math.min(RANK.ganhoMax, Math.max(RANK.ganhoMin, ganho));

  const delta = vitoria ? ganho : -ganho;
  const novoMmr = Math.max(RANK.mmrBase, rank.mmr + delta);
  const lpDelta = novoMmr - rank.mmr;
  const { elo, lp } = eloDeMmr(novoMmr);
  return { rank: { elo, lp, mmr: novoMmr }, lpDelta };
}
