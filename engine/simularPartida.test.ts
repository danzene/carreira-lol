import { describe, expect, it } from "vitest";
import { atributosIniciais, criarCareerState, criarPlayer } from "./player";
import { eloDeMmr } from "./elo";
import { aplicarResultado, forcaRota, simularPartida, type ContextoPartida } from "./simularPartida";
import type { Attributes, Player, TraitId } from "./types";

function playerCom(valor: number, traco: TraitId = "FLEX"): Player {
  const attrs = atributosIniciais();
  (Object.keys(attrs) as (keyof Attributes)[]).forEach((k) => {
    attrs[k] = valor;
  });
  return criarPlayer({
    nome: "T",
    nacionalidade: "Brasil",
    rota: "MID",
    atributos: attrs,
    traco,
    campeoes: ["A", "B", "C"],
  });
}

const ctx: ContextoPartida = { championId: "A", forcaMetaCampeao: 50, comp: 50, compInimigo: 50 };
const media = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
const desvio = (xs: number[]): number => {
  const m = media(xs);
  return Math.sqrt(media(xs.map((x) => (x - m) ** 2)));
};

describe("motor de partida", () => {
  it("força de rota cresce com os atributos", () => {
    expect(forcaRota(playerCom(80))).toBeGreaterThan(forcaRota(playerCom(40)));
  });

  it("é determinística", () => {
    const p = playerCom(60);
    expect(simularPartida(p, ctx, 42)).toEqual(simularPartida(p, ctx, 42));
  });

  it("jogador forte vence e nota mais que o fraco", () => {
    const forte = playerCom(90);
    const fraco = playerCom(25);
    let vF = 0;
    let vf = 0;
    const nForte: number[] = [];
    const nFraco: number[] = [];
    for (let s = 0; s < 300; s++) {
      const rF = simularPartida(forte, ctx, s);
      const rf = simularPartida(fraco, ctx, s);
      if (rF.vitoria) vF++;
      if (rf.vitoria) vf++;
      nForte.push(rF.notaPerformance);
      nFraco.push(rf.notaPerformance);
    }
    expect(vF).toBeGreaterThan(vf);
    expect(media(nForte)).toBeGreaterThan(media(nFraco));
  });

  it("vantagem de comp (draft) aumenta a chance de vitória", () => {
    const p = playerCom(50);
    let comVantagem = 0;
    let comDesvantagem = 0;
    for (let s = 0; s < 300; s++) {
      if (simularPartida(p, { ...ctx, comp: 70, compInimigo: 40 }, s).vitoria) comVantagem++;
      if (simularPartida(p, { ...ctx, comp: 40, compInimigo: 70 }, s).vitoria) comDesvantagem++;
    }
    expect(comVantagem).toBeGreaterThan(comDesvantagem);
  });

  it("traço TILTAVEL aumenta a variância da nota vs FRIO", () => {
    const tilt = Array.from({ length: 250 }, (_, s) => simularPartida(playerCom(50, "TILTAVEL"), ctx, s).notaPerformance);
    const frio = Array.from({ length: 250 }, (_, s) => simularPartida(playerCom(50, "FRIO"), ctx, s).notaPerformance);
    expect(desvio(tilt)).toBeGreaterThan(desvio(frio));
  });

  it("aplicarResultado: vitória sobe MMR, registra histórico e dá XP", () => {
    const career = criarCareerState(playerCom(70));
    let r = simularPartida(career.player, { ...ctx, comp: 80, compInimigo: 30 }, 1);
    let s = 1;
    while (!r.vitoria && s < 200) r = simularPartida(career.player, { ...ctx, comp: 80, compInimigo: 30 }, ++s);
    const novo = aplicarResultado(career, r);
    expect(novo.player.rankSoloq.mmr).toBeGreaterThan(career.player.rankSoloq.mmr);
    expect(novo.historicoPartidas).toHaveLength(1);
    expect(novo.historicoPartidas[0].log.length).toBeGreaterThan(0);
  });

  it("elo deriva do MMR", () => {
    expect(eloDeMmr(800)).toEqual({ elo: "Ferro IV", lp: 0 });
    expect(eloDeMmr(900).elo).toBe("Ferro III");
  });
});
