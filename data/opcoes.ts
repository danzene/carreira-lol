import type { Dificuldade, OpcoesCarreira } from "@/engine/types";

// ⚙️ Opções de nova carreira (Fase 11): dificuldade + modos.

export interface ModDificuldade {
  xp: number; // multiplicador de XP por partida
  dinheiro: number; // multiplicador de salário/bônus
  energia: number; // multiplicador da energia recuperada por semana
  forcaInimigo: number; // bônus de força do time/comp inimigo na partida
}

export const MODIFICADORES: Record<Dificuldade, ModDificuldade> = {
  FACIL: { xp: 1.3, dinheiro: 1.3, energia: 1.15, forcaInimigo: -6 },
  NORMAL: { xp: 1, dinheiro: 1, energia: 1, forcaInimigo: 0 },
  DIFICIL: { xp: 0.8, dinheiro: 0.85, energia: 0.9, forcaInimigo: 8 },
};

export const DIFICULDADES: { id: Dificuldade; nome: string; desc: string }[] = [
  { id: "FACIL", nome: "Fácil", desc: "+XP, +dinheiro, inimigos mais fracos" },
  { id: "NORMAL", nome: "Normal", desc: "Experiência equilibrada" },
  { id: "DIFICIL", nome: "Difícil", desc: "−XP, −dinheiro, inimigos mais fortes" },
];

export const OPCOES_PADRAO: OpcoesCarreira = {
  dificuldade: "NORMAL",
  esconderAtributos: false,
  fearless: false,
};

// Modificadores da carreira (tolera saves antigos sem `opcoes` = Normal).
export function mod(opcoes: OpcoesCarreira | undefined): ModDificuldade {
  return MODIFICADORES[opcoes?.dificuldade ?? "NORMAL"];
}

export function nomeDificuldade(opcoes: OpcoesCarreira | undefined): string {
  const id = opcoes?.dificuldade ?? "NORMAL";
  return DIFICULDADES.find((d) => d.id === id)?.nome ?? "Normal";
}

// Campeões proibidos no Fearless: os usados nas últimas N partidas.
export const FEARLESS_JANELA = 10;
