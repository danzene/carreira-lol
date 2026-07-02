import { describe, expect, it } from "vitest";
import { counterComp, counterLanes, matchup, type PickRota } from "./counters";
import type { ChampionDef, Classe } from "./types";

const champ = (id: string, classes: Classe[]): ChampionDef => ({
  id,
  nome: id,
  classes,
  rolesValidas: ["MID"],
  perfil: { dano: 50, resistencia: 50, cc: 50, mobilidade: 50, sustain: 50 },
  forcaMetaBase: 50,
});

describe("matchup de classes", () => {
  it("assassino countera mago; tank countera assassino; mago countera tank (ciclo)", () => {
    const zed = champ("Zed", ["ASSASSINO"]);
    const ahri = champ("Ahri", ["MAGO"]);
    const orn = champ("Ornn", ["TANK"]);
    expect(matchup(zed, ahri)).toBeGreaterThan(0);
    expect(matchup(ahri, zed)).toBeLessThan(0);
    expect(matchup(orn, zed)).toBeGreaterThan(0);
    expect(matchup(ahri, orn)).toBeGreaterThan(0);
  });

  it("espelho e classes sem relação dão 0; clamp em ±2", () => {
    const a = champ("A", ["LUTADOR"]);
    expect(matchup(a, champ("B", ["LUTADOR"]))).toBe(0);
    const duplo = champ("D", ["ASSASSINO", "MAGO"]);
    const alvoDuplo = champ("E", ["MAGO", "ATIRADOR"]);
    expect(Math.abs(matchup(duplo, alvoDuplo))).toBeLessThanOrEqual(2);
    expect(matchup(undefined, a)).toBe(0);
  });
});

describe("counters por rota e comp", () => {
  const banco = [
    champ("Zed", ["ASSASSINO"]),
    champ("Ahri", ["MAGO"]),
    champ("Ornn", ["TANK"]),
    champ("Jinx", ["ATIRADOR"]),
    champ("Lulu", ["SUPORTE"]),
  ];
  const time = (mid: string): PickRota[] => [
    { championId: "Ornn", rota: "TOP" },
    { championId: "Zed", rota: "JUNGLE" },
    { championId: mid, rota: "MID" },
    { championId: "Jinx", rota: "ADC" },
    { championId: "Lulu", rota: "SUPPORT" },
  ];

  it("calcula o delta rota a rota (positivo = azul na frente)", () => {
    const lanes = counterLanes(time("Zed"), time("Ahri"), banco);
    const mid = lanes.find((l) => l.rota === "MID")!;
    expect(mid.delta).toBeGreaterThan(0); // Zed countera Ahri na mid
    expect(lanes.find((l) => l.rota === "TOP")!.delta).toBe(0); // espelho
  });

  it("comp soma as rotas e o espelho dá 0", () => {
    const espelho = counterLanes(time("Ahri"), time("Ahri"), banco);
    expect(counterComp(espelho)).toBe(0);
    const comVantagem = counterLanes(time("Zed"), time("Ahri"), banco);
    expect(counterComp(comVantagem)).toBeGreaterThan(0);
  });
});
