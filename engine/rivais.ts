import type { CareerState } from "./types";

// ⚔️ Rivalidades (PURO). Máquina de estados por adversário de campeonato:
// - 2 derrotas SEGUIDAS pro mesmo time ⇒ vira RIVAL (vencer antes disso esfria a rixa)
// - sendo rival: 2 vitórias contra ele ⇒ RIVAL SUPERADO (status removido, contadores zeram)
// - vencer um rival dá bônus (moral + $ + sorte de drop) — valores definidos AQUI.
// (Rivais de duelo online são derivados do histórico do servidor na UI — não entram no save.)

export interface RivalState {
  derrotas: number; // derrotas seguidas pra ele (antes de virar rival)
  vitoriasContra: number; // vitórias contra ele DEPOIS de virar rival
  ativo: boolean;
}

export const RIVAL = {
  derrotasParaVirar: 2,
  vitoriasParaSuperar: 2,
  bonusMoral: 10,
  bonusDinheiro: 200,
  bonusSorteDrop: 0.15, // chance extra de drop na partida contra o rival
} as const;

export function ehRival(c: CareerState, adversarioId: string): boolean {
  return c.rivais?.[adversarioId]?.ativo === true;
}

export type EventoRival = "virou_rival" | "superado" | null;

// Registra um confronto de campeonato contra `adversarioId` e move a máquina de estados.
export function registrarConfronto(
  c: CareerState,
  adversarioId: string,
  venceu: boolean,
): { career: CareerState; evento: EventoRival } {
  const atual: RivalState = c.rivais?.[adversarioId] ?? { derrotas: 0, vitoriasContra: 0, ativo: false };
  let novo: RivalState;
  let evento: EventoRival = null;

  if (atual.ativo) {
    if (venceu) {
      const vitorias = atual.vitoriasContra + 1;
      if (vitorias >= RIVAL.vitoriasParaSuperar) {
        novo = { derrotas: 0, vitoriasContra: 0, ativo: false };
        evento = "superado";
      } else {
        novo = { ...atual, vitoriasContra: vitorias };
      }
    } else {
      novo = { ...atual, vitoriasContra: 0 }; // perdeu de novo: zera o progresso de superação
    }
  } else {
    if (venceu) {
      novo = { derrotas: 0, vitoriasContra: 0, ativo: false }; // rixa esfria
    } else {
      const derrotas = atual.derrotas + 1;
      if (derrotas >= RIVAL.derrotasParaVirar) {
        novo = { derrotas, vitoriasContra: 0, ativo: true };
        evento = "virou_rival";
      } else {
        novo = { ...atual, derrotas };
      }
    }
  }

  return { career: { ...c, rivais: { ...c.rivais, [adversarioId]: novo } }, evento };
}

// Aplica o bônus de vencer um RIVAL (moral + dinheiro). A sorte de drop é usada pelo chamador.
export function aplicarBonusRival(c: CareerState): CareerState {
  return {
    ...c,
    dinheiro: c.dinheiro + RIVAL.bonusDinheiro,
    player: { ...c.player, moral: Math.min(100, c.player.moral + RIVAL.bonusMoral) },
  };
}
