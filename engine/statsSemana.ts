import type { CareerState, KDA, MatchResult, StatsSemana } from "./types";

// 📊 Stats da semana corrente (PURO) — alimentam o recap "wrapped" ao avançar a semana.

export function statsVazias(): StatsSemana {
  return { partidas: 0, vitorias: 0, melhorNota: 0, lpLiquido: 0, dropsPorRaridade: {} };
}

function notaKda(k: KDA): number {
  return (k.k + k.a) / Math.max(1, k.d);
}

// Acumula uma partida jogada (soloq/oficial/torneio/evento — lpDelta 0 fora da soloq).
export function acumularPartida(career: CareerState, r: MatchResult): CareerState {
  const s = career.statsSemana ?? statsVazias();
  const melhorKda = !s.melhorKda || notaKda(r.kda) > notaKda(s.melhorKda) ? r.kda : s.melhorKda;
  return {
    ...career,
    statsSemana: {
      partidas: s.partidas + 1,
      vitorias: s.vitorias + (r.vitoria ? 1 : 0),
      melhorKda,
      melhorNota: Math.max(s.melhorNota, r.notaPerformance),
      lpLiquido: s.lpLiquido + (r.lpDelta ?? 0),
      dropsPorRaridade: s.dropsPorRaridade,
    },
  };
}

export function acumularDrop(career: CareerState, raridade: number): CareerState {
  const s = career.statsSemana ?? statsVazias();
  return {
    ...career,
    statsSemana: { ...s, dropsPorRaridade: { ...s.dropsPorRaridade, [raridade]: (s.dropsPorRaridade[raridade] ?? 0) + 1 } },
  };
}

// Vira a semana: a corrente vai pra "anterior" (comparação ↑↓) e zera a corrente.
export function fecharSemanaStats(career: CareerState): CareerState {
  return { ...career, statsSemanaAnterior: career.statsSemana ?? statsVazias(), statsSemana: statsVazias() };
}
