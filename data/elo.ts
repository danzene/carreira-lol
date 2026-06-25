import { ELO_LADDER } from "./simulacao";

// 🏅 Apresentação dos elos: cor por tier + parsing de "Ferro IV" → tier/divisão.
// A lógica de MMR fica em engine/elo.ts; aqui é só o visual.

export const TIER_COR: Record<string, string> = {
  Ferro: "#7d7066",
  Bronze: "#b06b3a",
  Prata: "#aab4c0",
  Ouro: "#e8b23c",
  Platina: "#36c2b0",
  Esmeralda: "#2fb15e",
  Diamante: "#5aa0ff",
  Mestre: "#b75cff",
  "Grão-Mestre": "#ef5a6e",
  Desafiante: "#f5d873",
};

const DIVISOES = ["IV", "III", "II", "I"];

export interface InfoElo {
  tier: string;
  divisao: string; // "IV".."I" ou "" (Mestre+)
  cor: string;
  idx: number; // posição na ladder (0 = Ferro IV)
}

export function infoElo(elo: string): InfoElo {
  const idx = ELO_LADDER.indexOf(elo as (typeof ELO_LADDER)[number]);
  const partes = elo.split(" ");
  const divisao = DIVISOES.includes(partes[partes.length - 1]) ? partes[partes.length - 1] : "";
  const tier = divisao ? partes.slice(0, -1).join(" ") : elo;
  return { tier, divisao, cor: TIER_COR[tier] ?? TIER_COR.Ferro, idx };
}

export function proximoElo(elo: string): string | null {
  const idx = ELO_LADDER.indexOf(elo as (typeof ELO_LADDER)[number]);
  return idx >= 0 && idx < ELO_LADDER.length - 1 ? ELO_LADDER[idx + 1] : null;
}

// Lista de elos a partir do atual (inclusive), para a "trilha" visual.
export function trilhaElos(elo: string, quantos = 5): string[] {
  const idx = Math.max(0, ELO_LADDER.indexOf(elo as (typeof ELO_LADDER)[number]));
  return ELO_LADDER.slice(idx, idx + quantos) as unknown as string[];
}

export const TOTAL_ELOS = ELO_LADDER.length;
