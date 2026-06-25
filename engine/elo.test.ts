import { describe, expect, it } from "vitest";
import { infoElo, proximoElo, trilhaElos } from "@/data/elo";
import { aplicarResultadoRank, eloDeMmr, proximoStreak } from "./elo";

describe("apresentação de elo", () => {
  it("infoElo separa tier e divisão", () => {
    const f = infoElo("Ferro IV");
    expect(f.tier).toBe("Ferro");
    expect(f.divisao).toBe("IV");
    expect(f.idx).toBe(0);

    const gm = infoElo("Grão-Mestre");
    expect(gm.tier).toBe("Grão-Mestre");
    expect(gm.divisao).toBe("");
  });

  it("proximoElo sobe a ladder e trava no topo", () => {
    expect(proximoElo("Ferro IV")).toBe("Ferro III");
    expect(proximoElo("Desafiante")).toBeNull();
  });

  it("trilha começa no elo atual", () => {
    expect(trilhaElos("Ferro IV", 3)).toEqual(["Ferro IV", "Ferro III", "Ferro II"]);
  });

  it("começa em Ferro IV no MMR base", () => {
    expect(eloDeMmr(800)).toEqual({ elo: "Ferro IV", lp: 0 });
  });

  it("proximoStreak conta vitórias/derrotas seguidas e reseta ao virar", () => {
    expect(proximoStreak(0, true)).toBe(1);
    expect(proximoStreak(2, true)).toBe(3);
    expect(proximoStreak(3, false)).toBe(-1);
    expect(proximoStreak(-2, false)).toBe(-3);
    expect(proximoStreak(-1, true)).toBe(1);
  });

  it("win streak dá mais PDL; loss streak tira mais", () => {
    const base = { elo: "Prata IV", lp: 0, mmr: 1200 };
    const semStreak = aplicarResultadoRank({ ...base, streak: 0 }, true, 1200);
    const quente = aplicarResultadoRank({ ...base, streak: 4 }, true, 1200);
    expect(quente.lpDelta).toBeGreaterThan(semStreak.lpDelta);
    expect(quente.rank.streak).toBe(5);

    const perdaSimples = aplicarResultadoRank({ ...base, streak: 0 }, false, 1200);
    const frio = aplicarResultadoRank({ ...base, streak: -4 }, false, 1200);
    expect(frio.lpDelta).toBeLessThan(perdaSimples.lpDelta); // perde mais (mais negativo)
    expect(frio.rank.streak).toBe(-5);
  });
});
