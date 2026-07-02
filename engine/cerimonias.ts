import type { Item } from "@/data/itens";
import { recompensaDe, type Recompensa } from "@/data/passe";
import { idxElo } from "./elo";
import type { ResultadoPuxada } from "./gacha";
import { nivelDoPasse, type PasseState } from "./passe";

// 🎉 Eventos de cerimônia (PURO). O engine DERIVA eventos de recompensa/marco comparando
// estados (antes → depois) ou embrulhando resultados; a UI (CeremonyManager) só apresenta.
// Nenhuma função aqui decide resultado de jogo — só descreve o que já aconteceu.

export type Cerimonia =
  | { tipo: "ITEM_DROPPED"; item: Item }
  | { tipo: "GACHA_PULLED"; resultados: ResultadoPuxada[]; pityAntes: number; pityDepois: number }
  | { tipo: "RANK_PROMOTED"; de: string; para: string }
  | { tipo: "RANK_DEMOTED"; de: string; para: string }
  | { tipo: "PASS_LEVEL_UP"; de: number; para: number; recompensas: Recompensa[] }
  | { tipo: "MISSION_COMPLETED"; texto: string; pp: number; escopo: "diaria" | "semanal" }
  | { tipo: "ACHIEVEMENT_UNLOCKED"; id: string; nome: string; emoji: string; desc: string }
  | { tipo: "FEATURE_UNLOCKED"; feature: string; nome: string; desc: string }
  | { tipo: "STREAK_MILESTONE"; dias: number; recompensa: string };

export type TipoCerimonia = Cerimonia["tipo"];

// Eventos "grandes" ganham overlay fullscreen; o resto vira toast discreto.
export const CERIMONIAS_FULLSCREEN: TipoCerimonia[] = [
  "ITEM_DROPPED",
  "GACHA_PULLED",
  "RANK_PROMOTED",
  "RANK_DEMOTED",
  "PASS_LEVEL_UP",
  "ACHIEVEMENT_UNLOCKED",
  "FEATURE_UNLOCKED",
  "STREAK_MILESTONE",
];

export function ehFullscreen(c: Cerimonia): boolean {
  return CERIMONIAS_FULLSCREEN.includes(c.tipo);
}

// Mudança de elo → cerimônia de promoção/queda (null se ficou no mesmo elo).
export function cerimoniaDeElo(eloAntes: string, eloDepois: string): Cerimonia | null {
  if (eloAntes === eloDepois) return null;
  const delta = idxElo(eloDepois) - idxElo(eloAntes);
  if (delta > 0) return { tipo: "RANK_PROMOTED", de: eloAntes, para: eloDepois };
  if (delta < 0) return { tipo: "RANK_DEMOTED", de: eloAntes, para: eloDepois };
  return null;
}

// Diff do passe: missões que concluíram agora + level up (com as recompensas dos níveis cruzados).
export function cerimoniasDePasse(antes: PasseState, depois: PasseState): Cerimonia[] {
  const out: Cerimonia[] = [];
  const antesById = new Map([...antes.diarias, ...antes.semanais].map((m) => [m.id, m]));
  for (const m of [...depois.diarias, ...depois.semanais]) {
    const a = antesById.get(m.id);
    if (m.concluida && a && !a.concluida) out.push({ tipo: "MISSION_COMPLETED", texto: m.texto, pp: m.pp, escopo: m.escopo });
  }
  const nAntes = nivelDoPasse(antes.pp);
  const nDepois = nivelDoPasse(depois.pp);
  if (nDepois > nAntes) {
    const recompensas: Recompensa[] = [];
    for (let n = nAntes + 1; n <= nDepois; n++) {
      const f = recompensaDe(n, "free");
      if (f) recompensas.push(f);
      const p = recompensaDe(n, "premium");
      if (p) recompensas.push(p);
    }
    out.push({ tipo: "PASS_LEVEL_UP", de: nAntes, para: nDepois, recompensas });
  }
  return out;
}

// Conquistas novas (verificarConquistas já devolve `novas`; aqui só viram evento serializável).
export function cerimoniasDeConquistas(novas: { id: string; nome: string; emoji: string; desc: string }[]): Cerimonia[] {
  return novas.map((c) => ({ tipo: "ACHIEVEMENT_UNLOCKED", id: c.id, nome: c.nome, emoji: c.emoji, desc: c.desc }));
}

export function cerimoniaDeDrop(item: Item): Cerimonia {
  return { tipo: "ITEM_DROPPED", item };
}

export function cerimoniaDeGacha(resultados: ResultadoPuxada[], pityAntes: number, pityDepois: number): Cerimonia {
  return { tipo: "GACHA_PULLED", resultados, pityAntes, pityDepois };
}

// Melhor raridade de uma puxada (dirige som/cor da cerimônia; 10x revela a melhor por último).
export function melhorRaridade(resultados: ResultadoPuxada[]): number {
  return resultados.reduce((max, r) => Math.max(max, r.raridade), 0);
}
