import { LOJA } from "@/data/loja";
import { escudoDisponivel } from "./diario";
import { cargasPartida } from "./tempo";
import { LOOP } from "@/data/loop";
import type { AtributoKey, CareerState } from "./types";

// 💰 Loja (PURO): sinks do dinheiro in-game. Toda função devolve null quando a compra
// não é possível (sem $, já no teto, sem necessidade) — a UI desabilita antes.

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function pagar(c: CareerState, custo: number): CareerState | null {
  return c.dinheiro >= custo ? { ...c, dinheiro: c.dinheiro - custo } : null;
}

// ⚡ +30 de energia na hora (não deixa comprar com a barra cheia).
export function comprarEnergetico(c: CareerState): CareerState | null {
  if (c.player.energia >= 100) return null;
  const pago = pagar(c, LOJA.energetico.custo);
  if (!pago) return null;
  return { ...pago, player: { ...pago.player, energia: clamp(pago.player.energia + LOJA.energetico.energia, 0, 100) } };
}

// 🔋 Energia CHEIA.
export function comprarMegaEnergetico(c: CareerState): CareerState | null {
  if (c.player.energia >= 100) return null;
  const pago = pagar(c, LOJA.megaEnergetico.custo);
  if (!pago) return null;
  return { ...pago, player: { ...pago.player, energia: 100 } };
}

// 🎫 +1 carga de partida de campeonato (respeita o teto).
export function comprarCargaCampeonato(c: CareerState, agora: number): CareerState | null {
  const atual = cargasPartida(c, agora);
  if (atual >= LOOP.maxCargasPartida) return null;
  const pago = pagar(c, LOJA.cargaCampeonato.custo);
  if (!pago) return null;
  return { ...pago, cargasPartida: Math.min(LOOP.maxCargasPartida, atual + 1), cargasEm: agora };
}

// 🛡️ Repõe o escudo semanal do streak (só se já foi consumido).
export function comprarEscudoStreak(c: CareerState, hoje: string): CareerState | null {
  if (!c.diario || escudoDisponivel(c.diario, hoje)) return null; // sem streak ou escudo já disponível
  const pago = pagar(c, LOJA.escudoStreak.custo);
  if (!pago) return null;
  const { escudoUsadoEm: _descartado, ...resto } = pago.diario!;
  return { ...pago, diario: resto };
}

// 📼 Estudo do adversário: buff único da PRÓXIMA partida (+comp, +counterLane).
export function comprarPreparacao(c: CareerState): CareerState | null {
  if (c.preparacao) return null; // já preparado
  const pago = pagar(c, LOJA.preparacao.custo);
  if (!pago) return null;
  return { ...pago, preparacao: true };
}

// Consome a preparação ao jogar (mesma ref se não havia).
export function consumirPreparacao(c: CareerState): CareerState {
  return c.preparacao ? { ...c, preparacao: undefined } : c;
}

// 🎯 VOD review: +maestria num campeão DA POOL à escolha.
export function vodReview(c: CareerState, championId: string): CareerState | null {
  const alvo = c.player.pool.find((p) => p.championId === championId);
  if (!alvo || alvo.pontos >= 100) return null;
  const pago = pagar(c, LOJA.vodReview.custo);
  if (!pago) return null;
  const pool = pago.player.pool.map((p) =>
    p.championId === championId ? { ...p, pontos: clamp(Math.round((p.pontos + LOJA.vodReview.maestria) * 10) / 10, 0, 100) } : p,
  );
  return { ...pago, player: { ...pago.player, pool } };
}

// 📚 Aula particular: +atributo à escolha SEM gastar energia.
export function aulaParticular(c: CareerState, attr: AtributoKey): CareerState | null {
  if (c.player.atributos[attr] >= 100) return null;
  const pago = pagar(c, LOJA.aulaParticular.custo);
  if (!pago) return null;
  return {
    ...pago,
    player: {
      ...pago.player,
      atributos: { ...pago.player.atributos, [attr]: clamp(Math.round((pago.player.atributos[attr] + LOJA.aulaParticular.xp) * 100) / 100, 0, 100) },
    },
  };
}
