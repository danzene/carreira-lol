// 🎟️ Passe de Batalha. PURO (dados/balanceamento). Temporada em tempo real (~6 semanas).
// O motor (gerar missões, subir nível, resgatar) fica em engine/passe.ts.

export const PASSE = {
  niveis: 60,
  porPagina: 10, // 6 páginas de 10 níveis
  ppPorNivel: 100, // Pontos de Passe por nível
  duracaoDias: 42, // temporada ~6 semanas
  premiumBonusPP: 0.1, // +10% PP com o passe premium (aplicado na fatia de monetização)
  qtdDiarias: 3, // missões diárias ativas
  qtdSemanais: 2, // missões semanais ativas
} as const;

export const paginas = PASSE.niveis / PASSE.porPagina; // 6

// ---- Missões ----
export type EscopoMissao = "diaria" | "semanal";
export type TipoMissao = "jogar" | "vencer" | "treinar" | "stream" | "campeonato" | "booster" | "subir_elo" | "equipar_item";

export interface DefMissao {
  tipo: TipoMissao;
  texto: string;
  escopo: EscopoMissao;
  alvo: number;
  pp: number;
}

export const MISSOES_DIARIAS: DefMissao[] = [
  { tipo: "jogar", texto: "Jogue 3 partidas", escopo: "diaria", alvo: 3, pp: 50 },
  { tipo: "vencer", texto: "Vença 1 partida", escopo: "diaria", alvo: 1, pp: 40 },
  { tipo: "treinar", texto: "Treine 2 vezes", escopo: "diaria", alvo: 2, pp: 30 },
  { tipo: "stream", texto: "Faça 1 stream", escopo: "diaria", alvo: 1, pp: 30 },
  { tipo: "booster", texto: "Puxe 1× no Carreira Booster", escopo: "diaria", alvo: 1, pp: 40 },
];

export const MISSOES_SEMANAIS: DefMissao[] = [
  { tipo: "vencer", texto: "Vença 10 partidas", escopo: "semanal", alvo: 10, pp: 200 },
  { tipo: "campeonato", texto: "Jogue 3 partidas de campeonato", escopo: "semanal", alvo: 3, pp: 180 },
  { tipo: "jogar", texto: "Jogue 20 partidas", escopo: "semanal", alvo: 20, pp: 150 },
  { tipo: "equipar_item", texto: "Equipe um item", escopo: "semanal", alvo: 1, pp: 120 },
  { tipo: "subir_elo", texto: "Suba 2 divisões de elo", escopo: "semanal", alvo: 2, pp: 200 },
];

// ---- Recompensas ----
export type TipoRecompensa = "coinpoints" | "item" | "ingresso" | "moldura";

export interface Recompensa {
  nivel: number;
  trilha: "free" | "premium";
  tipo: TipoRecompensa;
  valor: number; // CoinPoints, iLvl do item, qtd de ingresso...
  rotulo: string;
}

// Trilha GRÁTIS: 1 recompensa por página (níveis 10/20/30/40/50/60).
export const RECOMPENSAS_FREE: Recompensa[] = [
  { nivel: 10, trilha: "free", tipo: "coinpoints", valor: 120, rotulo: "120 CoinPoints" },
  { nivel: 20, trilha: "free", tipo: "coinpoints", valor: 150, rotulo: "150 CoinPoints" },
  { nivel: 30, trilha: "free", tipo: "item", valor: 20, rotulo: "Item (iLvl 20)" },
  { nivel: 40, trilha: "free", tipo: "coinpoints", valor: 200, rotulo: "200 CoinPoints" },
  { nivel: 50, trilha: "free", tipo: "item", valor: 30, rotulo: "Item (iLvl 30)" },
  { nivel: 60, trilha: "free", tipo: "ingresso", valor: 1, rotulo: "Ingresso de campeonato" },
];

// (Trilha PREMIUM entra na fatia de monetização.)
export const RECOMPENSAS_PREMIUM: Recompensa[] = [];

export function recompensaDe(nivel: number, trilha: "free" | "premium"): Recompensa | undefined {
  const lista = trilha === "free" ? RECOMPENSAS_FREE : RECOMPENSAS_PREMIUM;
  return lista.find((r) => r.nivel === nivel);
}
