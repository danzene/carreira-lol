import { describe, expect, it } from "vitest";
import { atributosIniciais, criarPlayer } from "./player";
import { gerarRoteiro } from "./partida";
import { simularPartida } from "./simularPartida";
import type { Player } from "./types";

function player(): Player {
  return criarPlayer({
    nome: "T",
    nacionalidade: "Brasil",
    rota: "MID",
    atributos: atributosIniciais(),
    campeoes: ["A", "B", "C"],
  });
}

const media = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;

describe("partida interativa", () => {
  it("roteiro é determinístico e tem momentos com opções", () => {
    const r1 = gerarRoteiro(player(), 123);
    const r2 = gerarRoteiro(player(), 123);
    expect(r1).toEqual(r2);
    expect(r1.momentos.length).toBeGreaterThan(0);
    expect(r1.momentos[0].opcoes.length).toBeGreaterThan(0);
  });

  it("cada momento tem ao menos uma opção arriscada e uma segura", () => {
    const r = gerarRoteiro(player(), 7);
    for (const m of r.momentos) {
      expect(m.opcoes.some((o) => o.arriscada)).toBe(true);
      expect(m.opcoes.some((o) => !o.arriscada)).toBe(true);
    }
  });

  it("modificador positivo melhora a nota média", () => {
    const p = player();
    const com = media(Array.from({ length: 150 }, (_, s) => simularPartida(p, "A", s, 15).notaPerformance));
    const sem = media(Array.from({ length: 150 }, (_, s) => simularPartida(p, "A", s, 0).notaPerformance));
    expect(com).toBeGreaterThan(sem);
  });
});
