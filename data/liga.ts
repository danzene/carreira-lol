import type { Tier } from "@/engine/types";

// 🏆 Balanceamento das ligas/campeonatos (Fase 8).

export const VOCE = "VOCE"; // id do jogador na classificação

export const LIGA = {
  tamanhoPlayoff: 4, // top 4 vão pros playoffs (semis + final)
} as const;

// Premiação em dinheiro por colocação final (índice 0 = campeão, 1 = vice,
// 2 = semifinalista, depois participação). Escala com o tier.
export const PREMIO_DINHEIRO: Record<Tier, number[]> = {
  SOLOQ: [0, 0, 0, 0, 0, 0],
  AMADOR: [800, 400, 200, 200, 120, 120],
  ACADEMY: [2500, 1200, 600, 600, 350, 350],
  TIER1: [8000, 4000, 2000, 2000, 1100, 1100],
  INTERNACIONAL: [25000, 12000, 6000, 6000, 3500, 3500],
};

// Reputação ganha por colocação final (ajuda a empurrar pra promoção).
export const PREMIO_REPUTACAO: Record<Tier, number[]> = {
  SOLOQ: [0, 0, 0, 0, 0, 0],
  AMADOR: [6, 3, 1, 1, 0, 0],
  ACADEMY: [8, 4, 2, 2, 0, 0],
  TIER1: [12, 6, 3, 3, 1, 1],
  INTERNACIONAL: [20, 10, 5, 5, 2, 2],
};

// Ordem dos tiers competitivos (para promoção/rebaixamento). SOLOQ fica de fora.
export const ORDEM_TIER: Tier[] = ["AMADOR", "ACADEMY", "TIER1", "INTERNACIONAL"];
