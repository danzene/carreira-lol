import { describe, expect, it } from "vitest";
import { alteracoesDoPatch, aplicarPatch, versaoPatch } from "./patch";
import type { ChampionDef, Role } from "./types";

const RS: Role[] = ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"];

// 8 campeões por rota, com forcaMetaBase variada (35..70) dentro de cada rota.
function champ(i: number): ChampionDef {
  return {
    id: `c${i}`,
    nome: `C${i}`,
    classes: ["LUTADOR"],
    rolesValidas: [RS[i % 5]],
    perfil: { dano: 50, resistencia: 50, cc: 30, mobilidade: 30, sustain: 30 },
    forcaMetaBase: 35 + (i % 8) * 5,
  };
}
const BANCO: ChampionDef[] = Array.from({ length: 40 }, (_, i) => champ(i));

describe("auto patch", () => {
  it("patch 1 não altera nada (meta base/real)", () => {
    expect(aplicarPatch(BANCO, 1)).toBe(BANCO);
    expect(alteracoesDoPatch(BANCO, 1)).toHaveLength(0);
  });

  it("patch >= 2 gera buffs (+) e nerfs (-)", () => {
    const alts = alteracoesDoPatch(BANCO, 2);
    expect(alts.length).toBeGreaterThan(0);
    expect(alts.every((a) => (a.tipo === "buff" ? a.delta > 0 : a.delta < 0))).toBe(true);
  });

  it("TODA rota muda: nerfa os fortes e buffa os fracos de cada rota", () => {
    const forca = new Map(BANCO.map((c) => [c.id, c.forcaMetaBase]));
    const rotaDe = new Map(BANCO.map((c) => [c.id, c.rolesValidas[0]]));
    const alts = alteracoesDoPatch(BANCO, 2);
    for (const rota of RS) {
      const nerfs = alts.filter((a) => a.tipo === "nerf" && rotaDe.get(a.championId) === rota).map((a) => forca.get(a.championId)!);
      const buffs = alts.filter((a) => a.tipo === "buff" && rotaDe.get(a.championId) === rota).map((a) => forca.get(a.championId)!);
      expect(nerfs.length).toBeGreaterThan(0);
      expect(buffs.length).toBeGreaterThan(0);
      expect(Math.min(...nerfs)).toBeGreaterThanOrEqual(Math.max(...buffs));
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
