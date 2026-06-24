import { describe, expect, it } from "vitest";
import { verificarConquistas } from "./conquistas";
import { atributosIniciais, criarCareerState, criarPlayer } from "./player";
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
  return { vitoria: true, kda: { k: 5, d: 2, a: 7 }, notaPerformance: 7, csPorMin: 6, championId: "a", xpGanho: {}, log: [], ...over };
}

describe("conquistas", () => {
  it("desbloqueia estreia e primeira vitória ao registrar partida vencida", () => {
    const c: CareerState = { ...carreira(), historicoPartidas: [partida({ vitoria: true })] };
    const { career, novas } = verificarConquistas(c);
    const ids = novas.map((q) => q.id);
    expect(ids).toContain("estreia");
    expect(ids).toContain("primeira_vitoria");
    expect(career.conquistas).toContain("estreia");
  });

  it("não desbloqueia de novo o que já tem", () => {
    const c: CareerState = { ...carreira(), historicoPartidas: [partida()], conquistas: ["estreia", "primeira_vitoria"] };
    expect(verificarConquistas(c).novas.map((q) => q.id)).not.toContain("estreia");
  });

  it("reputação 100 desbloqueia Lenda", () => {
    const base = carreira();
    const c: CareerState = { ...base, player: { ...base.player, reputacao: 100 } };
    expect(verificarConquistas(c).career.conquistas).toContain("rep100");
  });
});
