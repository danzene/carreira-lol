// 🎟️ Passe de Batalha. PURO (dados/balanceamento). Temporada em tempo real (~6 semanas).
// O motor (gerar missões, subir nível, resgatar) fica em engine/passe.ts.

export const PASSE = {
  niveis: 60,
  porPagina: 10, // 6 páginas de 10 níveis
  ppPorNivel: 100, // Pontos de Passe por nível → 6000 PP fecha o passe (nível 60)
  duracaoDias: 42, // temporada ~6 semanas (casual tem tempo; dedicado fecha em ~1 semana)
  premiumBonusPP: 0.1, // +10% PP com o passe premium (aplicado na fatia de monetização)
  qtdDiarias: 5, // TODAS as diárias ativas (ritmo previsível: dedicado fecha em ~1 semana)
  qtdSemanais: 5, // TODAS as semanais ativas
} as const;
// Ritmo alvo: diárias somam ~650 PP/dia e as semanais ~2000 PP/semana.
// 7 dias × 650 + 2000 ≈ 6550 PP > 6000 → dá pra fechar o passe todo em ~1 semana fazendo tudo.

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
  { tipo: "jogar", texto: "Jogue 3 partidas", escopo: "diaria", alvo: 3, pp: 150 },
  { tipo: "vencer", texto: "Vença 1 partida", escopo: "diaria", alvo: 1, pp: 130 },
  { tipo: "treinar", texto: "Treine 2 vezes", escopo: "diaria", alvo: 2, pp: 110 },
  { tipo: "stream", texto: "Faça 1 stream", escopo: "diaria", alvo: 1, pp: 110 },
  { tipo: "booster", texto: "Puxe 1× no Carreira Booster", escopo: "diaria", alvo: 1, pp: 150 },
]; // soma ~650 PP/dia

export const MISSOES_SEMANAIS: DefMissao[] = [
  { tipo: "vencer", texto: "Vença 10 partidas", escopo: "semanal", alvo: 10, pp: 450 },
  { tipo: "campeonato", texto: "Jogue 3 partidas de campeonato", escopo: "semanal", alvo: 3, pp: 400 },
  { tipo: "jogar", texto: "Jogue 20 partidas", escopo: "semanal", alvo: 20, pp: 350 },
  { tipo: "equipar_item", texto: "Equipe um item", escopo: "semanal", alvo: 1, pp: 300 },
  { tipo: "subir_elo", texto: "Suba 2 divisões de elo", escopo: "semanal", alvo: 2, pp: 500 },
]; // soma ~2000 PP/semana

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

// Trilha PREMIUM (paga): mais recompensas e maiores. Requer passe.premium pra resgatar.
export const RECOMPENSAS_PREMIUM: Recompensa[] = [
  { nivel: 5, trilha: "premium", tipo: "coinpoints", valor: 100, rotulo: "100 CoinPoints" },
  { nivel: 10, trilha: "premium", tipo: "coinpoints", valor: 250, rotulo: "250 CoinPoints" },
  { nivel: 15, trilha: "premium", tipo: "item", valor: 25, rotulo: "Item (iLvl 25)" },
  { nivel: 20, trilha: "premium", tipo: "item", valor: 30, rotulo: "Item (iLvl 30)" },
  { nivel: 25, trilha: "premium", tipo: "coinpoints", valor: 300, rotulo: "300 CoinPoints" },
  { nivel: 30, trilha: "premium", tipo: "item", valor: 40, rotulo: "Item (iLvl 40)" },
  { nivel: 35, trilha: "premium", tipo: "coinpoints", valor: 400, rotulo: "400 CoinPoints" },
  { nivel: 40, trilha: "premium", tipo: "item", valor: 45, rotulo: "Item (iLvl 45)" },
  { nivel: 45, trilha: "premium", tipo: "ingresso", valor: 1, rotulo: "Ingresso de campeonato" },
  { nivel: 50, trilha: "premium", tipo: "coinpoints", valor: 600, rotulo: "600 CoinPoints" },
  { nivel: 55, trilha: "premium", tipo: "item", valor: 55, rotulo: "Item (iLvl 55)" },
  { nivel: 60, trilha: "premium", tipo: "item", valor: 60, rotulo: "Item lendário (iLvl 60)" },
];

export function recompensaDe(nivel: number, trilha: "free" | "premium"): Recompensa | undefined {
  const lista = trilha === "free" ? RECOMPENSAS_FREE : RECOMPENSAS_PREMIUM;
  return lista.find((r) => r.nivel === nivel);
}
