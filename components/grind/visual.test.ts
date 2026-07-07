import { describe, expect, it } from "vitest";
import { modoVisualGrind } from "./visual";

describe("kill switch visual do diorama", () => {
  const base = { esconderAtributos: false, fearless: false };

  it("padrão é o diorama; flag global desligada volta a pílula pra TODOS (sem tocar em save)", () => {
    expect(modoVisualGrind(base, false, true)).toBe("diorama");
    expect(modoVisualGrind(base, false, false)).toBe("pilula"); // kill switch em 1 deploy
    expect(modoVisualGrind(undefined, false, false)).toBe("pilula");
  });

  it("preferência do jogador (config) e strip recolhida também viram pílula", () => {
    expect(modoVisualGrind({ ...base, grindPilula: true }, false, true)).toBe("pilula");
    expect(modoVisualGrind(base, true, true)).toBe("pilula"); // recolhida na sessão
    expect(modoVisualGrind({ ...base, grindPilula: false }, false, true)).toBe("diorama");
  });
});
