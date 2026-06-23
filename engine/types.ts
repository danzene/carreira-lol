// Tipos do domínio (modelo de dados do CLAUDE.md, seção 3).
// Vivem no /engine porque são a base da lógica pura; a UI importa daqui também.

export type Role = "TOP" | "JUNGLE" | "MID" | "ADC" | "SUPPORT";
export type Tier = "SOLOQ" | "AMADOR" | "ACADEMY" | "TIER1" | "INTERNACIONAL";

export interface Attributes {
  mecanica: number; // micro, combos, mira
  macro: number; // mapa, rotação, objetivos
  laning: number; // fase de rotas, wave management
  teamfight: number; // posicionamento e impacto em luta
  consistencia: number; // reduz variância de performance
  mental: number; // clutch, não tiltar, jogo sob pressão
  comunicacao: number; // sinergia/shotcalling com o time
  championPool: number; // versatilidade da pool
}

export type AtributoKey = keyof Attributes;

export interface ChampionMastery {
  championId: string;
  pontos: number; // 0–100
}

export interface RankSoloq {
  elo: string;
  lp: number;
  mmr: number;
}

export interface Player {
  nome: string;
  nacionalidade: string;
  idade: number;
  rota: Role;
  atributos: Attributes;
  pool: ChampionMastery[];
  reputacao: number; // 0–100, define as propostas que chegam
  rankSoloq: RankSoloq;
  energia: number; // 0–100, gasta treinando
  moral: number; // 0–100, afeta performance
}

export interface Contract {
  timeId: string;
  salarioSemanal: number;
  semanasRestantes: number;
  tier: Tier;
}

export interface KDA {
  k: number;
  d: number;
  a: number;
}

export interface MatchResult {
  vitoria: boolean;
  kda: KDA;
  notaPerformance: number; // 0–10 (MVP individual) — move reputação
  csPorMin: number;
  championId: string;
  lpDelta?: number; // se soloq
  xpGanho: Partial<Attributes>;
}

export interface Offer {
  timeId: string;
  tier: Tier;
  salarioSemanal: number;
  duracaoSemanas: number;
  condicao?: string;
}

export interface CareerState {
  player: Player;
  dinheiro: number;
  contratoAtual: Contract | null;
  semanaAtual: number;
  temporada: number;
  historicoPartidas: MatchResult[];
  inbox: Offer[];
  energiaEm?: number; // timestamp (ms) da última atualização da energia (regen em tempo real)
  coachAtivo?: boolean; // assinatura de coach (XP passivo semanal, custa upkeep)
  setupComprado?: boolean; // upgrade de setup já comprado (permanente, 1x)
}
