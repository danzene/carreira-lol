// Modelo de dados (CLAUDE.md, seção 3). Plano novo: pixel art estilo Teamfight
// Manager, draft como sistema central, traços e classes de campeão.
// Tipos puros, sem comportamento — o /engine consome estes tipos.

export type Role = "TOP" | "JUNGLE" | "MID" | "ADC" | "SUPPORT";
export type Tier = "SOLOQ" | "AMADOR" | "ACADEMY" | "TIER1" | "INTERNACIONAL";
export type Classe = "TANK" | "LUTADOR" | "MAGO" | "ATIRADOR" | "ASSASSINO" | "SUPORTE";

export interface Attributes {
  mecanica: number;
  macro: number;
  laning: number;
  teamfight: number;
  consistencia: number; // reduz variância de performance
  mental: number; // clutch / não tiltar
  comunicacao: number; // sinergia e shotcalling
  championPool: number; // versatilidade da pool
}

export type AtributoKey = keyof Attributes;

// Traços (inspirados no TFM): efeitos diferenciados, bons ou ruins.
export type TraitId =
  | "ROAMER"
  | "LANE_BULLY"
  | "CLUTCH"
  | "FLEX"
  | "CARRY_TARDIO"
  | "AGRESSIVO"
  | "TILTAVEL"
  | "FRIO"
  | "SHOTCALLER";

export interface PerfilCampeao {
  dano: number;
  resistencia: number;
  cc: number;
  mobilidade: number;
  sustain: number;
}

export interface ChampionDef {
  id: string; // id do Data Dragon
  nome: string;
  classes: Classe[];
  rolesValidas: Role[];
  perfil: PerfilCampeao; // perfil simplificado p/ a batalha
  forcaMetaBase: number; // ajustada pelo Auto Patch (win rate)
}

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
  tracos: TraitId[];
  reputacao: number; // define as propostas que chegam
  rankSoloq: RankSoloq;
  energia: number;
  moral: number;
}

export interface Equip {
  tipo: "HEADSET" | "MOUSE" | "CADEIRA" | "MONITOR";
  nivel: number;
  bonus: Partial<Attributes>;
}

export interface Contract {
  timeId: string;
  salarioSemanal: number;
  bonusPorVitoria: number;
  semanasRestantes: number;
  tier: Tier;
}

export interface Offer {
  timeId: string;
  tier: Tier;
  salarioSemanal: number;
  bonusPorVitoria: number;
  duracaoSemanas: number;
  condicao?: string;
}

export interface KDA {
  k: number;
  d: number;
  a: number;
}

export interface MatchResult {
  vitoria: boolean;
  kda: KDA;
  notaPerformance: number; // 0–10 individual — move reputação
  csPorMin: number;
  championId: string;
  lpDelta?: number;
  xpGanho: Partial<Attributes>;
  log: string[]; // narração da batalha p/ o viewer
}

export interface CareerState {
  player: Player;
  dinheiro: number;
  equipamentos: Equip[];
  contratoAtual: Contract | null;
  semanaAtual: number;
  temporada: number;
  tierAtual: Tier;
  historicoPartidas: MatchResult[];
  inbox: Offer[];
  patchVigente: number; // win rates mudam a cada split
  energiaEm?: number; // timestamp (ms) da regen de energia em tempo real (infra)
  coachAtivo?: boolean; // assinatura de coach (XP passivo semanal, custa upkeep)
}
