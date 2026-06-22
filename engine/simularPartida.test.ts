import { describe, expect, it } from "vitest";
import { atributosIniciais, criarCareerState, criarPlayer } from "./player";
import { eloDeMmr } from "./elo";
import { aplicarResultado, forcaRota, nivelMedio, simularPartida } from "./simularPartida";
import type { Attributes, Player } from "./types";

function playerCom(valor: number): Player {
  const attrs = atributosIniciais();
  (Object.keys(attrs) as (keyof Attributes)[]).forEach((k) => {
    attrs[k] = valor;
  });
  return criarPlayer({
    nome: "T",
    nacionalidade: "Brasil",
    rota: "MID",
    atributos: attrs,
    campeoes: ["A", "B", "C"],
  });
}

const media = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
const desvio = (xs: number[]): number => {
  const m = media(xs);
  return Math.sqrt(media(xs.map((x) => (x - m) ** 2)));
};

describe("simulação de partida", () => {
  it("força de rota cresce com os atributos", () => {
    expect(forcaRota(playerCom(80))).toBeGreaterThan(forcaRota(playerCom(40)));
  });

  it("nível do lobby sobe com o MMR", () => {
    expect(nivelMedio(2000)).toBeGreaterThan(nivelMedio(800));
  });

  it("é determinística: mesma semente, mesmo resultado", () => {
    const p = playerCom(60);
    expect(simularPartida(p, "A", 42)).toEqual(simularPartida(p, "A", 42));
  });

  it("jogador forte vence mais que jogador fraco", () => {
    const forte = playerCom(95);
    const fraco = playerCom(20);
    let vForte = 0;
    let vFraco = 0;
    for (let s = 0; s < 300; s++) {
      if (simularPartida(forte, "A", s).vitoria) vForte++;
      if (simularPartida(fraco, "A", s).vitoria) vFraco++;
    }
    expect(vForte).toBeGreaterThan(vFraco);
  });

  it("jogador forte tira nota média maior", () => {
    const notasForte = Array.from({ length: 200 }, (_, s) => simularPartida(playerCom(95), "A", s).notaPerformance);
    const notasFraco = Array.from({ length: 200 }, (_, s) => simularPartida(playerCom(20), "A", s).notaPerformance);
    expect(media(notasForte)).toBeGreaterThan(media(notasFraco));
  });

  it("consistência + mental altos reduzem a variância da nota", () => {
    const estavel = playerCom(50);
    estavel.atributos.consistencia = 95;
    estavel.atributos.mental = 95;
    const instavel = playerCom(50);
    instavel.atributos.consistencia = 10;
    instavel.atributos.mental = 10;

    const notasE = Array.from({ length: 250 }, (_, s) => simularPartida(estavel, "A", s).notaPerformance);
    const notasI = Array.from({ length: 250 }, (_, s) => simularPartida(instavel, "A", s).notaPerformance);
    expect(desvio(notasE)).toBeLessThan(desvio(notasI));
  });

  it("aplicarResultado: vitória sobe MMR, registra histórico e dá XP", () => {
    const career = criarCareerState(playerCom(60));
    let resultado = simularPartida(career.player, "A", 1);
    let s = 1;
    while (!resultado.vitoria && s < 200) resultado = simularPartida(career.player, "A", ++s);

    const novo = aplicarResultado(career, resultado);
    expect(novo.player.rankSoloq.mmr).toBeGreaterThan(career.player.rankSoloq.mmr);
    expect(novo.historicoPartidas).toHaveLength(1);
    const algumSubiu = (Object.keys(novo.player.atributos) as (keyof Attributes)[]).some(
      (k) => novo.player.atributos[k] > career.player.atributos[k],
    );
    expect(algumSubiu).toBe(true);
  });

  it("elo deriva do MMR", () => {
    expect(eloDeMmr(800)).toEqual({ elo: "Ferro IV", lp: 0 });
    expect(eloDeMmr(850).lp).toBe(50);
    expect(eloDeMmr(900).elo).toBe("Ferro III");
  });

  it("moral alta melhora a nota média", () => {
    const alta = playerCom(60);
    alta.moral = 100;
    const baixa = playerCom(60);
    baixa.moral = 40;
    const mAlta = media(Array.from({ length: 200 }, (_, s) => simularPartida(alta, "A", s).notaPerformance));
    const mBaixa = media(Array.from({ length: 200 }, (_, s) => simularPartida(baixa, "A", s).notaPerformance));
    expect(mAlta).toBeGreaterThan(mBaixa);
  });
});
