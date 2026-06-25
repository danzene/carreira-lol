import { describe, expect, it } from "vitest";
import { mod } from "@/data/opcoes";
import { atributosIniciais, criarCareerState, criarPlayer } from "./player";
import type { OpcoesCarreira } from "./types";

function carreira(opcoes?: OpcoesCarreira) {
  return criarCareerState(
    criarPlayer({
      nome: "T",
      nacionalidade: "Brasil",
      rota: "MID",
      atributos: atributosIniciais(),
      traco: "FLEX",
      campeoes: ["A", "B", "C"],
    }),
    opcoes,
  );
}

describe("opções de carreira", () => {
  it("mod() é neutro (jogo linear, sem dificuldade)", () => {
    expect(mod(undefined).xp).toBe(1);
    expect(mod(undefined).dinheiro).toBe(1);
    expect(mod(undefined).energia).toBe(1);
    expect(mod(undefined).forcaInimigo).toBe(0);
    expect(mod(undefined).decaimento).toBe(1);
  });

  it("criar carreira guarda as opções (imersão / fearless)", () => {
    const c = carreira({ esconderAtributos: true, fearless: true });
    expect(c.opcoes?.esconderAtributos).toBe(true);
    expect(c.opcoes?.fearless).toBe(true);
  });
});
