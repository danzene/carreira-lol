import type { AtributoKey, Role } from "@/engine/types";

// 🎚️ Balanceamento da simulação de partida (Fase 2). Ajuste tudo aqui.

// Peso de cada atributo na "força de rota", por rota (cada rota soma ~1).
export const PESOS_ROTA: Record<Role, Partial<Record<AtributoKey, number>>> = {
  TOP: { laning: 0.25, mecanica: 0.2, teamfight: 0.2, macro: 0.15, consistencia: 0.1, mental: 0.1 },
  JUNGLE: { macro: 0.3, mecanica: 0.2, teamfight: 0.2, comunicacao: 0.15, mental: 0.15 },
  MID: { mecanica: 0.25, laning: 0.2, teamfight: 0.2, macro: 0.15, championPool: 0.1, consistencia: 0.1 },
  ADC: { mecanica: 0.3, teamfight: 0.25, laning: 0.2, consistencia: 0.15, mental: 0.1 },
  SUPPORT: { comunicacao: 0.3, macro: 0.2, teamfight: 0.2, mental: 0.15, laning: 0.15 },
};

export const SIMULACAO = {
  // composição da força individual (dirige a nota)
  pesoRota: 0.7,
  pesoCampeao: 0.3,
  // ruído (variância): amplitude reduzida por (consistência + mental)
  ruidoMax: 22, // pior caso (estabilidade baixa)
  ruidoMin: 6, // melhor caso (estabilidade alta)
  // geração do lobby
  espalhamentoLobby: 10, // variação de força dos outros jogadores
  // vitória: sensibilidade da logística à diferença de força dos times
  sensibilidadeVitoria: 0.08,
  // nota 0-10
  notaBase: 5,
  notaPorPontoAcima: 0.09, // por ponto de força acima do nível do lobby
  notaRuido: 0.8,
  // xp (ganho de atributo por partida)
  xpPorPartida: 0.5, // total aprox. distribuído nos atributos da rota
  xpBonusLobbyForte: 0.5, // extra por jogar acima do seu nível
} as const;

// Escala MMR -> nível médio (0-100) do lobby. Sobe conforme você escala.
export const NIVEL = {
  mmrBase: 800,
  mmrPorNivel: 22,
  nivelMin: 15,
  nivelMax: 95,
} as const;

// Ladder de elo. Cada divisão = 100 de MMR = 0-100 LP.
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
  ganhoBase: 20, // LP/MMR médio por vitória
  ganhoMin: 12,
  ganhoMax: 28,
} as const;
