import type { RaridadeItem } from "./itens";

// ✨ Config de "juice" (apresentação): paleta por tier de raridade, durações e easings
// padrão das cerimônias. NADA aqui é regra de jogo — só estética reutilizável.

export type TierJuice = 1 | 2 | 3 | 4 | 5;

export interface InfoTier {
  tier: TierJuice;
  nome: string;
  cor: string;
  brilho: string; // cor do glow/partículas
}

export const TIERS_JUICE: Record<TierJuice, InfoTier> = {
  1: { tier: 1, nome: "Comum", cor: "#9a90c0", brilho: "#c9c2e6" },
  2: { tier: 2, nome: "Raro", cor: "#19e6e0", brilho: "#8ff5f2" },
  3: { tier: 3, nome: "Épico", cor: "#9a6bff", brilho: "#c9adff" },
  4: { tier: 4, nome: "Lendário", cor: "#ff2d7e", brilho: "#ff8ab5" },
  5: { tier: 5, nome: "Mítico", cor: "#ffe14d", brilho: "#fff3a8" },
};

// Item RPG (1..5) já é o próprio tier.
export function tierDeItem(r: RaridadeItem): TierJuice {
  return r;
}

// Lendas do gacha usam 3..6 (Prata/Ouro/Lendária/Mítica) → mapeia pro tier visual.
export function tierDeLenda(raridade: number): TierJuice {
  if (raridade >= 6) return 5;
  if (raridade >= 5) return 4;
  if (raridade >= 4) return 3;
  return 1;
}

// Durações padrão (ms). Tiers altos ganham antecipação extra (suspense).
export const DURACOES = {
  antecipacao: 650,
  antecipacaoAlta: 1250, // tier >= 4
  revelacao: 420,
  celebracao: 900,
  autoDismissFullscreen: 5000,
  autoDismissToast: 3200,
  barra: 700, // AnimatedBar
  numero: 650, // AnimatedNumber
} as const;

export function duracaoAntecipacao(tier: TierJuice): number {
  return tier >= 4 ? DURACOES.antecipacaoAlta : DURACOES.antecipacao;
}

// Easing padrão das transições CSS (elástico curto pro "pop").
export const EASING_POP = "cubic-bezier(0.34, 1.56, 0.64, 1)";
export const EASING_OUT = "cubic-bezier(0.22, 1, 0.36, 1)";

// Cor temática de cada faixa de elo (cerimônia de promoção, badges).
export function corElo(elo: string): string {
  if (elo.startsWith("Ferro")) return "#8a8a96";
  if (elo.startsWith("Bronze")) return "#c9803c";
  if (elo.startsWith("Prata")) return "#c8d0e0";
  if (elo.startsWith("Ouro")) return "#ffd34d";
  if (elo.startsWith("Platina")) return "#3ad6c2";
  if (elo.startsWith("Esmeralda")) return "#2fd66e";
  if (elo.startsWith("Diamante")) return "#4db8ff";
  if (elo.startsWith("Mestre")) return "#9a6bff";
  if (elo.startsWith("Grão")) return "#ff5a5a";
  return "#ffe14d"; // Desafiante
}
