import { describe, expect, it } from "vitest";
import { mod } from "@/data/opcoes";
import { bonusVitoria, salarioSemanal } from "./economia";
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
  it("mod() trata save sem opções como Normal", () => {
    expect(mod(undefined).xp).toBe(1);
    expect(mod(undefined).forcaInimigo).toBe(0);
  });

  it("criar carreira guarda as opções", () => {
    const c = carreira({ dificuldade: "DIFICIL", esconderAtributos: true, fearless: true });
    expect(c.opcoes?.dificuldade).toBe("DIFICIL");
    expect(c.opcoes?.esconderAtributos).toBe(true);
    expect(c.opcoes?.fearless).toBe(true);
  });

  it("dificuldade escala salário e bônus por vitória", () => {
    const facil = carreira({ dificuldade: "FACIL", esconderAtributos: false, fearless: false });
    const dificil = carreira({ dificuldade: "DIFICIL", esconderAtributos: false, fearless: false });
    expect(salarioSemanal(facil)).toBeGreaterThan(salarioSemanal(dificil));
    expect(bonusVitoria(facil)).toBeGreaterThan(bonusVitoria(dificil));
  });

  it("inimigo mais forte no difícil que no fácil", () => {
    expect(mod({ dificuldade: "DIFICIL", esconderAtributos: false, fearless: false }).forcaInimigo).toBeGreaterThan(
      mod({ dificuldade: "FACIL", esconderAtributos: false, fearless: false }).forcaInimigo,
    );
  });
});
