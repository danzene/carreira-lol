// 🏠 Gaming House — balanceamento (dados puros). Os 4 botões vagos (TREINO/ESPECIAL/
// STREAM/MENTAL) viram ESTAÇÕES com decisão real: ONDE treinar, COM QUE INTENSIDADE e
// COM QUE FOCO. Inspirado no Punch Club: ficamos com o TRADE-OFF (recursos, humor
// multiplicando, especialização por escolha) e banimos o ROUBO (decay punitivo).
//
// CALIBRAÇÃO (Regra 3): o otimizador antigo rendia 3.0 attr / 35⚡ (ESPECIAL ≈ 0.086/⚡).
// O melhor caso novo (intensa + foco + moral alta, 1ª sessão da semana) ≈ 0.080/⚡ —
// mesma ordem de grandeza; a simulação comparativa (Fase 3) valida ±15%.

import type { Attributes } from "@/engine/types";

export type EstacaoId =
  | "REPLAY_ROOM"
  | "AIM_TRAINER"
  | "CUSTOM_1V1"
  | "SCRIM_SIM"
  | "CHAMPION_PRACTICE"
  | "ACADEMIA_SONO_TERAPIA"
  | "SALA_DE_STREAM"
  | "ANALISE_ADVERSARIO";

export type Intensidade = "leve" | "normal" | "intensa";
export type VarianteMental = "academia" | "sono" | "terapia";

export interface DefEstacao {
  id: EstacaoId;
  nome: string;
  emoji: string;
  desc: string;
  custoBase: number; // energia (multiplicada pela intensidade)
  fadigaBase: number; // fadiga que a sessão acumula (multiplicada pela intensidade)
  ganhos: Partial<Attributes>; // XP de atributo por sessão NORMAL (antes dos multiplicadores)
  maestria?: number; // CHAMPION_PRACTICE: maestria no campeão escolhido
  dinheiro?: number; // SALA_DE_STREAM: $ base
  reputacao?: number; // SALA_DE_STREAM: reputação
}

export const ESTACOES: Record<EstacaoId, DefEstacao> = {
  REPLAY_ROOM: {
    id: "REPLAY_ROOM", nome: "Sala de Replay", emoji: "📼",
    desc: "VOD review: entender o mapa vem antes do clique.",
    custoBase: 20, fadigaBase: 12, ganhos: { macro: 0.8, consistencia: 0.3 },
  },
  AIM_TRAINER: {
    id: "AIM_TRAINER", nome: "Aim Trainer", emoji: "🎯",
    desc: "Precisão crua: flicks, tracking, combos.",
    custoBase: 20, fadigaBase: 12, ganhos: { mecanica: 1.0 },
  },
  CUSTOM_1V1: {
    id: "CUSTOM_1V1", nome: "Custom 1v1", emoji: "⚔️",
    desc: "Lane de verdade contra sparring: trades, waves, all-in.",
    custoBase: 20, fadigaBase: 14, ganhos: { laning: 0.8, mecanica: 0.3 },
  },
  SCRIM_SIM: {
    id: "SCRIM_SIM", nome: "Simulador de Scrim", emoji: "🖥️",
    desc: "Teamfight 5v5 com calls: quem fala, ganha.",
    custoBase: 25, fadigaBase: 16, ganhos: { teamfight: 0.75, comunicacao: 0.55 },
  },
  CHAMPION_PRACTICE: {
    id: "CHAMPION_PRACTICE", nome: "Treino de Campeão", emoji: "🧙",
    desc: "Reps num campeão da sua pool: maestria sobe junto.",
    custoBase: 20, fadigaBase: 12, ganhos: { championPool: 0.7 }, maestria: 2.5,
  },
  ACADEMIA_SONO_TERAPIA: {
    id: "ACADEMIA_SONO_TERAPIA", nome: "Bem-estar", emoji: "🛏️",
    desc: "Academia (Mental), sono (recupera fadiga) ou terapia (recupera Moral).",
    custoBase: 20, fadigaBase: 10, ganhos: { mental: 0.9 }, // variante ACADEMIA; sono/terapia abaixo
  },
  SALA_DE_STREAM: {
    id: "SALA_DE_STREAM", nome: "Sala de Stream", emoji: "🔴",
    desc: "Liga a câmera: $ e reputação — mas streamar cansa.",
    custoBase: 15, fadigaBase: 18, ganhos: {}, dinheiro: 60, reputacao: 0.5,
  },
  ANALISE_ADVERSARIO: {
    id: "ANALISE_ADVERSARIO", nome: "Quadro Tático", emoji: "📋",
    desc: "Estuda o PRÓXIMO adversário oficial: revela tendências e dá vantagem de draft.",
    custoBase: 35, fadigaBase: 8, ganhos: {},
  },
};

// Variantes da estação de bem-estar (a antiga MENTAL). A 4ª variante — ganhar TRAÇO
// (alteração mental) — continua existindo via engine/loop.alteracaoMental (código vence).
export const VARIANTES_MENTAL: Record<VarianteMental, { nome: string; emoji: string; custo: number; fadiga: number; moral: number; mental: number; limpaBurnout: boolean }> = {
  academia: { nome: "Academia", emoji: "🏋️", custo: 20, fadiga: 10, moral: 0, mental: 0.9, limpaBurnout: false },
  sono: { nome: "Sono reparador", emoji: "😴", custo: 5, fadiga: -35, moral: 2, mental: 0, limpaBurnout: true },
  terapia: { nome: "Terapia", emoji: "🛋️", custo: 15, fadiga: -10, moral: 12, mental: 0, limpaBurnout: false },
};

export const CASA = {
  // 🧗 pisos de consolidação (Regra 2 — a lição do Punch Club): ao cruzar um marco,
  // ele vira PERMANENTE; o decay semanal nunca derruba abaixo do último marco.
  marcos: [20, 40, 60, 80] as readonly number[],

  // 🎭 Moral multiplica o treino (o "humor" do Punch Club, transparente na UI)
  moralAltaMin: 75,
  moralAltaMult: 1.18,
  moralBaixaMax: 30,
  moralBaixaMult: 0.85,

  // 🎯 Foco da Semana: 2 atributos declarados; sessões que os treinam ganham bônus
  focoBonus: 0.28,
  focoMax: 2,

  // 📉 rendimentos decrescentes POR ESTAÇÃO na semana (empurra variedade):
  // mult = max(piso, 1 − passo·(n−1)) na n-ésima sessão da semana naquela estação.
  // O Coach contratado reduz o passo (F2) — treinos repetidos rendem mais com coach.
  decrescentePasso: 0.3,
  decrescentePassoComCoach: 0.18,
  decrescentePiso: 0.4,

  // 😮‍💨 fadiga (0-100) e burnout — o "overtraining" SEM roubo: temporário e visível
  fadigaMax: 100,
  burnoutMs: 24 * 60 * 60 * 1000, // 1 dia real (ou até dormir/descansar)
  burnoutMult: 0.4, // sessões rendem isto durante o burnout
  burnoutMoralExtra: 2, // moral extra perdida por sessão em burnout
  fadigaAvancarSemana: 30, // dissipação ao avançar a semana (descanso zera)

  // 🎚️ intensidades: o trade-off central (custo × ganho × fadiga × moral)
  intensidades: {
    leve: { custo: 0.6, ganho: 0.55, fadiga: 0.55, moral: 0 },
    normal: { custo: 1, ganho: 1, fadiga: 1, moral: 0 },
    intensa: { custo: 1.6, ganho: 1.7, fadiga: 1.8, moral: -2 },
  } as Record<Intensidade, { custo: number; ganho: number; fadiga: number; moral: number }>,

  // 📋 Análise de Adversário: bônus PEQUENO, de UMA partida, só contra o time estudado
  analiseBonusComp: 2, // entra no counterComp do draft (fora do snapshot ranqueado)
} as const;

export function defEstacao(id: EstacaoId): DefEstacao {
  return ESTACOES[id];
}
