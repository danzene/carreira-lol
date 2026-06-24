import { ACONTECIMENTOS, CHANCE_ACONTECIMENTO, type Acontecimento } from "@/data/acontecimentos";
import { criarRng } from "./rng";
import type { CareerState } from "./types";

// Eventos aleatórios de carreira (PURO). Sorteia (ou não) um acontecimento e aplica o efeito.

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export function sortearAcontecimento(career: CareerState, seed: number): { career: CareerState; acontecimento: Acontecimento } | null {
  const rng = criarRng(seed >>> 0);
  if (rng() > CHANCE_ACONTECIMENTO) return null;

  const total = ACONTECIMENTOS.reduce((s, a) => s + a.peso, 0);
  let r = rng() * total;
  let escolhido = ACONTECIMENTOS[0];
  for (const a of ACONTECIMENTOS) {
    if (r < a.peso) {
      escolhido = a;
      break;
    }
    r -= a.peso;
  }

  const e = escolhido.efeito;
  const career2: CareerState = {
    ...career,
    dinheiro: Math.max(0, career.dinheiro + (e.dinheiro ?? 0)),
    player: {
      ...career.player,
      energia: clamp(career.player.energia + (e.energia ?? 0), 0, 100),
      moral: clamp(career.player.moral + (e.moral ?? 0), 0, 100),
      reputacao: clamp(career.player.reputacao + (e.reputacao ?? 0), 0, 100),
    },
  };
  return { career: career2, acontecimento: escolhido };
}
