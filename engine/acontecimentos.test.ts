import { describe, expect, it } from "vitest";
import { sortearAcontecimento } from "./acontecimentos";
import { atributosIniciais, criarCareerState, criarPlayer } from "./player";

function carreira() {
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

describe("acontecimentos de carreira", () => {
  it("às vezes não acontece nada (determinístico por seed)", () => {
    let nulos = 0;
    for (let s = 0; s < 50; s++) if (!sortearAcontecimento(carreira(), s)) nulos++;
    expect(nulos).toBeGreaterThan(0);
  });

  it("quando acontece, aplica efeito respeitando limites 0..100", () => {
    let achou: ReturnType<typeof sortearAcontecimento> = null;
    for (let s = 0; s < 50 && !achou; s++) achou = sortearAcontecimento(carreira(), s);
    expect(achou).toBeTruthy();
    if (achou) {
      expect(achou.career.player.energia).toBeGreaterThanOrEqual(0);
      expect(achou.career.player.energia).toBeLessThanOrEqual(100);
      expect(achou.career.dinheiro).toBeGreaterThanOrEqual(0);
    }
  });
});
