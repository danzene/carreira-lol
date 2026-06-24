import { ELO_LADDER } from "@/data/simulacao";
import type { CareerState } from "./types";

// 🏅 Conquistas/marcos (Fase 12). PURO: derivadas do estado da carreira.

export interface Conquista {
  id: string;
  nome: string;
  emoji: string;
  desc: string;
  checar: (c: CareerState) => boolean;
}

const idxElo = (elo: string): number => ELO_LADDER.indexOf(elo as (typeof ELO_LADDER)[number]);
const hist = (c: CareerState) => c.historicoPartidas;

export const CONQUISTAS: Conquista[] = [
  { id: "estreia", nome: "Estreia", emoji: "🎮", desc: "Jogue sua primeira partida.", checar: (c) => hist(c).length >= 1 },
  { id: "primeira_vitoria", nome: "Primeira vitória", emoji: "🥇", desc: "Vença uma partida.", checar: (c) => hist(c).some((m) => m.vitoria) },
  { id: "contratado", nome: "Contratado", emoji: "✍️", desc: "Assine com um time.", checar: (c) => c.contratoAtual !== null },
  { id: "carregou", nome: "Carregou o jogo", emoji: "💥", desc: "Faça 10+ abates numa partida.", checar: (c) => hist(c).some((m) => m.kda.k >= 10) },
  { id: "nota10", nome: "Atuação perfeita", emoji: "⭐", desc: "Tire nota ~10 numa partida.", checar: (c) => hist(c).some((m) => m.notaPerformance >= 9.5) },
  { id: "diamante", nome: "Elo Diamante", emoji: "💎", desc: "Alcance Diamante no soloq.", checar: (c) => idxElo(c.player.rankSoloq.elo) >= idxElo("Diamante IV") },
  { id: "desafiante", nome: "Rumo ao topo", emoji: "👑", desc: "Alcance Mestre ou acima.", checar: (c) => idxElo(c.player.rankSoloq.elo) >= idxElo("Mestre") },
  { id: "rep50", nome: "Nome conhecido", emoji: "📣", desc: "Chegue a 50 de reputação.", checar: (c) => c.player.reputacao >= 50 },
  { id: "rep100", nome: "Lenda", emoji: "🌟", desc: "Chegue a 100 de reputação.", checar: (c) => c.player.reputacao >= 100 },
  { id: "tier1", nome: "Elite nacional", emoji: "🏆", desc: "Jogue no Tier 1.", checar: (c) => c.tierAtual === "TIER1" || c.tierAtual === "INTERNACIONAL" },
  { id: "campeao", nome: "Campeão da liga", emoji: "🏅", desc: "Vença os playoffs de uma liga.", checar: (c) => c.liga?.fase === "ENCERRADA" && c.liga.colocacaoFinal === 1 },
  { id: "mundial", nome: "Campeão Mundial", emoji: "🌍", desc: "Vença o Mundial (Internacional).", checar: (c) => c.liga?.fase === "ENCERRADA" && c.liga.colocacaoFinal === 1 && c.liga.tier === "INTERNACIONAL" },
  { id: "rico", nome: "Patrimônio", emoji: "💰", desc: "Acumule $10.000.", checar: (c) => c.dinheiro >= 10000 },
  { id: "veterano", nome: "Veterano", emoji: "🎖️", desc: "Jogue 50 partidas.", checar: (c) => hist(c).length >= 50 },
];

// Desbloqueia as conquistas recém-atingidas; devolve a carreira atualizada e as novas.
export function verificarConquistas(career: CareerState): { career: CareerState; novas: Conquista[] } {
  const ja = new Set(career.conquistas ?? []);
  const novas: Conquista[] = [];
  for (const q of CONQUISTAS) {
    if (!ja.has(q.id) && q.checar(career)) {
      ja.add(q.id);
      novas.push(q);
    }
  }
  if (novas.length === 0) return { career, novas };
  return { career: { ...career, conquistas: [...ja] }, novas };
}
