import type { AtributoKey, Role } from "@/engine/types";

// 🎚️ Balanceamento do motor de partida (Fase 4).

export const PESOS_ROTA: Record<Role, Partial<Record<AtributoKey, number>>> = {
  TOP: { laning: 0.25, mecanica: 0.2, teamfight: 0.2, macro: 0.15, consistencia: 0.1, mental: 0.1 },
  JUNGLE: { macro: 0.3, mecanica: 0.2, teamfight: 0.2, comunicacao: 0.15, mental: 0.15 },
  MID: { mecanica: 0.25, laning: 0.2, teamfight: 0.2, macro: 0.15, championPool: 0.1, consistencia: 0.1 },
  ADC: { mecanica: 0.3, teamfight: 0.25, laning: 0.2, consistencia: 0.15, mental: 0.1 },
  SUPPORT: { comunicacao: 0.3, macro: 0.2, teamfight: 0.2, mental: 0.15, laning: 0.15 },
};

export const SIMULACAO = {
  // base = pesoRota*forcaRota + pesoCampeao*forcaCampeao + pesoTime*forcaTime + pesoComp*forcaComp
  pesoRota: 0.35,
  pesoCampeao: 0.25,
  pesoTime: 0.2,
  pesoComp: 0.2,
  forcaTimeBase: 50, // força genérica do time (depois vem do tier/contrato)
  ruidoMax: 20, // variância (estabilidade baixa)
  ruidoMin: 6, // variância (estabilidade alta)
  sensibilidadeVitoria: 0.09,
  notaBase: 5,
  notaPorPonto: 0.1, // por ponto de forcaFinal acima de 50
  notaRuido: 0.8,
  xpPorPartida: 0.5,
  repPorNota: 0.5, // reputação += (nota - 5) * isto por partida
  pesoForcaTimeVitoria: 0.6, // o quanto a diferença de força dos times pesa na vitória (oficial)
} as const;

export const ELO_LADDER = [
  "Ferro IV", "Ferro III", "Ferro II", "Ferro I",
  "Bronze IV", "Bronze III", "Bronze II", "Bronze I",
  "Prata IV", "Prata III", "Prata II", "Prata I",
  "Ouro IV", "Ouro III", "Ouro II", "Ouro I",
  "Platina IV", "Platina III", "Platina II", "Platina I",
  "Esmeralda IV", "Esmeralda III", "Esmeralda II", "Esmeralda I",
  "Diamante IV", "Diamante III", "Diamante II", "Diamante I",
  "Mestre", "Grão-Mestre", "Desafiante",
] as const;

export const RANK = {
  mmrBase: 800,
  mmrPorDivisao: 100,
  ganhoBase: 20,
  ganhoMin: 12,
  ganhoMax: 28,
} as const;
