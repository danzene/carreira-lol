import { describe, expect, it } from "vitest";
import { alteracoesDoPatch, aplicarPatch, versaoPatch } from "./patch";
import type { ChampionDef } from "./types";

// forcaMetaBase variada: c0=30 (mais fraco) … c23=76 (mais forte).
function champ(i: number): ChampionDef {
  return {
    id: `c${i}`,
    nome: `C${i}`,
    classes: ["LUTADOR"],
    rolesValidas: ["TOP", "JUNGLE"],
    perfil: { dano: 50, resistencia: 50, cc: 30, mobilidade: 30, sustain: 30 },
    forcaMetaBase: 30 + i * 2,
  };
}
const BANCO: ChampionDef[] = Array.from({ length: 24 }, (_, i) => champ(i));

describe("auto patch", () => {
  it("patch 1 não altera nada (meta base/real)", () => {
    expect(aplicarPatch(BANCO, 1)).toBe(BANCO);
    expect(alteracoesDoPatch(BANCO, 1)).toHaveLength(0);
  });

  it("patch >= 2 gera buffs e nerfs", () => {
    const alts = alteracoesDoPatch(BANCO, 2);
    expect(alts.filter((a) => a.tipo === "buff")).toHaveLength(7);
    expect(alts.filter((a) => a.tipo === "nerf")).toHaveLength(7);
  });

  it("nerfa os FORTES e buffa os FRACOS", () => {
    const fortes = new Set(Array.from({ length: 8 }, (_, k) => `c${23 - k}`)); // terço mais forte
    const fracos = new Set(Array.from({ length: 8 }, (_, k) => `c${k}`)); // terço mais fraco
    for (const a of alteracoesDoPatch(BANCO, 2)) {
      if (a.tipo === "nerf") {
        expect(a.delta).toBeLessThan(0);
        expect(fortes.has(a.championId)).toBe(true);
      } else {
        expect(a.delta).toBeGreaterThan(0);
        expect(fracos.has(a.championId)).toBe(true);
      }
    }
  });

  it("é determinístico para o mesmo patch", () => {
    expect(aplicarPatch(BANCO, 3)).toEqual(aplicarPatch(BANCO, 3));
  });

  it("patches diferentes mudam a meta de forma diferente", () => {
    const a = aplicarPatch(BANCO, 2).map((c) => c.forcaMetaBase);
    const b = aplicarPatch(BANCO, 4).map((c) => c.forcaMetaBase);
    expect(a).not.toEqual(b);
  });

  it("NUNCA altera as rotas (rolesValidas)", () => {
    aplicarPatch(BANCO, 6).forEach((c, i) => {
      expect(c.rolesValidas).toEqual(BANCO[i].rolesValidas);
    });
  });

  it("versão fica no estilo 25.N", () => {
    expect(versaoPatch(4)).toBe("25.4");
  });
});
