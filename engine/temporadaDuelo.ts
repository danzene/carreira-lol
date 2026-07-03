// 🗓️ Temporadas do duelo online (PURO): ciclos de 3 SEMANAS derivados da data real —
// todos os clientes concordam sem o servidor decidir nada (mesmo princípio da Prova).
// Rating auto-reportado como o resto do duelo (validação server = rodada de monetização).

const SEMANA_MS = 7 * 86400000;
const EPOCA = Date.UTC(2026, 0, 5); // segunda 05/01/2026 = início da Temporada 1 (UTC)
export const SEMANAS_POR_TEMPORADA = 3;
export const RATING_BASE = 1000;

export function temporadaDuelo(agora: number): number {
  const semanas = Math.floor((agora - EPOCA) / SEMANA_MS);
  return Math.max(1, Math.floor(semanas / SEMANAS_POR_TEMPORADA) + 1);
}

export function msAteProximaTemporada(agora: number): number {
  const atual = temporadaDuelo(agora);
  const inicioProx = EPOCA + atual * SEMANAS_POR_TEMPORADA * SEMANA_MS;
  return Math.max(0, inicioProx - agora);
}

// Soft reset LAZY e IDEMPOTENTE: aplicado 1x no primeiro acesso da temporada nova.
// Fórmula: novo = base + (antigo − base) × 0,5 — puxa todo mundo pra perto da base
// mantendo metade da distância conquistada. Pular várias temporadas aplica só 1x
// (decisão documentada no CHANGELOG).
export function aplicarSoftReset(rating: number, tempAtual: number, tempRegistrada: number): { rating: number; temporada: number; resetou: boolean } {
  if (tempRegistrada >= tempAtual) return { rating, temporada: tempRegistrada, resetou: false };
  return { rating: Math.round(RATING_BASE + (rating - RATING_BASE) * 0.5), temporada: tempAtual, resetou: true };
}

// Delta de rating por duelo (elo-lite): base 20, ajustado pela diferença de poder.
export function deltaRating(venceu: boolean, meuPoder: number, poderRival: number): number {
  const ajuste = Math.max(-8, Math.min(8, Math.round((poderRival - meuPoder) / 6)));
  const ganho = Math.max(8, Math.min(32, 20 + (venceu ? ajuste : -ajuste)));
  return venceu ? ganho : -ganho;
}

// Tiers da temporada (recompensa cosmética por tier final — nunca voltam).
export interface TierDuelo {
  nome: string;
  emoji: string;
  cor: string;
  min: number;
}

export const TIERS_DUELO: TierDuelo[] = [
  { nome: "Lenda", emoji: "🐉", cor: "#ffe14d", min: 1400 },
  { nome: "Diamante", emoji: "💎", cor: "#4db8ff", min: 1250 },
  { nome: "Ouro", emoji: "🥇", cor: "#ffd34d", min: 1120 },
  { nome: "Prata", emoji: "🥈", cor: "#c8d0e0", min: 1040 },
  { nome: "Bronze", emoji: "🥉", cor: "#c9803c", min: 0 },
];

export function tierDuelo(rating: number): TierDuelo {
  return TIERS_DUELO.find((t) => rating >= t.min) ?? TIERS_DUELO[TIERS_DUELO.length - 1];
}

// Título cosmético de fim de temporada (exclusivo — a temporada nunca volta).
export function tituloTemporada(temporada: number, rating: number): string {
  return `T${temporada}: ${tierDuelo(rating).nome} no Duelo`;
}
