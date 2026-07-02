import type { CareerState, KDA, MatchResult } from "./types";
import type { Cerimonia } from "./cerimonias";

// 🏛️ Hall da Carreira (PURO): marcos e recordes permanentes do save. Atualizado a cada
// partida; recordes NOTÁVEIS (acima de um piso, pra não spammar) viram cerimônia.

export interface CareerRecords {
  maiorStreak: number;
  melhorKda?: KDA;
  melhorNota: number;
  maisKills: number;
  elosAlcancados: string[]; // cada elo pisado pela 1ª vez (ordem de chegada)
}

export function recordsVazios(): CareerRecords {
  return { maiorStreak: 0, melhorNota: 0, maisKills: 0, elosAlcancados: [] };
}

function notaKda(k: KDA): number {
  return (k.k + k.a) / Math.max(1, k.d);
}

// Pisos de "recorde notável" (só celebra acima disso — evita cerimônia a cada melhoria mínima).
const PISOS = { kills: 12, nota: 9, streak: 5 } as const;

export function atualizarRecords(c: CareerState, r: MatchResult): { career: CareerState; cerimonias: Cerimonia[] } {
  const rec = c.records ?? recordsVazios();
  const cerimonias: Cerimonia[] = [];
  const novo: CareerRecords = { ...rec, elosAlcancados: rec.elosAlcancados };

  const streak = Math.max(0, c.player.rankSoloq.streak ?? 0);
  if (streak > novo.maiorStreak) {
    if (streak >= PISOS.streak && novo.maiorStreak < PISOS.streak)
      cerimonias.push({ tipo: "ACHIEVEMENT_UNLOCKED", id: "rec_streak", nome: `${streak} vitórias seguidas!`, emoji: "🔥", desc: "Novo recorde pessoal de sequência." });
    novo.maiorStreak = streak;
  }
  if (!novo.melhorKda || notaKda(r.kda) > notaKda(novo.melhorKda)) novo.melhorKda = r.kda;
  if (r.notaPerformance > novo.melhorNota) {
    if (r.notaPerformance >= PISOS.nota && novo.melhorNota < PISOS.nota)
      cerimonias.push({ tipo: "ACHIEVEMENT_UNLOCKED", id: "rec_nota", nome: `Nota ${r.notaPerformance.toFixed(1)}!`, emoji: "🌟", desc: "Sua melhor performance até hoje." });
    novo.melhorNota = r.notaPerformance;
  }
  if (r.kda.k > novo.maisKills) {
    if (r.kda.k >= PISOS.kills && novo.maisKills < PISOS.kills)
      cerimonias.push({ tipo: "ACHIEVEMENT_UNLOCKED", id: "rec_kills", nome: `${r.kda.k} abates numa partida!`, emoji: "⚔️", desc: "Recorde pessoal de abates." });
    novo.maisKills = r.kda.k;
  }

  const elo = c.player.rankSoloq.elo;
  if (!novo.elosAlcancados.includes(elo)) novo.elosAlcancados = [...novo.elosAlcancados, elo];

  const mudou =
    novo.maiorStreak !== rec.maiorStreak ||
    novo.melhorNota !== rec.melhorNota ||
    novo.maisKills !== rec.maisKills ||
    novo.melhorKda !== rec.melhorKda ||
    novo.elosAlcancados !== rec.elosAlcancados;

  return { career: mudou || !c.records ? { ...c, records: novo } : c, cerimonias };
}
