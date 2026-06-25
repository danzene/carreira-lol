import type { OpcoesCarreira } from "@/engine/types";

// ⚙️ Opções de nova carreira. O jogo é LINEAR (sem dificuldade) — `mod()` é neutro e
// existe só para os motores que ainda multiplicam por ele (xp/dinheiro/energia/decaimento).

export interface ModDificuldade {
  xp: number;
  dinheiro: number;
  energia: number;
  forcaInimigo: number;
  decaimento: number;
}

const NEUTRO: ModDificuldade = { xp: 1, dinheiro: 1, energia: 1, forcaInimigo: 0, decaimento: 1 };

export const OPCOES_PADRAO: OpcoesCarreira = {
  esconderAtributos: false,
  fearless: false,
};

// Sempre neutro (jogo linear). Mantido p/ não tocar nos call-sites dos motores.
export function mod(_opcoes?: OpcoesCarreira): ModDificuldade {
  return NEUTRO;
}

// Campeões proibidos no Fearless: os usados nas últimas N partidas.
export const FEARLESS_JANELA = 10;
