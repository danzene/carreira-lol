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
  streak?: number; // sequência atual: >0 vitórias seguidas, <0 derrotas seguidas
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

// ----- Opções de nova carreira (Fase 11) -----
// (sem dificuldade — o jogo é linear; ver data/opcoes.ts)
export interface OpcoesCarreira {
  esconderAtributos: boolean; // modo imersão: esconde os números dos atributos
  fearless: boolean; // não dá pra repetir campeões jogados recentemente
}

// ----- Partidas-evento (Fase 11 p2) -----
export interface EventoAtivo {
  tipo: string; // id do modelo
  nome: string;
  desc: string;
  bonusInimigo: number; // força extra do adversário
  premioDinheiro: number;
  premioReputacao: number;
}

// ----- Liga / campeonatos (Fase 8) -----
export type FaseLiga = "REGULAR" | "PLAYOFFS" | "ENCERRADA";

export interface TimeClassificacao {
  timeId: string; // "VOCE" representa o jogador
  vitorias: number;
  derrotas: number;
}

export interface ConfrontoIA {
  casaId: string;
  foraId: string;
}

export interface RodadaLiga {
  adversarioId: string; // oponente do jogador nesta rodada
  outros: ConfrontoIA[]; // confrontos IA x IA da mesma rodada
  jogada: boolean;
}

export interface ConfrontoPO {
  aId: string;
  bId: string;
  vencedorId?: string;
}

export interface PlayoffState {
  sf: ConfrontoPO[]; // 2 semifinais (1º×4º, 2º×3º)
  final?: ConfrontoPO;
}

export interface LigaState {
  tier: Tier;
  participantes: string[]; // timeIds, inclui "VOCE"
  classificacao: TimeClassificacao[];
  calendario: RodadaLiga[];
  rodadaAtual: number;
  fase: FaseLiga;
  playoff?: PlayoffState;
  colocacaoFinal?: number; // posição final do jogador quando ENCERRADA
  campeao?: string;
}

// Torneio internacional (MSI / Worlds) — usa o mesmo bracket da liga (grupo + mata-mata).
export interface TorneioInternacional {
  tipo: "MSI" | "WORLDS";
  nome: string;
  bracket: LigaState;
}

// ----- Scout Gacha (Lendas) -----
export interface SubstatValor {
  chave: string;
  valor: number;
}

export interface LendaPossuida {
  id: string; // modelo (data/gacha)
  nivel: number; // sobe com duplicatas
  substats: SubstatValor[]; // rolagem aleatória
}

// ----- Ritual diário (retenção) -----
export interface EstadoDiario {
  ultimoLoginDia: string; // "YYYY-MM-DD" local
  streak: number; // dias consecutivos
  escudoUsadoEm?: string; // dia em que o escudo foi consumido (1 por semana)
  puxadaGratisEm?: string; // dia da última puxada grátis no Booster
  recompensaColetadaEm?: string; // dia da última recompensa de streak coletada
}

// Estatísticas acumuladas da semana corrente (recap "wrapped" ao avançar).
export interface StatsSemana {
  partidas: number;
  vitorias: number;
  melhorKda?: KDA;
  melhorNota: number;
  lpLiquido: number;
  dropsPorRaridade: Record<number, number>;
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
  opcoes?: OpcoesCarreira; // modos (imersão/fearless); ausente em saves antigos
  eventoAtual?: EventoAtivo; // partida-evento disponível (Fase 11 p2)
  conquistas?: string[]; // ids de conquistas desbloqueadas (Fase 12)
  torneioAtual?: TorneioInternacional; // MSI/Worlds em disputa (circuito mundial p2)
  titulosInternacionais?: string[]; // "MSI" | "WORLDS" conquistados
  // ⏱️ progressão por tempo real (ausente em saves antigos)
  energiaEm?: number; // epoch ms da última atualização da energia (regen passivo)
  avancosEm?: number[]; // timestamps dos avanços de semana na janela atual
  descansosEm?: number[]; // timestamps dos descansos na janela atual
  cargasPartida?: number; // cargas de partida de campeonato acumuladas (regen por tempo)
  cargasEm?: number; // epoch ms da última atualização das cargas de partida
  scoutPontos?: number; // moeda do gacha (CoinPoints); campo interno mantém o nome p/ não quebrar saves
  lendas?: LendaPossuida[]; // cartas de lenda possuídas
  lendasEquipadas?: string[]; // ids equipados (até GACHA.slots)
  pity?: number; // puxadas desde o último 5★
  liga?: LigaState; // temporada/campeonato do time atual (Fase 8)
  coachAtivo?: boolean; // assinatura de coach (XP passivo semanal, custa upkeep)
  diario?: EstadoDiario; // streak de login + puxada grátis (ausente em saves antigos)
  unlocksLegacy?: boolean; // save antigo = features todas destravadas (migração)
  statsSemana?: StatsSemana; // stats da semana corrente (recap ao avançar)
  statsSemanaAnterior?: StatsSemana; // pra comparação ↑↓ no recap
}
