import { idxElo } from "./elo";
import type { CareerState } from "./types";
import type { Cerimonia } from "./cerimonias";

// 🔓 Unlock progressivo de features (PURO). Carreiras NOVAS destravam por marcos;
// saves antigos ganham `unlocksLegacy` na migração e têm tudo aberto desde o início.
// O gate mora aqui — a UI só lê (banner com cadeado + condição).

export type FeatureId = "stream" | "mental" | "loja" | "booster" | "itens" | "passe" | "online";

export interface DefUnlock {
  id: FeatureId;
  nome: string;
  desc: string;
  condicao: string; // texto mostrado no cadeado
  liberado: (c: CareerState) => boolean;
}

const semana2 = (c: CareerState) => c.semanaAtual >= 2 || c.historicoPartidas.length >= 10;

export const UNLOCKS: DefUnlock[] = [
  { id: "stream", nome: "Streaming", desc: "Faça lives pra ganhar $ e reputação.", condicao: "Destrava na semana 2 (ou 10 partidas)", liberado: semana2 },
  { id: "mental", nome: "Foco Mental", desc: "Ganhe traços novos de personalidade.", condicao: "Destrava na semana 2 (ou 10 partidas)", liberado: semana2 },
  { id: "loja", nome: "Loja", desc: "Invista em coach, bootcamp e sessões.", condicao: "Destrava na semana 2 (ou 10 partidas)", liberado: semana2 },
  {
    id: "booster",
    nome: "Carreira Booster",
    desc: "Puxe cartas de Lenda com efeitos passivos.",
    condicao: "Destrava na primeira promoção de elo",
    liberado: (c) => idxElo(c.player.rankSoloq.elo) >= 1,
  },
  {
    id: "itens",
    nome: "Inventário",
    desc: "Loot com afixos: equipe seu setup.",
    condicao: "Destrava ao chegar no Bronze",
    liberado: (c) => idxElo(c.player.rankSoloq.elo) >= 4,
  },
  { id: "passe", nome: "Passe de Batalha", desc: "Missões diárias/semanais e recompensas.", condicao: "Destrava na semana 3", liberado: (c) => c.semanaAtual >= 3 },
  {
    id: "online",
    nome: "Online · Duelo 1v1",
    desc: "Enfrente o snapshot de players reais.",
    condicao: "Destrava ao chegar na Prata",
    liberado: (c) => idxElo(c.player.rankSoloq.elo) >= 8 || c.temporada > 1,
  },
];

export function defUnlock(id: FeatureId): DefUnlock {
  return UNLOCKS.find((u) => u.id === id)!;
}

// Migração de save: quem já tinha progresso antes do sistema ganha tudo destravado.
export function migrarUnlocks(c: CareerState): CareerState {
  if (c.unlocksLegacy !== undefined) return c;
  return { ...c, unlocksLegacy: c.semanaAtual > 1 || c.historicoPartidas.length > 0 };
}

export function featureLiberada(c: CareerState, id: FeatureId): boolean {
  if (c.unlocksLegacy) return true;
  return defUnlock(id).liberado(c);
}

// Diff de unlocks entre dois estados → cerimônias FEATURE_UNLOCKED (uma por feature nova).
export function cerimoniasDeUnlocks(antes: CareerState, depois: CareerState): Cerimonia[] {
  if (depois.unlocksLegacy) return [];
  const out: Cerimonia[] = [];
  for (const u of UNLOCKS) {
    if (!u.liberado(antes) && u.liberado(depois)) {
      out.push({ tipo: "FEATURE_UNLOCKED", feature: u.id, nome: u.nome, desc: u.desc });
    }
  }
  return out;
}
