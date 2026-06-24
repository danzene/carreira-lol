import { describe, expect, it } from "vitest";
import { avancarSemana } from "./loop";
import { atributosIniciais, criarCareerState, criarPlayer } from "./player";
import { aplicarResultado } from "./simularPartida";
import { visibilidade } from "./transferencias";
import type { CareerState, MatchResult } from "./types";

function carreira(): CareerState {
  return criarCareerState(
    criarPlayer({
      nome: "T",
      nacionalidade: "Brasil",
      rota: "MID",
      atributos: atributosIniciais(),
      traco: "FLEX",
      campeoes: ["A", "B", "C"],
    }),
  );
}
function partida(over: Partial<MatchResult> = {}): MatchResult {
  return { vitoria: true, kda: { k: 5, d: 2, a: 7 }, notaPerformance: 7, csPorMin: 6, championId: "A", xpGanho: {}, lpDelta: 0, log: [], ...over };
}

describe("progressão (Punch Club-like)", () => {
  it("visibilidade sobe com o elo de soloq", () => {
    const baixo = carreira();
    const alto = carreira();
    alto.player.rankSoloq = { elo: "Diamante I", lp: 0, mmr: 3000 };
    expect(visibilidade(alto)).toBeGreaterThan(visibilidade(baixo));
  });

  it("jogar sobe a maestria do campeão; campeão novo entra na pool", () => {
    const c = carreira();
    const antes = c.player.pool.find((p) => p.championId === "A")!.pontos;
    const venceu = aplicarResultado(c, partida({ championId: "A", vitoria: true }));
    expect(venceu.player.pool.find((p) => p.championId === "A")!.pontos).toBeGreaterThan(antes);

    const novo = aplicarResultado(c, partida({ championId: "ZED", vitoria: true }));
    expect(novo.player.pool.some((p) => p.championId === "ZED")).toBe(true);
  });

  it("avançar a semana decai os atributos (sem treinar)", () => {
    const c = carreira();
    const antes = c.player.atributos.mecanica;
    expect(avancarSemana(c).player.atributos.mecanica).toBeLessThan(antes);
  });
});
