import { describe, expect, it } from "vitest";
import { alteracoesDoPatch, aplicarPatch, versaoPatch } from "./patch";
import type { ChampionDef } from "./types";

function champ(id: string): ChampionDef {
  return {
    id,
    nome: id.toUpperCase(),
    classes: ["LUTADOR"],
    rolesValidas: ["TOP", "JUNGLE"],
    perfil: { dano: 50, resistencia: 50, cc: 30, mobilidade: 30, sustain: 30 },
    forcaMetaBase: 50,
  };
}
const BANCO: ChampionDef[] = Array.from({ length: 24 }, (_, i) => champ(`c${i}`));

describe("auto patch", () => {
  it("patch 1 não altera nada (meta base)", () => {
    expect(aplicarPatch(BANCO, 1)).toBe(BANCO);
    expect(alteracoesDoPatch(BANCO, 1)).toHaveLength(0);
  });

  it("patch >= 2 gera buffs e nerfs com sinal correto", () => {
    const alts = alteracoesDoPatch(BANCO, 2);
    expect(alts.filter((a) => a.tipo === "buff")).toHaveLength(7);
    expect(alts.filter((a) => a.tipo === "nerf")).toHaveLength(7);
    expect(alts.every((a) => (a.tipo === "buff" ? a.delta > 0 : a.delta < 0))).toBe(true);
  });

  it("é determinístico para o mesmo patch", () => {
    expect(aplicarPatch(BANCO, 3)).toEqual(aplicarPatch(BANCO, 3));
  });

  it("patches diferentes mudam a meta de forma diferente", () => {
    const a = aplicarPatch(BANCO, 2).map((c) => c.forcaMetaBase);
    const b = aplicarPatch(BANCO, 3).map((c) => c.forcaMetaBase);
    expect(a).not.toEqual(b);
  });

  it("NUNCA altera as rotas (rolesValidas)", () => {
    const ajustado = aplicarPatch(BANCO, 5);
    ajustado.forEach((c, i) => {
      expect(c.rolesValidas).toEqual(BANCO[i].rolesValidas);
    });
  });

  it("versão fica no estilo 25.N", () => {
    expect(versaoPatch(4)).toBe("25.4");
  });
});
